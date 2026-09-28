<?php
declare(strict_types=1);

/**
 * Stores Youlag's per-user data, synced from the browser's IndexedDB. One row per store and key.
 */
final class YoulagUserDataDAO extends Minz_ModelPdo
{
    public const STORES = ["dearrow", "duration", "sponsorblock", "chapterSkip", "playback", "watchHistory"];
    /** Most rows kept per store, oldest pruned first. Stores not listed have no limit. */
    public const ROW_LIMITS = [
        "dearrow" => 50000,
        "sponsorblock" => 50000,
        "duration" => 100000,
        "playback" => 10000,
        "watchHistory" => 10000,
    ];
    /** Entries shown on the watch history page, most recent first. */
    public const WATCH_HISTORY_PAGE_SIZE = 100;
    private const SCHEMA_VERSION = 1;

    /**
     * Opens the current user's store, creating its table on first use.
     * Requests without a login (anonymous reading, shared user queries) only read.
     */
    public static function open(): ?self
    {
        if (!FreshRSS_Context::hasUserConf()) {
            return null;
        }
        try {
            $dao = new self();
            $conf = FreshRSS_Context::userConf();
            $version = $conf->attributeInt("yl_data_schema") ?? 0;
            if ($version < self::SCHEMA_VERSION) {
                if (!FreshRSS_Auth::hasAccess() || !$dao->setUp($conf)) {
                    return null;
                }
            }
            return $dao;
        } catch (Exception $e) {
            Minz_Log::error("Youlag: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Creates the table on the user's first use, one request at a time.
     */
    private function setUp(FreshRSS_UserConfiguration $conf): bool
    {
        if (!$this->lock()) {
            return false;
        }
        try {
            // Read again from disk, since another request may have set up the table after this one loaded the config.
            $saved = Minz_Configuration::load(join_path(USERS_PATH, Minz_User::name() ?? "", "config.php"));
            $version = is_int($saved["yl_data_schema"] ?? null) ? $saved["yl_data_schema"] : 0;
            if ($version >= self::SCHEMA_VERSION) {
                $conf->_attribute("yl_data_schema", $version);
                return true;
            }
            // Saves the flag before dropping, so a config that can't be saved never loses the table.
            $conf->_attribute("yl_data_schema", self::SCHEMA_VERSION);
            if (!$conf->save()) {
                return false;
            }
            // Starts clean when a table is left over from a deleted user with the same name. SQLite keeps each
            // user's tables in their own file, deleted with the user.
            $leftoverPossible = $version === 0 && $this->pdo->dbType() !== "sqlite";
            if (($leftoverPossible && !$this->dropTable()) || !$this->createSchema()) {
                $conf->_attribute("yl_data_schema", null);
                $conf->save();
                return false;
            }
            return true;
        } finally {
            $this->unlock();
        }
    }

    private function lockName(): string
    {
        return "yl_data_" . md5($this->pdo->prefix() . Minz_User::name());
    }

    private function lock(): bool
    {
        return match ($this->pdo->dbType()) {
            // Gives up after 10 s rather than hold the request.
            "mysql" => (int) ($this->fetchColumn("SELECT GET_LOCK(?, 10)", 0, self::positional([$this->lockName()]))[0] ?? 0) === 1,
            "pgsql" => $this->pgLock(),
            // SQLite has one writer at a time already, and its setup has no drop to race.
            default => true,
        };
    }

    /**
     * Gives up after 10 s like MySQL's GET_LOCK, since pg_advisory_lock would wait for as long as the other holds it.
     */
    private function pgLock(): bool
    {
        $deadline = microtime(true) + 10;
        do {
            $got = $this->fetchColumn("SELECT pg_try_advisory_lock(hashtext(?))", 0, self::positional([$this->lockName()]))[0] ?? false;
            if ($got === true || $got === 1 || $got === "1" || $got === "t") {
                return true;
            }
            usleep(100000);
        } while (microtime(true) < $deadline);
        return false;
    }

    private function unlock(): void
    {
        $sql = match ($this->pdo->dbType()) {
            "mysql" => "SELECT RELEASE_LOCK(?)",
            "pgsql" => "SELECT pg_advisory_unlock(hashtext(?))",
            default => null,
        };
        if ($sql !== null) {
            $this->execute($sql, [$this->lockName()]);
        }
    }

    private function dropTable(): bool
    {
        return $this->pdo->exec("DROP TABLE IF EXISTS `_yl_data`") !== false;
    }

    private function createSchema(): bool
    {
        $sql = match ($this->pdo->dbType()) {
            "mysql" => <<<'SQL'
                CREATE TABLE IF NOT EXISTS `_yl_data` (
                	`store` VARCHAR(32) NOT NULL,
                	`item_key` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
                	`value` TEXT NOT NULL,
                	`updated_at` BIGINT NOT NULL,
                	`ttl_ms` BIGINT NOT NULL DEFAULT 0,
                	PRIMARY KEY (`store`, `item_key`),
                	INDEX (`store`, `updated_at`)
                ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                ENGINE = INNODB;
                SQL,
            default => <<<'SQL'
                CREATE TABLE IF NOT EXISTS `_yl_data` (
                	`store` VARCHAR(32) NOT NULL,
                	`item_key` VARCHAR(64) NOT NULL,
                	`value` TEXT NOT NULL,
                	`updated_at` BIGINT NOT NULL,
                	`ttl_ms` BIGINT NOT NULL DEFAULT 0,
                	PRIMARY KEY (`store`, `item_key`)
                );
                CREATE INDEX IF NOT EXISTS `_yl_data_store_updated_index` ON `_yl_data` (`store`, `updated_at`);
                SQL,
        };
        return $this->pdo->exec($sql) !== false;
    }

    /**
     * Saves rows, keeping whichever version of a row is newer. Returns null when the write fails.
     * @param list<array{store:string,key:string,value:string,updatedAt:int,ttlMs:int}> $rows
     */
    public function upsert(array $rows): ?int
    {
        if ($rows === []) {
            return 0;
        }
        $mysql = $this->pdo->dbType() === "mysql";
        // MySQL binds the new values again: VALUES() is deprecated there, and MariaDB lacks its replacement.
        // `updated_at` is set last, so the conditions before it compare with the stored time.
        $sql = $mysql
            ? <<<'SQL'
                INSERT INTO `_yl_data` (`store`, `item_key`, `value`, `updated_at`, `ttl_ms`) VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                	`value` = IF(? >= `updated_at`, ?, `value`),
                	`ttl_ms` = IF(? >= `updated_at`, ?, `ttl_ms`),
                	`updated_at` = IF(? >= `updated_at`, ?, `updated_at`)
                SQL
            : <<<'SQL'
                INSERT INTO `_yl_data` (`store`, `item_key`, `value`, `updated_at`, `ttl_ms`) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (`store`, `item_key`) DO UPDATE SET
                	`value` = excluded.`value`, `updated_at` = excluded.`updated_at`, `ttl_ms` = excluded.`ttl_ms`
                WHERE excluded.`updated_at` >= `_yl_data`.`updated_at`
                SQL;
        $stm = $this->pdo->prepare($sql);
        if ($stm === false) {
            return null;
        }
        $this->pdo->beginTransaction();
        foreach ($rows as $row) {
            $values = [$row["store"], $row["key"], $row["value"], $row["updatedAt"], $row["ttlMs"]];
            if ($mysql) {
                array_push($values, $row["updatedAt"], $row["value"], $row["updatedAt"], $row["ttlMs"], $row["updatedAt"], $row["updatedAt"]);
            }
            if (!$stm->execute($values)) {
                $this->pdo->rollBack();
                return null;
            }
        }
        return $this->pdo->commit() ? count($rows) : null;
    }

    /**
     * Creates the table if it's missing.
     */
    public function ensureSchema(): bool
    {
        return $this->createSchema();
    }

    /**
     * @param list<string> $stores
     * @param list<string> $keys
     * @return list<array<string,mixed>>
     */
    public function fetchByKeys(array $stores, array $keys): array
    {
        if ($stores === [] || $keys === []) {
            return [];
        }
        $sql = "SELECT `store`, `item_key`, `value`, `updated_at`, `ttl_ms` FROM `_yl_data`"
            . " WHERE `store` IN (" . implode(",", array_fill(0, count($stores), "?")) . ")"
            . " AND `item_key` IN (" . implode(",", array_fill(0, count($keys), "?")) . ")";
        return $this->fetchAssoc($sql, self::positional([...$stores, ...$keys])) ?? [];
    }

    public function findValue(string $store, string $key): ?string
    {
        $rows = $this->fetchColumn(
            "SELECT `value` FROM `_yl_data` WHERE `store` = ? AND `item_key` = ?",
            0,
            self::positional([$store, $key]),
        );
        return isset($rows[0]) ? (string) $rows[0] : null;
    }

    /**
     * @return list<string> Entry IDs, most recently viewed first.
     */
    public function watchHistoryEntryIds(int $limit): array
    {
        $rows = $this->fetchColumn(
            "SELECT `item_key` FROM `_yl_data` WHERE `store` = ? ORDER BY `updated_at` DESC LIMIT " . max(1, $limit),
            0,
            self::positional(["watchHistory"]),
        );
        return array_values(array_filter(array_map("strval", $rows ?? []), "ctype_digit"));
    }

    /**
     * @param list<string> $keys
     */
    public function deleteKeys(string $store, array $keys): bool
    {
        if ($keys === []) {
            return true;
        }
        $sql = "DELETE FROM `_yl_data` WHERE `store` = ? AND `item_key` IN ("
            . implode(",", array_fill(0, count($keys), "?")) . ")";
        return $this->execute($sql, [$store, ...$keys]);
    }

    public function deleteStore(string $store): bool
    {
        return $this->execute("DELETE FROM `_yl_data` WHERE `store` = ?", [$store]);
    }

    /**
     * Keeps the newest rows of each store up to its limit.
     * @param array<string,int> $limits
     */
    public function pruneToLimits(array $limits): bool
    {
        $ok = true;
        foreach ($limits as $store => $limit) {
            // Finds the cutoff row first, since MySQL can't limit rows inside a subquery.
            $cutoff = $this->fetchColumn(
                "SELECT `updated_at` FROM `_yl_data` WHERE `store` = ? ORDER BY `updated_at` DESC LIMIT 1 OFFSET " . max(0, $limit),
                0,
                self::positional([$store]),
            );
            if (!isset($cutoff[0])) {
                continue;
            }
            $ok = $this->execute(
                "DELETE FROM `_yl_data` WHERE `store` = ? AND `updated_at` <= ?",
                [$store, (int) $cutoff[0]],
            ) && $ok;
        }
        return $ok;
    }

    /**
     * @param list<string|int> $values
     */
    private function execute(string $sql, array $values): bool
    {
        $stm = $this->pdo->prepare($sql);
        return $stm !== false && $stm->execute($values);
    }

    /**
     * Numbers the values from 1, since FreshRSS binds each value by its key.
     * @param list<string|int> $values
     * @return array<int,string|int>
     */
    private static function positional(array $values): array
    {
        return $values === [] ? [] : array_combine(range(1, count($values)), $values);
    }
}

<?php
declare(strict_types=1);

/**
 * Youlag's endpoint. Syncs the browser's IndexedDB data and serves the watch history.
 */
final class FreshExtension_youlag_Controller extends FreshRSS_ActionController
{
    private const MAX_ITEMS = 500;
    private const MAX_VALUE_BYTES = 16384;
    private const KEY_PATTERN = '/^[A-Za-z0-9_-]{1,64}$/';
    /** How far past the server's clock a change may be stamped, for device clocks before their first response. */
    private const MAX_AHEAD_MS = 86400000;
    /** Requests one session may send within the window, so a runaway page can't flood the server. */
    private const BURST_MAX_REQUESTS = 120;
    private const BURST_WINDOW_SECONDS = 10;
    private const VIDEO_DATA_STORES = ["dearrow", "duration", "sponsorblock", "chapterSkip", "playback"];

    #[\Override]
    public function firstAction(): void
    {
        if (!FreshRSS_Auth::hasAccess()) {
            Minz_Error::error(403);
        }
        $retryAfter = $this->burstRetryAfter();
        if ($retryAfter > 0) {
            header("Retry-After: " . $retryAfter);
            $this->respond(["error" => "Too many requests"], 429);
        }
    }

    /**
     * Counts this session's requests in a fixed window. Returns the seconds to wait once over the limit, else 0.
     * Requests racing on one session can undercount, which only loosens the limit.
     */
    private function burstRetryAfter(): int
    {
        $now = time();
        [$start, $count] = array_map("intval", explode(":", Minz_Session::paramString("yl_burst")) + [0, 0]);
        if ($now - $start >= self::BURST_WINDOW_SECONDS) {
            [$start, $count] = [$now, 0];
        }
        Minz_Session::_param("yl_burst", $start . ":" . ($count + 1));
        return $count >= self::BURST_MAX_REQUESTS ? max(1, self::BURST_WINDOW_SECONDS - ($now - $start)) : 0;
    }

    /**
     * Saves a batch of IndexedDB records.
     */
    public function syncAction(): void
    {
        $dao = $this->requirePostAndStore();
        $historyEnabled = YoulagExtension::isWatchHistoryEnabled();
        $clearedAt = FreshRSS_Context::userConf()->attributeInt("yl_video_data_cleared_at") ?? 0;
        $historyClearedAt = FreshRSS_Context::userConf()->attributeInt("yl_watch_history_cleared_at") ?? 0;
        // A row stamped far ahead would beat every later change, and a clear, until that date.
        $maxUpdatedAt = (int) floor(microtime(true) * 1000) + self::MAX_AHEAD_MS;
        $rows = [];
        foreach (array_slice(Minz_Request::paramArray("items", plaintext: true), 0, self::MAX_ITEMS) as $item) {
            $row = $this->parseItem($item);
            if (
                $row === null ||
                $row["updatedAt"] > $maxUpdatedAt ||
                ($row["store"] === "watchHistory" && (!$historyEnabled || $row["updatedAt"] < $historyClearedAt)) ||
                // Changes made before the last clear would bring cleared data back.
                (in_array($row["store"], self::VIDEO_DATA_STORES, true) && $row["updatedAt"] < $clearedAt)
            ) {
                continue;
            }
            $rows[] = $row;
        }
        $saved = $dao->upsert($rows);
        if ($saved === null && $dao->ensureSchema()) {
            // Recreates a table that went missing, e.g. after a database restore that kept the user config.
            $saved = $dao->upsert($rows);
        }
        if ($saved === null) {
            // Keeps the browser's queue, so the rows are sent again later.
            $this->respond(["error" => "Storage write failed"], 500);
        }
        $this->respond(["saved" => $saved]);
    }

    /**
     * Returns the stored records for the given stores and keys.
     */
    public function fetchAction(): void
    {
        $dao = $this->requirePostAndStore();
        // Every list is deduplicated and capped, so one request stays small (FreshRSS also reads at most 1 MB of it).
        $stores = array_values(array_unique(array_intersect(
            Minz_Request::paramArrayString("stores", plaintext: true),
            YoulagUserDataDAO::STORES,
        )));
        $keys = array_slice(array_values(array_unique(array_filter(
            Minz_Request::paramArrayString("keys", plaintext: true),
            fn(string $key): bool => preg_match(self::KEY_PATTERN, $key) === 1,
        ))), 0, self::MAX_ITEMS);
        $rows = array_map(
            fn(array $row): array => [
                "store" => (string) $row["store"],
                "key" => (string) $row["item_key"],
                "value" => (string) $row["value"],
                "updatedAt" => (int) $row["updated_at"],
                "ttlMs" => (int) $row["ttl_ms"],
            ],
            $dao->fetchByKeys($stores, $keys),
        );
        $this->respond(["rows" => $rows]);
    }

    /**
     * Shows the watch history as a normal stream of the viewed entries, so every entry control works.
     */
    public function watchHistoryAction(): void
    {
        if (!YoulagExtension::isWatchHistoryEnabled()) {
            Minz_Request::forward(["c" => "index", "a" => "index"], redirect: true);
        }
        Minz_Request::forward([
            "c" => "index",
            "a" => "normal",
            "params" => array_filter(YoulagExtension::watchHistoryRequestParams(), static fn ($value) => $value !== null),
        ]);
    }

    /**
     * Removes entries from the watch history, or clears it when asked for all.
     */
    public function watchHistoryRemoveAction(): void
    {
        $dao = $this->requirePostAndStore();
        $clearedAt = null;
        if (Minz_Request::paramBoolean("all")) {
            $ok = $dao->deleteStore("watchHistory");
            // Other devices compare this time with their own last clear on their next page load.
            $clearedAt = (int) floor(microtime(true) * 1000);
            $conf = FreshRSS_Context::userConf();
            $conf->_attribute("yl_watch_history_cleared_at", $clearedAt);
            $ok = $conf->save() && $ok;
        } else {
            $ids = array_slice(array_values(array_unique(array_filter(
                Minz_Request::paramArrayString("ids", plaintext: true),
                "ctype_digit",
            ))), 0, self::MAX_ITEMS);
            $ok = $dao->deleteKeys("watchHistory", $ids);
        }
        $this->respond(["ok" => $ok, "clearedAt" => $clearedAt], $ok ? 200 : 500);
    }

    /**
     * Deletes the saved video data. Watch history stays.
     */
    public function clearVideoDataAction(): void
    {
        $dao = $this->requirePostAndStore();
        $ok = true;
        foreach (self::VIDEO_DATA_STORES as $store) {
            $ok = $dao->deleteStore($store) && $ok;
        }
        // Other devices compare this time with their own last clear on their next page load.
        $clearedAt = (int) floor(microtime(true) * 1000);
        $conf = FreshRSS_Context::userConf();
        $conf->_attribute("yl_video_data_cleared_at", $clearedAt);
        $ok = $conf->save() && $ok;
        $this->respond(["ok" => $ok, "clearedAt" => $clearedAt], $ok ? 200 : 500);
    }

    /**
     * @return array{store:string,key:string,value:string,updatedAt:int,ttlMs:int}|null
     */
    private function parseItem(mixed $item): ?array
    {
        if (!is_array($item)) {
            return null;
        }
        $store = $item["store"] ?? null;
        $key = $item["key"] ?? null;
        $value = $item["value"] ?? null;
        $updatedAt = $item["updatedAt"] ?? null;
        $ttlMs = $item["ttlMs"] ?? 0;
        if (
            !in_array($store, YoulagUserDataDAO::STORES, true) ||
            !is_string($key) || preg_match(self::KEY_PATTERN, $key) !== 1 ||
            !is_string($value) || strlen($value) > self::MAX_VALUE_BYTES ||
            !is_int($updatedAt) || $updatedAt <= 0 ||
            !is_int($ttlMs) || $ttlMs < 0
        ) {
            return null;
        }
        if ($store === "watchHistory" && !ctype_digit($key)) {
            // Watch history keys are entry IDs, anything else would break the page's entry search.
            return null;
        }
        json_decode($value);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }
        return ["store" => $store, "key" => $key, "value" => $value, "updatedAt" => $updatedAt, "ttlMs" => $ttlMs];
    }

    private function requirePostAndStore(): YoulagUserDataDAO
    {
        if (!Minz_Request::isPost()) {
            $this->respond(["error" => "POST required"], 405);
        }
        $dao = YoulagUserDataDAO::open();
        if ($dao === null) {
            $this->respond(["error" => "Storage unavailable"], 500);
        }
        return $dao;
    }

    /**
     * @param array<string,mixed> $data
     */
    private function respond(array $data, int $status = 200): never
    {
        http_response_code($status);
        header("Content-Type: application/json; charset=UTF-8");
        // The browser stamps its changes with this clock, so every device compares times from the server's clock.
        echo json_encode($data + ["serverTime" => (int) floor(microtime(true) * 1000)]);
        exit();
    }
}

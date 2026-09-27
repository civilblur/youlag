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

    #[\Override]
    public function firstAction(): void
    {
        if (!FreshRSS_Auth::hasAccess()) {
            Minz_Error::error(403);
        }
    }

    /**
     * Saves a batch of IndexedDB records.
     */
    public function syncAction(): void
    {
        $dao = $this->requirePostAndStore();
        $historyEnabled = YoulagExtension::isWatchHistoryEnabled();
        $rows = [];
        foreach (array_slice(Minz_Request::paramArray("items", plaintext: true), 0, self::MAX_ITEMS) as $item) {
            $row = $this->parseItem($item);
            if ($row === null || ($row["store"] === "watchHistory" && !$historyEnabled)) {
                continue;
            }
            $rows[] = $row;
        }
        $this->respond(["saved" => $dao->upsert($rows)]);
    }

    /**
     * Returns the stored records for the given stores and keys.
     */
    public function fetchAction(): void
    {
        $dao = $this->requirePostAndStore();
        $stores = array_values(array_intersect(
            Minz_Request::paramArrayString("stores", plaintext: true),
            YoulagUserDataDAO::STORES,
        ));
        $keys = array_values(array_filter(
            array_slice(Minz_Request::paramArrayString("keys", plaintext: true), 0, self::MAX_ITEMS),
            fn(string $key): bool => preg_match(self::KEY_PATTERN, $key) === 1,
        ));
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
        echo json_encode($data);
        exit();
    }
}

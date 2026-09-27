/**
 * Sync
 *
 * Syncs IndexedDB data with the Youlag endpoint, so it follows the user across devices.
 * Changes are queued and sent in batches, and each page pulls the rows for its videos.
 */

function syncEnabled() {
  // Anonymous reading has no login, so nothing is written to the endpoint.
  return typeof context !== "undefined" && context.anonymous === false;
}

async function syncPost(action, body, keepalive = false) {
  const response = await fetch(`./?c=youlag&a=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ _csrf: context.csrf, ...body }),
    keepalive,
  });
  if (!response.ok) {
    throw new Error(`Youlag (sync): ${action} failed with ${response.status}`);
  }
  return response.json();
}

function syncItem(storeName, key, record) {
  return {
    store: storeName,
    key: String(key),
    value: JSON.stringify(record.value),
    updatedAt: record.timestamp,
    ttlMs: record.ttlMs || 0,
  };
}

function syncByteLength(text) {
  return new TextEncoder().encode(text).length;
}

function syncMarkDirty(storeName, key, record) {
  if (!syncEnabled() || !app.sync.stores.includes(storeName)) return;
  const queueKey = `${storeName}:${key}`;
  if (record) app.state.sync.unsent.set(queueKey, syncItem(storeName, key, record));
  dbPutRecord(app.sync.queueStore, queueKey, Date.now())
    .then(syncScheduleFlush)
    .catch(() => {});
}

function syncScheduleFlush() {
  // Batches every change made within the delay into one request.
  if (app.state.sync.flushTimer) return;
  app.state.sync.flushTimer = setTimeout(() => {
    app.state.sync.flushTimer = null;
    syncFlush();
  }, app.sync.flushDelayMs);
}

async function syncFlush() {
  if (!syncEnabled() || app.state.sync.flushing) return;
  app.state.sync.flushing = true;
  let sent = [];
  let items = [];
  let bytes = 0;
  const send = async () => {
    if (items.length) await syncPost("sync", { items });
    // Keys changed during the request were queued again and stay for the next flush.
    for (const { queueKey, queuedAt, item } of sent) {
      if ((await dbGetRecord(app.sync.queueStore, queueKey)) === queuedAt) {
        await dbDelete(app.sync.queueStore, queueKey);
      }
      if (item && app.state.sync.unsent.get(queueKey)?.updatedAt === item.updatedAt) {
        app.state.sync.unsent.delete(queueKey);
      }
    }
    sent = [];
    items = [];
    bytes = 0;
  };
  try {
    const queueKeys = await dbGetAllKeys(app.sync.queueStore);
    for (const queueKey of queueKeys) {
      const separator = queueKey.indexOf(":");
      const storeName = queueKey.slice(0, separator);
      const key = queueKey.slice(separator + 1);
      const queuedAt = await dbGetRecord(app.sync.queueStore, queueKey);
      const record = await dbGetRecord(storeName, key).catch(() => undefined);
      // Deleted records, and values the endpoint would reject as too large, leave the queue unsent.
      const item =
        record && syncByteLength(JSON.stringify(record.value)) <= app.sync.valueMaxBytes
          ? syncItem(storeName, key, record)
          : null;
      const itemBytes = item ? syncByteLength(JSON.stringify(item)) : 0;
      if (
        items.length &&
        (items.length >= app.sync.batchSize || bytes + itemBytes > app.sync.batchMaxBytes)
      ) {
        await send();
      }
      sent.push({ queueKey, queuedAt, item });
      if (item) {
        items.push(item);
        bytes += itemBytes;
      }
    }
    await send();
  } catch (e) {
    console.error("Youlag (sync): Flush failed:", e);
  } finally {
    app.state.sync.flushing = false;
  }
}

function syncSendOnHide() {
  // Sends the newest unsent changes in one keepalive request, playback first.
  // Built from memory, since the browser may freeze a hidden page before IndexedDB answers.
  if (!syncEnabled() || app.state.sync.hideSent || !app.state.sync.unsent.size) return 0;
  app.state.sync.hideSent = true;
  const unsent = [...app.state.sync.unsent.values()].sort(
    (a, b) =>
      (b.store === "playback") - (a.store === "playback") || b.updatedAt - a.updatedAt,
  );
  const items = [];
  let bytes = 0;
  for (const item of unsent) {
    const itemBytes = syncByteLength(JSON.stringify(item));
    if (bytes + itemBytes > app.sync.hideMaxBytes) continue;
    items.push(item);
    bytes += itemBytes;
  }
  // The queue keeps these, so a failed request is sent again on the next visit.
  syncPost("sync", { items }, true).catch(() => {});
  return items.length;
}

function syncIsEmptyList(storeName, record) {
  return (
    app.sync.emptyListStores.includes(storeName) &&
    Array.isArray(record?.value) &&
    record.value.length === 0
  );
}

async function syncAdoptLegacyChapterSkip() {
  // Skipped chapters saved before databases were per user go to the first user who loads Youlag in this browser.
  if (localStorage.getItem("ylChapterSkipAdopted") === "true") return;
  const legacyName = `${app.db.name}-chapterSkip`;
  const entries = await dbGetAllEntries("chapterSkip", legacyName).catch(() => []);
  const adopted = entries
    .filter(([, record]) => Array.isArray(record?.value) && record.value.length > 0)
    .map(([key, record]) => [key, { ...record, ttlMs: 0 }]);
  if (adopted.length) await dbPutMany("chapterSkip", adopted);
  dbConnections[legacyName]?.close();
  delete dbConnections[legacyName];
  indexedDB.deleteDatabase(legacyName);
  localStorage.setItem("ylChapterSkipAdopted", "true");
}

async function syncBackfill() {
  // Queues the data saved before syncing existed, once per user and browser.
  const flag = `ylSyncBackfilled:${getSetting("yl_user")}`;
  if (localStorage.getItem(flag) === "true") return;
  await app.state.sync.adopted;
  const now = Date.now();
  for (const storeName of app.sync.stores) {
    const entries = await dbGetAllEntries(storeName).catch(() => []);
    const queue = entries
      .filter(([, record]) => !syncIsEmptyList(storeName, record))
      .map(([key]) => [`${storeName}:${key}`, now]);
    if (queue.length) await dbPutMany(app.sync.queueStore, queue);
  }
  localStorage.setItem(flag, "true");
  syncScheduleFlush();
}

function setupSync() {
  app.state.sync.adopted = syncAdoptLegacyChapterSkip().catch(() => {});
  if (!syncEnabled()) return;
  syncBackfill().catch((e) => console.error("Youlag (sync): Backfill failed:", e));
  syncFlush(); // Sends what the last visit left unsent.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      syncSendOnHide();
    } else {
      app.state.sync.hideSent = false;
    }
  });
  window.addEventListener("pagehide", syncSendOnHide);
}

async function syncPull(videoIds) {
  // Merges the server's rows for these videos into IndexedDB, keeping whichever is newer.
  const pending = videoIds.filter((id) => !app.state.sync.pulled.has(id));
  pending.forEach((id) => app.state.sync.pulled.add(id));
  for (let i = 0; i < pending.length; i += app.sync.batchSize) {
    try {
      const { rows } = await syncPost("fetch", {
        stores: app.sync.videoStores,
        keys: pending.slice(i, i + app.sync.batchSize),
      });
      for (const row of rows) {
        const local = await dbGetRecord(row.store, row.key).catch(() => undefined);
        if (local && local.timestamp >= row.updatedAt) continue;
        const value = JSON.parse(row.value);
        await dbPutRecord(row.store, row.key, { value, timestamp: row.updatedAt, ttlMs: row.ttlMs });
        if (row.store === "playback") app.state.sync.playbackPositions.set(row.key, value);
      }
    } catch (e) {
      console.error("Youlag (sync): Pull failed:", e);
    }
  }
}

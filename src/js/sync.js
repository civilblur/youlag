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

function syncNow() {
  // The server's clock, so conflicts and clears are judged on the one clock every device shares.
  if (app.state.sync.clockOffset === null) {
    try {
      app.state.sync.clockOffset = Number(localStorage.getItem("ylClockOffset")) || 0;
    } catch (e) {
      app.state.sync.clockOffset = 0;
    }
  }
  return Date.now() + app.state.sync.clockOffset;
}

function syncSetClockOffset(serverTime, sentAt, receivedAt) {
  // Kept per browser, since the offset belongs to the device clock, and pages can be served from cache.
  if (!Number.isFinite(serverTime)) return;
  app.state.sync.clockOffset = Math.round(serverTime - (sentAt + receivedAt) / 2);
  try {
    localStorage.setItem("ylClockOffset", String(app.state.sync.clockOffset));
  } catch (e) {}
}

async function syncPost(action, body, keepalive = false) {
  const sentAt = Date.now();
  const response = await fetch(`./?c=youlag&a=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ _csrf: context.csrf, ...body }),
    keepalive,
  });
  if (!response.ok) {
    throw new Error(`Youlag (sync): ${action} failed with ${response.status}`);
  }
  const data = await response.json();
  syncSetClockOffset(data.serverTime, sentAt, Date.now());
  return data;
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

function syncFlush() {
  // A flush asked for during another one runs right after it, so callers wait until their changes are sent.
  if (!syncEnabled()) return Promise.resolve();
  if (app.state.sync.flushing) {
    app.state.sync.flushAgain = true;
    return app.state.sync.flushing;
  }
  app.state.sync.flushing = syncFlushQueue().finally(() => {
    app.state.sync.flushing = null;
    if (app.state.sync.flushAgain) {
      app.state.sync.flushAgain = false;
      return syncFlush();
    }
  });
  return app.state.sync.flushing;
}

async function syncFlushQueue() {
  let sent = [];
  let items = [];
  let bytes = 0;
  const send = async () => {
    if (items.length) await syncPost("sync", { items });
    // Keys changed during the request were queued again and stay for the next flush.
    for (const { queueKey, queuedAt, item } of sent) {
      await dbDeleteIfUnchanged(app.sync.queueStore, queueKey, queuedAt);
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

async function syncMigrateLegacy() {
  // Moves data from before databases were per user into this user's database, once per browser, and queues it,
  // since it was saved before syncing existed. The released layout had no owner, so the first user who loads
  // Youlag here adopts it.
  if (localStorage.getItem("ylLegacyMigrated") === "true") return;
  const user = getSetting("yl_user");
  const sources = [
    ...app.db.legacyStores.map((storeName) => [`youlag-cache-${storeName}`, storeName]),
    ...app.db.branchStores.map((storeName) => [`youlag-cache-${user}-${storeName}`, storeName]),
  ];
  for (const [legacyName, storeName] of sources) {
    const entries = (await dbReadLegacy(legacyName, storeName)).filter(
      ([, record]) => storeName !== "chapterSkip" || record?.value?.length > 0,
    );
    if (entries.length) {
      await dbPutMany(storeName, entries);
      const now = Date.now();
      const queue = entries
        .filter(([, record]) => app.sync.stores.includes(storeName) && !syncIsEmptyList(storeName, record))
        .map(([key]) => [`${storeName}:${key}`, now]);
      if (queue.length) await dbPutMany(app.sync.queueStore, queue);
    }
    indexedDB.deleteDatabase(legacyName);
  }
  localStorage.setItem("ylLegacyMigrated", "true");
  localStorage.removeItem("ylChapterSkipAdopted");
}

async function syncPruneLocal() {
  // Keeps this browser's stores small: once a day, drops records untouched for the age limit that the server
  // already has. They come back through the page pull when their video shows again.
  // Without a login nothing reaches the server, so nothing is pruned.
  if (!syncEnabled()) return;
  const flag = `ylPrunedAt:${getSetting("yl_user")}`;
  const now = syncNow();
  if (now - (Number(localStorage.getItem(flag)) || 0) < app.sync.pruneIntervalMs) return;
  for (const storeName of app.sync.stores) {
    await dbPruneUnqueued(storeName, now - app.sync.localMaxAgeMs);
  }
  localStorage.setItem(flag, String(now));
}

function setupSync() {
  app.state.sync.positionsLoaded = loadPlaybackPositions();
  app.state.sync.migrated = syncMigrateLegacy().catch(() => {});
  // After the migration, which writes old records before it queues them.
  app.state.sync.pruned = app.state.sync.migrated.then(syncPruneLocal).catch(() => {});
  if (!syncEnabled()) return;
  // Applies clears made on another device first, also to the data just moved from the old databases,
  // so the flush doesn't send the cleared data back.
  app.state.sync.migrated
    .then(() => Promise.all([applyVideoDataClear(), applyWatchHistoryClear()]))
    .catch(() => {})
    .finally(() => syncFlush()); // Sends what the last visit left unsent, and the moved data.
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
  if (!syncEnabled()) return;
  // Merges the server's rows for these videos into IndexedDB, keeping whichever is newer.
  // Videos already being pulled wait for that pull, so a video opened during the page pull still gets its data.
  const pending = videoIds.filter((id) => !app.state.sync.pulled.has(id));
  const inFlight = videoIds.filter((id) => app.state.sync.pulled.has(id)).map((id) => app.state.sync.pulled.get(id));
  const pulling = syncPullBatches(pending);
  pending.forEach((id) => app.state.sync.pulled.set(id, pulling));
  await Promise.all([pulling, ...inFlight]);
}

async function syncPullBatches(pending) {
  // Pulled rows can be older than the age limit, so they're written after the prune, not deleted by it.
  await app.state.sync.pruned;
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

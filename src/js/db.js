/**
 * IndexedDB wrapper
 *
 * Youlag's local data: DeArrow data, video durations, SponsorBlock segments, skipped chapters,
 * playback positions, watch history and the sync queue.
 *
 * - One database per FreshRSS user, 'yl-<user>', with one store for each kind of data.
 *   Users sharing a browser never see each other's data.
 * - Records are { value, timestamp, ttlMs, checkedAt? }. The TTL marks when data is due to be
 *   checked again, it never hides stored data (see dbIsFresh).
 * - Adding a store: add it to app.db.stores and bump app.db.version.
 */

const dbConnections = {};

function dbGetName() {
  // One database per FreshRSS user, so users sharing a browser keep their data apart. Anonymous reading shows the
  // default user's feeds but isn't that user, so it gets its own ("-anonymous" can't be a FreshRSS username).
  return `${app.db.prefix}-${syncEnabled() ? getSetting("yl_user") : "-anonymous"}`;
}

function dbOpen(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, app.db.version);
    request.onupgradeneeded = () => {
      // Creates the stores this version adds. Existing stores keep their data.
      const db = request.result;
      for (const storeName of app.db.stores) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Lets another tab upgrade the database. The next use reopens it, unless the upgrade came from a newer Youlag.
      db.onversionchange = (event) => {
        db.close();
        delete dbConnections[dbName];
        if (event.newVersion > app.db.version) dbMarkOutdated();
      };
      db.onclose = () => delete dbConnections[dbName];
      dbConnections[dbName] = db;
      resolve(db);
    };
    request.onblocked = () => {
      console.warn(`Youlag (DB): '${dbName}' upgrade waits for other tabs to close it.`);
    };
    request.onerror = () => {
      // A newer Youlag in another tab already upgraded the database.
      if (request.error?.name === "VersionError") dbMarkOutdated();
      console.error(`Youlag (DB): Failed to open IndexedDB '${dbName}':`, request.error);
      reject(request.error);
    };
  });
}

function dbMarkOutdated() {
  // This tab runs an older Youlag than the database, so it can't save until reloaded. Asks once.
  if (app.state.sync.dbOutdated) return;
  app.state.sync.dbOutdated = true;
  showNotification({
    title: "Youlag was updated",
    message: "Reload the page to keep saving your data.",
    action: "Reload",
    link: window.location.href,
    newTab: false,
    timeout: 0,
  });
}

async function dbGetConnection() {
  // Without a user, like on the login page, there's no data to keep, so no database is created.
  if (!getSetting("yl_user")) throw new Error("Youlag (DB): No user to open a database for.");
  const dbName = dbGetName();
  return dbConnections[dbName] || dbOpen(dbName);
}

async function dbSet(storeName, key, value, ttlWeeks = 4) {
  try {
    const db = await dbGetConnection();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      // Store value with TTL metadata (4 weeks default, configurable per operation)
      const dataWithMetadata = {
        value,
        timestamp: syncNow(),
        ttlMs: ttlWeeks * 7 * 24 * 60 * 60 * 1000,
      };

      const previous = store.get(key);
      previous.onsuccess = () => {
        // Newer than the value it replaces, so the server keeps it even after the clock offset changes. Not after a
        // value stamped far ahead by a wrong clock, which the endpoint refuses.
        const previousTimestamp = previous.result?.timestamp || 0;
        const aheadMs = previousTimestamp - dataWithMetadata.timestamp;
        if (aheadMs >= 0 && aheadMs < app.sync.maxAheadMs) {
          dataWithMetadata.timestamp = previousTimestamp + 1;
        }
        const req = store.put(dataWithMetadata, key);
        req.onerror = (e) => {
          console.error(
            `Youlag (DB): Failed to set key '${key}':`,
            e.target.error,
          );
          reject(e.target.error);
        };
      };

      tx.oncomplete = () => {
        syncMarkDirty(storeName, key, dataWithMetadata);
        resolve();
      };
      tx.onerror = () => {
        console.error(
          `Youlag (DB): Transaction error in dbSet for key '${key}':`,
          tx.error,
        );
        reject(tx.error);
      };
    });
  } catch (error) {
    if (app.state.sync.dbOutdated) {
      // Kept in memory, so the page-hide send still delivers it.
      syncMarkDirty(storeName, key, { value, timestamp: syncNow(), ttlMs: ttlWeeks * DB_WEEK_MS });
    }
    console.error(`Youlag (DB): dbSet error:`, error);
    throw error;
  }
}

async function dbGet(storeName, key) {
  try {
    const db = await dbGetConnection();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => {
        const data = req.result;
        resolve(dbIsFresh(data) ? data.value : undefined);
      };

      req.onerror = (e) => {
        console.error(
          `Youlag (DB): Failed to get key '${key}':`,
          e.target.error,
        );
        reject(e.target.error);
      };

      tx.onerror = () => {
        console.error(
          `Youlag (DB): Transaction error in dbGet for key '${key}':`,
          tx.error,
        );
        reject(tx.error);
      };
    });
  } catch (error) {
    console.error(`Youlag (DB): dbGet error:`, error);
    throw error;
  }
}

// Runs one request in its own transaction and resolves with its result once the transaction completes.
async function dbRun(storeName, mode, makeRequest) {
  const db = await dbGetConnection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = makeRequest(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

function dbGetRecord(storeName, key) {
  return dbRun(storeName, "readonly", (store) => store.get(key));
}

function dbPutRecord(storeName, key, record) {
  return dbRun(storeName, "readwrite", (store) => store.put(record, key));
}

function dbPutMany(storeName, entries) {
  return dbRun(storeName, "readwrite", (store) => {
    let req = null;
    for (const [key, record] of entries) req = store.put(record, key);
    return req || store.count();
  });
}

async function dbPutIfNewer(storeName, key, record) {
  // Writes the record unless the stored one is as new. Checked and written in one transaction, so a change saved
  // meanwhile is never replaced by an older one. Resolves whether it was written.
  const db = await dbGetConnection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    let written = false;
    const req = store.get(key);
    req.onsuccess = () => {
      if ((req.result?.timestamp || 0) >= record.timestamp) return;
      store.put(record, key);
      written = true;
    };
    tx.oncomplete = () => resolve(written);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPutIfUnchanged(storeName, key, record, expectedTimestamp) {
  // Writes the record only if the stored one still has the timestamp read earlier (none stored: none expected), so
  // a newer record saved or pulled meanwhile is kept. Checked and written in one transaction.
  const db = await dbGetConnection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => {
      if ((req.result?.timestamp || 0) === (expectedTimestamp || 0)) store.put(record, key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPutManyIfNewer(storeName, entries) {
  // Like dbPutIfNewer() for many records in one transaction. Resolves the keys it wrote.
  const db = await dbGetConnection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const written = [];
    for (const [key, record] of entries) {
      const req = store.get(key);
      req.onsuccess = () => {
        if ((req.result?.timestamp || 0) >= record.timestamp) return;
        store.put(record, key);
        written.push(key);
      };
    }
    tx.oncomplete = () => resolve(written);
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(storeName, key) {
  return dbRun(storeName, "readwrite", (store) => store.delete(key));
}

function dbClear(storeName) {
  return dbRun(storeName, "readwrite", (store) => store.clear());
}

function dbGetAllKeys(storeName) {
  return dbRun(storeName, "readonly", (store) => store.getAllKeys());
}

async function dbGetAllEntries(storeName) {
  const entries = [];
  await dbRun(
    storeName,
    "readonly",
    (store) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        entries.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      return req;
    },
  );
  return entries;
}

const DB_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function dbIsFresh(record) {
  // Fresh until the TTL passes since the value was last confirmed. A TTL of 0 never expires.
  if (!record) return false;
  if (!record.ttlMs) return true;
  return syncNow() - (record.checkedAt || record.timestamp) <= record.ttlMs;
}

async function dbSetIfChanged(storeName, key, value, previous, ttlWeeks) {
  // Saves and syncs only a changed value. An unchanged value is marked as confirmed locally.
  if (previous && JSON.stringify(previous.value) === JSON.stringify(value)) {
    const confirmed = { ...previous, ttlMs: ttlWeeks * DB_WEEK_MS, checkedAt: syncNow() };
    return dbPutIfUnchanged(storeName, key, confirmed, previous.timestamp);
  }
  return dbSet(storeName, key, value, ttlWeeks);
}

function dbDeleteOlderThan(storeName, before) {
  // Deletes the records last changed before the given time, in one transaction.
  return dbRun(storeName, "readwrite", (store) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if ((cursor.value?.timestamp || 0) < before) cursor.delete();
      cursor.continue();
    };
    return req;
  });
}

async function dbPruneUnqueued(storeName, before) {
  // Deletes records last changed or confirmed before the given time, unless they wait in the sync queue.
  // One transaction over both stores, so a record written or queued meanwhile is never deleted.
  const db = await dbGetConnection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName, app.sync.queueStore], "readwrite");
    const queueReq = tx.objectStore(app.sync.queueStore).getAllKeys();
    queueReq.onsuccess = () => {
      const queued = new Set(queueReq.result);
      const cursorReq = tx.objectStore(storeName).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const record = cursor.value;
        if ((record?.checkedAt || record?.timestamp || 0) < before && !queued.has(`${storeName}:${cursor.key}`)) {
          cursor.delete();
        }
        cursor.continue();
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDropQueuedMissing(storeNames) {
  // Drops queued keys of these stores whose record is gone, and their unsent copies. Checked and dropped in one
  // transaction, so a record saved again meanwhile keeps its queue entry.
  const unsentBefore = new Map(app.state.sync.unsent);
  const dropped = await dbGetConnection()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction([...storeNames, app.sync.queueStore], "readwrite");
          const queue = tx.objectStore(app.sync.queueStore);
          const keys = [];
          const keysReq = queue.getAllKeys();
          keysReq.onsuccess = () => {
            for (const queueKey of keysReq.result) {
              const separator = queueKey.indexOf(":");
              const storeName = queueKey.slice(0, separator);
              if (!storeNames.includes(storeName)) continue;
              const recordReq = tx.objectStore(storeName).getKey(queueKey.slice(separator + 1));
              recordReq.onsuccess = () => {
                if (recordReq.result !== undefined) return;
                queue.delete(queueKey);
                keys.push(queueKey);
              };
            }
          };
          tx.oncomplete = () => resolve(keys);
          tx.onerror = () => reject(tx.error);
        }),
    )
    .catch(() => []);
  for (const queueKey of dropped) {
    // A change saved since the check replaced the unsent copy, and stays.
    if (app.state.sync.unsent.get(queueKey) === unsentBefore.get(queueKey)) {
      app.state.sync.unsent.delete(queueKey);
    }
  }
}

function dbDeleteIfUnchanged(storeName, key, expected) {
  // Deletes the record only if it still holds the expected value, checked and deleted in one transaction.
  return dbRun(storeName, "readwrite", (store) => {
    const req = store.get(key);
    req.onsuccess = () => {
      if (req.result === expected) store.delete(key);
    };
    return req;
  });
}

function dbReadLegacy(dbName, storeName) {
  // Reads a database from before databases were per user. Resolves empty, without creating it, when it doesn't exist.
  // Rejects when it can't be read, so the migration keeps it for the next visit.
  return new Promise((resolve, reject) => {
    let missing = false;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction.abort();
    };
    request.onerror = () => (missing ? resolve([]) : reject(request.error));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve([]);
        return;
      }
      const entries = [];
      const tx = db.transaction(storeName, "readonly");
      const cursorReq = tx.objectStore(storeName).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        entries.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve(entries);
      };
      const fail = () => {
        db.close();
        reject(tx.error || new Error(`Youlag (DB): Couldn't read '${dbName}'.`));
      };
      tx.onerror = fail;
      tx.onabort = fail;
    };
  });
}

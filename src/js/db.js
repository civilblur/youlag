/**
 * IndexedDB wrapper for caching
 * Primarily for storing dearrow data, to reduce API calls.
 *
 * Features:
 * - Connection caching for efficiency
 * - TTL-based expiration (4 weeks default, configurable per operation)
 *   - youlag-cache-dearrow: Stores dearrow API responses for 4 weeks.
 *   - youlag-cache-duration: Stores video duration for 52 weeks (1y).
 *   - youlag-cache-sponsorblock: Stores SponsorBlock segments for 1 week.
 * - Proper transaction error handling
 * - Each store gets its own database: '{app.db.name}-{storeName}' (e.g. 'youlag-cache-dearrow').
 *   This sidesteps IndexedDB versioning — no version bump needed when adding new stores.
 *
 * Usage:
 *   await dbSet('dearrow', videoId, data);              // Store data for a videoId (4-week TTL)
 *   await dbSet('dearrow', videoId, data, 4);           // Store with custom 4-week TTL
 *   await dbGet('dearrow', videoId);                    // Retrieve data (returns undefined if expired)
 *
 */

const dbConnections = {};

function dbGetName(storeName) {
  // Personal stores and the sync queue get one database per FreshRSS user, so users sharing a browser stay apart.
  const base = app?.db?.name || "youlag-cache";
  const user = getSetting("yl_user");
  return user && app.db.userStores.includes(storeName)
    ? `${base}-${user}-${storeName}`
    : `${base}-${storeName}`;
}

function dbOpen(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = function (event) {
      const db = event.target.result;
      dbConnections[dbName] = db; // Cache connection
      resolve(db);
    };
    request.onerror = function (event) {
      console.error(
        `Youlag (DB): Failed to open IndexedDB '${dbName}':`,
        event.target.error,
      );
      reject(event.target.error);
    };
  });
}

// Return cached connection if available, otherwise open
async function dbGetConnection(dbName, storeName) {
  if (dbConnections[dbName]) {
    return dbConnections[dbName];
  }
  return await dbOpen(dbName, storeName);
}

async function dbSet(storeName, key, value, ttlWeeks = 4) {
  try {
    const dbName = dbGetName(storeName);
    const db = await dbGetConnection(dbName, storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      // Store value with TTL metadata (4 weeks default, configurable per operation)
      const dataWithMetadata = {
        value,
        timestamp: Date.now(),
        ttlMs: ttlWeeks * 7 * 24 * 60 * 60 * 1000,
      };

      const req = store.put(dataWithMetadata, key);

      req.onerror = (e) => {
        console.error(
          `Youlag (DB): Failed to set key '${key}':`,
          e.target.error,
        );
        reject(e.target.error);
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
    console.error(`Youlag (DB): dbSet error:`, error);
    throw error;
  }
}

async function dbGet(storeName, key) {
  try {
    const dbName = dbGetName(storeName);
    const db = await dbGetConnection(dbName, storeName);

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
async function dbRun(storeName, mode, makeRequest, dbName = dbGetName(storeName)) {
  const db = await dbGetConnection(dbName, storeName);
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

function dbDelete(storeName, key) {
  return dbRun(storeName, "readwrite", (store) => store.delete(key));
}

function dbClear(storeName) {
  return dbRun(storeName, "readwrite", (store) => store.clear());
}

function dbGetAllKeys(storeName) {
  return dbRun(storeName, "readonly", (store) => store.getAllKeys());
}

async function dbGetAllEntries(storeName, dbName = dbGetName(storeName)) {
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
    dbName,
  );
  return entries;
}

const DB_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function dbIsFresh(record) {
  // Fresh until the TTL passes since the value was last confirmed. A TTL of 0 never expires.
  if (!record) return false;
  if (!record.ttlMs) return true;
  return Date.now() - (record.checkedAt || record.timestamp) <= record.ttlMs;
}

async function dbSetIfChanged(storeName, key, value, previous, ttlWeeks) {
  // Saves and syncs only a changed value. An unchanged value is marked as confirmed locally.
  if (previous && JSON.stringify(previous.value) === JSON.stringify(value)) {
    return dbPutRecord(storeName, key, {
      ...previous,
      ttlMs: ttlWeeks * DB_WEEK_MS,
      checkedAt: Date.now(),
    });
  }
  return dbSet(storeName, key, value, ttlWeeks);
}

/**
 * IndexedDB wrapper for caching
 * Primarily for storing dearrow data, to reduce API calls.
 *
 * Features:
 * - Connection caching for efficiency
 * - TTL-based expiration (4 weeks default, configurable per operation)
 *   - youlag-cache-dearrow: Stores dearrow API responses for 4 weeks.
 *   - youlag-cache-duration: Stores video duration for 52 weeks (1y).
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
    const dbName = `${app?.db?.name || "youlag-cache"}-${storeName}`;
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

      tx.oncomplete = () => resolve();
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
    const dbName = `${app?.db?.name || "youlag-cache"}-${storeName}`;
    const db = await dbGetConnection(dbName, storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => {
        const data = req.result;

        // Check if data has expired
        if (data && data.timestamp && data.ttlMs) {
          const age = Date.now() - data.timestamp;
          if (age > data.ttlMs) {
            // Data expired
            resolve(undefined);
            return;
          }
        }

        resolve(data?.value);
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

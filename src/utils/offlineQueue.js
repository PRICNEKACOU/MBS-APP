/**
 * Queue hors-ligne basée sur IndexedDB.
 * Remplace localStorage (limité ~5MB) pour supporter des volumes importants.
 * API async, transparente pour le store Zustand.
 */

const DB_NAME    = 'mbs_offline_db';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    };
    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(e.target.error);
  });
}

/** Ajoute une entrée à la queue. */
export async function enqueueOffline(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/** Retourne toutes les entrées en attente. */
export async function getAllOffline() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Vide entièrement la queue (succès). */
export async function clearOfflineQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/**
 * Remplace le contenu de la queue (ex: après sync partielle).
 * @param {Array} entries - Entrées qui ont échoué et doivent rester en queue.
 */
export async function setOfflineQueue(entries) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    entries.forEach(e => store.add(e));
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

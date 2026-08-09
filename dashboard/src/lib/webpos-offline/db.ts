/**
 * Minimal IndexedDB wrapper for WebPOS offline (no external deps).
 */

export type StoreName = 'meta' | 'catalog' | 'outbox';

const DB_NAME = 'manupos_webpos_offline_v1';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'clientId' });
        store.createIndex('byStatusCreated', ['status', 'createdAt'], { unique: false });
        store.createIndex('byCreated', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    const txDone = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
    const result = req ? await requestToPromise(req) : undefined;
    await txDone;
    return result;
  } finally {
    db.close();
  }
}

export async function idbGet<T>(storeName: StoreName, key: string): Promise<T | null> {
  try {
    const result = await withStore<T | undefined>(storeName, 'readonly', (store) => store.get(key));
    return (result as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function idbPut(storeName: StoreName, value: unknown): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => {
    store.put(value);
  });
}

export async function idbDelete(storeName: StoreName, key: string): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => {
    store.delete(key);
  });
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  try {
    const result = await withStore<T[]>(storeName, 'readonly', (store) => store.getAll());
    return (result as T[]) || [];
  } catch {
    return [];
  }
}

export async function idbClear(storeName: StoreName): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => {
    store.clear();
  });
}

export async function metaGet<T>(key: string): Promise<T | null> {
  const row = await idbGet<{ key: string; value: T }>('meta', key);
  return row ? row.value : null;
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await idbPut('meta', { key, value });
}

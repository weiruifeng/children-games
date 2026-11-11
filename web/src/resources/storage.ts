export const RESOURCE_CACHE = 'garden-resources-v1';
export const SHELL_CACHE = 'garden-shell-v1';
const DB = 'garden-resource-cache';
let database: Promise<IDBDatabase> | undefined;
async function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('metadata');
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        database = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      database = undefined;
      reject(r.error);
    };
    r.onblocked = () => reject(Error('资源索引暂不可用'));
  }));
}
export async function putMeta(key: string, value: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction('metadata', 'readwrite');
    t.objectStore('metadata').put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export async function deleteMeta(key: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction('metadata', 'readwrite');
    t.objectStore('metadata').delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function allMeta<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('metadata'),
      r = t.objectStore('metadata').openCursor(),
      rows: Array<{ key: string; value: T }> = [];
    r.onsuccess = () => {
      const c = r.result;
      if (!c) {
        resolve(rows);
        return;
      }
      if (String(c.key).startsWith(prefix)) rows.push({ key: String(c.key), value: c.value });
      c.continue();
    };
    r.onerror = () => reject(r.error);
  });
}
export interface Lease {
  urls: string[];
  releaseId: string;
  expires: number;
}
export async function protectedUrls() {
  const urls = new Set<string>();
  for (const { key, value } of await allMeta<Lease>('lease:')) {
    if (value.expires > Date.now()) value.urls.forEach((s) => urls.add(s));
    else await deleteMeta(key);
  }
  return urls;
}

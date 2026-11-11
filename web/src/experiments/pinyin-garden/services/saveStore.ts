import { parseProfile, type Profile } from '@children-games/shared';
// One writer per origin prevents an older tab from replacing a newer checkpoint.
const globalGuard = globalThis as typeof globalThis & {
  __gardenWriter?: { promise: Promise<boolean> | null; owns: boolean | undefined };
};
const guard = (globalGuard.__gardenWriter ??= { promise: null, owns: undefined });
async function canWrite(): Promise<boolean> {
  return (guard.promise ??= new Promise((resolve) => {
    if (!navigator.locks) {
      guard.owns = true;
      resolve(true);
      return;
    }
    void navigator.locks
      .request('pinyin-garden-profile-writer', { ifAvailable: true }, async (lock) => {
        guard.owns = !!lock;
        resolve(!!lock);
        if (lock) await new Promise<void>(() => {});
      })
      .catch(() => {
        guard.owns = false;
        resolve(false);
      });
  }));
}
async function requireWriter() {
  if (!(await canWrite()))
    throw Error('另一个花园页面正在保存。请关闭其他花园页后刷新；本页修改未覆盖存档。');
}
const recoveryKey = (slot: number) => `pinyin-garden-v3-recovery-${slot}`;
const legacyRecoveryKey = (slot: number) => `pinyin-garden-recovery-${slot}`;
export function writeProfileRecovery(slot: number, p: Profile) {
  if (guard.owns === false) throw Error('另一页面正在保存，请关闭其他花园页后刷新。');
  localStorage.setItem(recoveryKey(slot), JSON.stringify(p));
}
let database: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('pinyin-garden', 3);
    req.onupgradeneeded = () => {
      for (const name of ['profiles', 'profilesV2', 'profilesV3', 'migrationArchives'])
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => {
      const store = req.result;
      store.onversionchange = () => {
        store.close();
        database = null;
      };
      resolve(store);
    };
    req.onerror = () => {
      database = null;
      reject(req.error);
    };
    req.onblocked = () => {
      database = null;
      reject(new Error('请关闭旧版花园页面后重试，原始存档仍然保留。'));
    };
  }));
}
export async function loadProfileSlots(): Promise<{
  profiles: (Profile | null)[];
  errors: Record<number, string>;
}> {
  const writable = await canWrite();
  const rows = await exportRawProfiles(),
    errors: Record<number, string> = {};
  const profiles = await Promise.all(
    rows.map(async (raw, i) => {
      if (raw === null) return null;
      let parsed: Profile;
      try {
        parsed = parseProfile(raw);
      } catch {
        errors[i] = '存档需要修复，请先导出备份';
        return null;
      }
      if (
        writable &&
        raw &&
        typeof raw === 'object' &&
        'version' in raw &&
        (raw.version === 1 ||
          raw.version === 2 ||
          ('packVersion' in raw && raw.packVersion !== parsed.packVersion))
      ) {
        try {
          const store = await db();
          await new Promise<void>((resolve, reject) => {
            const tx = store.transaction(['migrationArchives', 'profilesV3'], 'readwrite');
            tx.oncomplete = () => {
              if (localStorage.getItem(recoveryKey(i)) === JSON.stringify(raw))
                localStorage.removeItem(recoveryKey(i));
              resolve();
            };
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error ?? new Error('迁移事务中断'));
            try {
              tx.objectStore('migrationArchives').put(
                raw,
                `${i}:v${raw.version}${raw.version === 3 && 'packVersion' in raw ? ':' + raw.packVersion : ''}`,
              );
              tx.objectStore('profilesV3').put(parsed, i);
            } catch (e) {
              tx.abort();
              reject(e);
            }
          });
        } catch {
          errors[i] = '迁移暂未完成，原存档未改动。请检查存储空间并重试，或先导出原始备份。';
          return null;
        }
      }
      return parsed;
    }),
  );
  return { profiles, errors };
}
export async function loadProfiles(): Promise<(Profile | null)[]> {
  const result = await loadProfileSlots();
  if (Object.keys(result.errors).length) throw new Error('部分存档无法读取，请先导出备份');
  return result.profiles;
}
export async function saveProfile(
  slot: number,
  profile: Profile,
  journalWritten = false,
): Promise<void> {
  await requireWriter();
  const parsed = parseProfile(profile);
  if (!journalWritten) writeProfileRecovery(slot, parsed);
  const saved = JSON.stringify(profile);
  const store = await db();
  return new Promise((resolve, reject) => {
    const tx = store.transaction('profilesV3', 'readwrite');
    tx.objectStore('profilesV3').put(parsed, slot);
    tx.oncomplete = () => {
      if (localStorage.getItem(recoveryKey(slot)) === saved)
        localStorage.removeItem(recoveryKey(slot));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('保存中断'));
  });
}
export async function clearProfile(slot: number): Promise<void> {
  await requireWriter();
  const store = await db();
  return new Promise((resolve, reject) => {
    const tx = store.transaction('profilesV3', 'readwrite');
    tx.objectStore('profilesV3').put(null, slot);
    tx.oncomplete = () => {
      localStorage.removeItem(recoveryKey(slot));
      localStorage.removeItem(legacyRecoveryKey(slot));
      localStorage.removeItem(`pinyin-garden-v2-recovery-${slot}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function exportRawProfiles(): Promise<unknown[]> {
  const store = await db();
  return Promise.all(
    [0, 1, 2].map(
      (i) =>
        new Promise<unknown>((resolve, reject) => {
          const recovery = localStorage.getItem(recoveryKey(i));
          if (recovery) {
            try {
              resolve(JSON.parse(recovery));
            } catch {
              resolve({ invalidRecovery: recovery });
            }
            return;
          }
          const req = store.transaction('profilesV3').objectStore('profilesV3').get(i);
          req.onsuccess = () => {
            if (req.result !== undefined) {
              resolve(req.result);
              return;
            }
            const oldRecovery =
              localStorage.getItem(`pinyin-garden-v2-recovery-${i}`) ??
              localStorage.getItem(legacyRecoveryKey(i));
            if (oldRecovery) {
              try {
                resolve(JSON.parse(oldRecovery));
              } catch {
                resolve({ invalidRecovery: oldRecovery });
              }
              return;
            }
            const v2 = store.transaction('profilesV2').objectStore('profilesV2').get(i);
            v2.onsuccess = () => {
              if (v2.result !== undefined) {
                resolve(v2.result);
                return;
              }
              const old = store.transaction('profiles').objectStore('profiles').get(i);
              old.onsuccess = () => resolve(old.result ?? null);
              old.onerror = () => reject(old.error);
            };
            v2.onerror = () => reject(v2.error);
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
}

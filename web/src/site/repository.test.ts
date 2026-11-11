import {
  parseCloudProfile,
  type CloudSlot,
  type LearningEvent,
  type MutationResult,
} from '@children-games/shared';
import 'fake-indexeddb/auto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { newProfile } from '@children-games/shared';
import { GardenRepository } from './repository';
import * as localStorageDb from './local';
import { api, ApiError } from './api';
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, api: vi.fn() };
});
let repo: GardenRepository;
let slots: CloudSlot[];
let events: LearningEvent[][];
let committed = new Map<string, MutationResult>();
let lose = false;
beforeEach(async () => {
  slots = [0, 1, 2].map((slot) => ({
    slot: slot + 1,
    profileId: 'p' + slot,
    revision: 0,
    generation: 0,
    profile: null,
    updatedAt: new Date().toISOString(),
  }));
  events = [[], [], []];
  committed = new Map();
  lose = false;
  vi.mocked(api).mockImplementation(async (path, input: unknown, method) => {
    const body = input as
      | { events: LearningEvent[]; mutationId: string; baseRevision: number; profile: unknown }
      | undefined;
    const m = /profiles\/(\d)/.exec(path);
    const i = Number(m?.[1] ?? 1) - 1;
    if (path.includes('/events')) {
      if (body) {
        events[i].push(
          ...body.events.filter(
            (e: LearningEvent) => !events[i].some((old) => old.eventId === e.eventId),
          ),
        );
        return { accepted: body.events.map((e: LearningEvent) => e.eventId) };
      }
      return { items: events[i].map((e) => ({ ...e, generation: 0 })), nextCursor: null };
    }
    if (method === 'PUT' && body) {
      if (committed.has(body.mutationId)) return committed.get(body.mutationId);
      if (body.baseRevision !== slots[i].revision)
        throw new ApiError(409, 'REVISION_CONFLICT', 'conflict');
      slots[i] = {
        ...slots[i],
        profile: parseCloudProfile(body.profile),
        revision: slots[i].revision + 1,
      };
      const result = { revision: slots[i].revision, generation: 0, updatedAt: slots[i].updatedAt };
      committed.set(body.mutationId, result);
      if (lose) {
        lose = false;
        throw Error('network response lost');
      }
      return result;
    }
    if (path.includes('/archives')) return { archiveId: 'archive' };
    return structuredClone(slots[i]);
  });
  repo = new GardenRepository(crypto.randomUUID());
  await repo.start();
  await repo.loadProfileSlots();
});
afterEach(async () => {
  await repo.dispose();
  vi.clearAllMocks();
});
it('preserves in-flight identity when commit response is lost', async () => {
  await repo.saveProfile(0, newProfile('A'));
  lose = true;
  await repo.flush();
  expect(repo.status).toBe('offline');
  await repo.retry();
  expect(slots[0].revision).toBe(1);
  expect(repo.status).toBe('synced');
});
it('does not overwrite a competing revision', async () => {
  await repo.saveProfile(0, newProfile('A'));
  slots[0].revision = 1;
  await repo.flush();
  expect(repo.status).toBe('conflict');
  expect(repo.conflicts.has(0)).toBe(true);
  expect(slots[0].profile).toBeNull();
});
it('uploads events independently and deduplicates repeat saves', async () => {
  const p = newProfile('A');
  p.attempts = [
    {
      taskId: 't',
      entryId: 'symbol-a',
      syllable: 0,
      at: 1,
      correct: true,
      assisted: false,
      repeated: false,
    },
  ];
  await repo.saveProfile(0, p);
  await repo.flush();
  await repo.saveProfile(0, p);
  await repo.flush();
  expect(events[0]).toHaveLength(1);
  expect(slots[0].profile).not.toHaveProperty('attempts');
});
it('isolates local accounts and refuses stale owner writes', async () => {
  const other = new GardenRepository(repo.userId);
  await expect(other.start()).rejects.toThrow();
  await other.dispose();
  await repo.saveProfile(0, newProfile('private'));
  expect((await repo.exportRawProfiles())[0]?.name).toBe('private');
});
it('retains a new local save when an older request finishes', async () => {
  const base = vi.mocked(api).getMockImplementation()!;
  let release: () => void = () => {};
  let sent: () => void = () => {};
  const started = new Promise<void>((resolve) => (sent = resolve));
  vi.mocked(api).mockImplementation(async (p, b, m) => {
    if (m === 'PUT') {
      sent();
      await new Promise<void>((resolve) => (release = resolve));
    }
    return base(p, b, m);
  });
  await repo.saveProfile(0, newProfile('first'));
  const flight = repo.flush();
  await started;
  await repo.saveProfile(0, newProfile('second'));
  release();
  await flight;
  expect((await repo.exportRawProfiles())[0]?.name).toBe('second');
  vi.mocked(api).mockImplementation(base);
  await repo.flush();
  expect(slots[0].profile!.name).toBe('second');
});
it('leaves unrelated cloud data intact on empty reads', async () => {
  expect(slots.every((r) => r.revision === 0)).toBe(true);
  expect(vi.mocked(api).mock.calls.some(([, , method]) => method === 'PUT')).toBe(false);
});

it('drains an accepted local write before releasing the account session', async () => {
  const uid = repo.userId,
    original = localStorageDb.ownedAtomic;
  let release: () => void = () => {},
    started: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve)),
    writing = new Promise<void>((resolve) => (started = resolve));
  const spy = vi.spyOn(localStorageDb, 'ownedAtomic').mockImplementationOnce(async (...args) => {
    started();
    await gate;
    await original(...args);
  });
  try {
    const save = repo.saveProfile(0, newProfile('drained'));
    await writing;
    const close = repo.dispose();
    release();
    await save;
    await close;
    await expect(repo.saveProfile(1, newProfile('late'))).rejects.toThrow(/退出/);
    repo = new GardenRepository(uid);
    await repo.start();
    expect((await repo.loadProfileSlots()).profiles[0]?.name).toBe('drained');
  } finally {
    release();
    spy.mockRestore();
  }
});
it('stops when the session expires and preserves the pending snapshot', async () => {
  await repo.saveProfile(0, newProfile('pending'));
  const base = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation(async (p, b, m) => {
    if (m === 'PUT') throw new ApiError(401, 'ACCOUNT_CHANGED', 'account changed');
    return base(p, b, m);
  });
  await repo.flush();
  expect(repo.status).toBe('auth-required');
  expect((await repo.exportRawProfiles())[0]?.name).toBe('pending');
  expect(
    vi
      .mocked(api)
      .mock.calls.filter(([, , method]) => method === 'PUT')
      .every((call) => call[3] === repo.userId),
  ).toBe(true);
});
it('does not apply valid lines from a backup with a later invalid record', async () => {
  await repo.saveProfile(0, newProfile('original'));
  await repo.flush();
  const header = { format: 'garden-backup', version: 1, slot: slots[0] };
  const event = {
    eventId: 'staged',
    packVersion: 'garden-adventure-4',
    generation: 0,
    attempt: {
      taskId: 'staged',
      entryId: 'symbol-a',
      syllable: 0,
      at: 1,
      correct: true,
      assisted: false,
      repeated: false,
    },
  };
  const file = new File(
    [
      JSON.stringify(header) +
        '\n' +
        JSON.stringify({ event }) +
        '\n' +
        JSON.stringify({ event: { invalid: true } }),
    ],
    'bad.ndjson',
  );
  await expect(repo.importFile(0, file)).rejects.toThrow();
  await repo.flush();
  expect(events[0]).toHaveLength(0);
  expect(slots[0].profile!.name).toBe('original');
});
it('round trips 45,000 events without putting full history in hot snapshots', async () => {
  const base = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation(async (p, b, m, u) =>
    p === '/garden/archives' && !b ? { items: [] } : base(p, b, m, u),
  );
  const p = newProfile('large');
  p.attempts = Array.from({ length: 45000 }, (_, i) => ({
    eventId: 'event-' + i,
    taskId: 'task-' + i,
    entryId: 'symbol-a',
    syllable: 0,
    at: i,
    correct: true,
    assisted: false,
    repeated: false,
  }));
  const start = performance.now();
  await repo.saveProfile(0, p);
  await repo.flush();
  expect(events[0]).toHaveLength(45000);
  const { blob, complete } = await repo.createBackupBlob(0);
  expect(complete).toBe(true);
  expect(JSON.stringify(slots[0].profile).length).toBeLessThan(10000);
  await repo.importFile(1, new File([blob], 'large.ndjson'));
  expect(events[1]).toHaveLength(45000);
  expect(repo.summaries.get(0)?.total).toBe(45000);
  console.log(
    JSON.stringify({
      sample: 45000,
      backupBytes: blob.size,
      elapsedMs: Math.round(performance.now() - start),
      snapshotBytes: JSON.stringify(slots[0].profile).length,
    }),
  );
}, 60000);
it('honors rate-limit cooldown and retains oversized or unsupported pending data', async () => {
  await repo.saveProfile(0, newProfile('retained'));
  const base = vi.mocked(api).getMockImplementation()!;
  let writes = 0;
  vi.mocked(api).mockImplementation(async (p, b, m, u) => {
    if (m === 'PUT') {
      writes++;
      throw new ApiError(429, 'RATE_LIMITED', 'wait', undefined, 60);
    }
    return base(p, b, m, u);
  });
  await repo.flush();
  await repo.flush();
  expect(writes).toBe(1);
  expect(repo.status).toBe('offline');
  for (const status of [413, 422]) {
    vi.mocked(api).mockImplementation(async (p, b, m, u) => {
      if (m === 'PUT') throw new ApiError(status, 'REJECTED', 'export required');
      return base(p, b, m, u);
    });
    await repo.retry();
    expect(repo.status).toBe('error');
    expect((await repo.exportRawProfiles())[0]?.name).toBe('retained');
  }
});
it('keeps new recovery journals when an older local commit completes', async () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  try {
    const old = newProfile('old'),
      next = newProfile('next');
    repo.writeProfileRecovery(0, old);
    repo.writeProfileRecovery(0, next);
    await repo.saveProfile(0, old);
    expect(data.size).toBe(1);
    expect([...data.values()][0]).toContain('next');
    await repo.saveProfile(0, next);
    expect(data.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
it('restores a synchronous journal into the matching account only', async () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  try {
    repo.writeProfileRecovery(0, newProfile('recovered'));
    const uid = repo.userId;
    await repo.dispose();
    repo = new GardenRepository(uid);
    await repo.start();
    const result = await repo.loadProfileSlots();
    expect(result.profiles[0]?.name).toBe('recovered');
    await repo.flush();
    expect(slots[0].profile!.name).toBe('recovered');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps the recovery journal and rejects a local quota failure', async () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  const spy = vi
    .spyOn(localStorageDb, 'ownedAtomic')
    .mockRejectedValueOnce(new DOMException('quota', 'QuotaExceededError'));
  try {
    const p = newProfile('uncommitted');
    repo.writeProfileRecovery(0, p);
    await expect(repo.saveProfile(0, p)).rejects.toThrow('quota');
    expect(data.size).toBe(1);
    expect(slots[0].profile).toBeNull();
  } finally {
    spy.mockRestore();
    vi.unstubAllGlobals();
  }
});

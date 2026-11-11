import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceManager, abortable, verify, sha256, catalog } from './manager';
import { createCharacterGarden, CHARACTER_LEVELS } from '@children-games/shared';
import { battleImages, battleSpeech } from './groups';
import { indexedDB } from 'fake-indexeddb';
import type { Catalog } from './types';
const data = new Uint8Array([1, 2, 3]);
let fixture: Catalog;
beforeEach(async () => {
  fixture = {
    schemaVersion: 1,
    releaseId: 'test',
    appBuildId: 'build',
    contentVersion: 'garden-adventure-4',
    resources: {
      '/assets/pinyin-garden/a.mp3': {
        id: '/assets/pinyin-garden/a.mp3',
        url: '/assets/garden/files/test.mp3',
        type: 'audio',
        mime: 'audio/mpeg',
        sha256: await sha256(data),
        bytes: 3,
      },
    },
    groups: { all: ['/assets/pinyin-garden/a.mp3'] },
    budgets: {},
  };
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('caches', undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe('resource correctness boundaries', () => {
  it('rejects truncated or changed content', async () => {
    await expect(
      verify(fixture.resources['/assets/pinyin-garden/a.mp3'], data),
    ).resolves.toBeUndefined();
    await expect(
      verify(fixture.resources['/assets/pinyin-garden/a.mp3'], new Uint8Array([1, 2])),
    ).rejects.toThrow();
    await expect(
      verify(fixture.resources['/assets/pinyin-garden/a.mp3'], new Uint8Array([1, 2, 4])),
    ).rejects.toThrow();
  });
  it('deduplicates two real consumers; cancelling one preserves the other', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    const fetch = vi.fn(async () => {
      await gate;
      return new Response(data, { headers: { 'Content-Type': 'audio/mpeg' } });
    });
    vi.stubGlobal('fetch', fetch);
    const m = new ResourceManager(fixture),
      other = new ResourceManager(fixture),
      cancel = new AbortController(),
      a = m.prepare(m.group('all'), { signal: cancel.signal }),
      b = other.prepare(other.group('all'));
    cancel.abort();
    await expect(a).rejects.toMatchObject({ name: 'AbortError' });
    finish();
    const release = await b;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await m.bytes('/assets/pinyin-garden/a.mp3')).toEqual(data.buffer);
    release();
  });
  it('does not let delayed successes overwrite a failed group', async () => {
    const bad = {
      ...fixture.resources['/assets/pinyin-garden/a.mp3'],
      id: '/assets/pinyin-garden/b.mp3',
      sha256: 'bad',
      url: '/assets/garden/files/b.mp3',
    };
    fixture.resources[bad.id] = bad;
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/b.mp3')) return new Response('missing', { status: 404 });
        await gate;
        return new Response(data, { headers: { 'Content-Type': 'audio/mpeg' } });
      }),
    );
    const progress = vi.fn(),
      m = new ResourceManager(fixture);
    await expect(
      m.prepare(Object.keys(fixture.resources), { onProgress: progress }),
    ).rejects.toThrow('404');
    const calls = progress.mock.calls.length;
    finish();
    await new Promise((r) => setTimeout(r, 20));
    expect(progress).toHaveBeenCalledTimes(calls);
  });
  it('supports a caller abort without turning shared work into a success', async () => {
    const c = new AbortController();
    const p = abortable(new Promise<void>(() => {}), c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('derives speech from every wave and includes future enemies and damage layers', () => {
    const level = CHARACTER_LEVELS.find((l) => l.published && l.track === 'main')!;
    const state = createCharacterGarden(level.id);
    const speech = battleSpeech(state);
    expect(speech.length).toBeGreaterThan(0);
    for (const id of speech) expect(catalog.resources[id]?.type).toBe('audio');
    const images = battleImages(state);
    for (const part of ['enemy_scroll', 'vine_damage_heavy', 'paper_shell', 'projectile_cone'])
      expect(images.some((id) => id.includes(part))).toBe(true);
    expect(images.some((id) => id.includes('evening'))).toBe(false);
  });
});
describe('publication updates', () => {
  it('validates the pointer and manifest without replacing a live release', async () => {
    vi.stubGlobal('document', { hidden: true });
    const next = { ...fixture, releaseId: 'next', resources: { ...fixture.resources } };
    const file = next.resources['/assets/pinyin-garden/a.mp3'];
    file.url = '/assets/garden/files/' + file.sha256 + '.mp3';
    const manifest = new TextEncoder().encode(JSON.stringify(next));
    const pointer = {
      schemaVersion: 1,
      releaseId: 'next',
      appBuildId: 'next-build',
      url: '/assets/garden/manifests/next.json',
      sha256: await sha256(manifest),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/resource-release.json'
          ? Response.json(pointer)
          : new Response(manifest, { headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const m = new ResourceManager({ ...fixture, resources: {} });
    await m.checkUpdate(true);
    expect(m.status().newer).toBe('next');
    expect(m.catalog.releaseId).toBe('test');
  });
  it('rejects a changed manifest and preserves the current release', async () => {
    vi.stubGlobal('document', { hidden: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/resource-release.json'
          ? Response.json({
              schemaVersion: 1,
              releaseId: 'next',
              url: '/assets/garden/manifests/next.json',
              sha256: 'a'.repeat(64),
            })
          : Response.json({ schemaVersion: 1 }),
      ),
    );
    const m = new ResourceManager(fixture);
    await expect(m.checkUpdate(true)).rejects.toThrow('校验');
    expect(m.status().newer).toBeNull();
    expect(m.catalog.releaseId).toBe('test');
  });
});

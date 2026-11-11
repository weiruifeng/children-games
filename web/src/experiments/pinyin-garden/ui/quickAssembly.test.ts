import { describe, it, expect } from 'vitest';
import { createGarden, placePlant, startWave, ENTRY_MAP, tickGarden } from '@children-games/shared';
import { acquireTarget, placeAmmoPart, finishAssembly } from './quickAssembly';
function setup(word = false) {
  const s = createGarden(word ? 5 : 1);
  s.dew = 1000;
  startWave(s);
  placePlant(s, word ? 'plant_cone_launcher' : 'plant_pod_slinger', 1, 0);
  s.enemies.push({
    id: s.nextId++,
    kind: 'enemy_ink_blob',
    row: 1,
    x: 800,
    hp: 80,
    armor: 0,
    entryId: word ? 'word-1' : 'char-1',
    attackTimer: 0,
  });
  acquireTarget(s);
  return s;
}
describe('direct ammunition assembly', () => {
  it('waits for all pieces, then fires without confirmation', () => {
    const s = setup(),
      token = `${s.task!.key}:0`;
    placeAmmoPart(s, 'initial', 'm', token);
    placeAmmoPart(s, 'final', 'a', token);
    expect(s.attempts).toHaveLength(0);
    placeAmmoPart(s, 'tone', 3, token);
    expect(s.task?.finished).toBe(true);
    tickGarden(s, 0.01);
    expect(s.plants[0].firing).toBe(true);
    expect(s.score).toBe(150);
  });
  it('retains correct pieces after an incorrect tone and never fires the wrong answer', () => {
    const s = setup(),
      token = `${s.task!.key}:0`;
    placeAmmoPart(s, 'initial', 'm', token);
    placeAmmoPart(s, 'final', 'a', token);
    placeAmmoPart(s, 'tone', 1, token);
    expect(s.plants[0].ammo).toBe(0);
    expect(s.task!.parts.initial).toBe('m');
    expect(s.task!.parts.tone).toBe(1);
    expect(s.task!.parts.final).toBe('a');
    expect(s.hearts).toBe(3);
    placeAmmoPart(s, 'tone', 3, token);
    tickGarden(s, 0.01);
    expect(s.plants[0].firing).toBe(true);
    expect(s.score).toBe(100);
  });
  it('only fires a word after the final syllable and ignores stale drag releases', () => {
    const s = setup(true),
      t = s.task!,
      entry = ENTRY_MAP[t.entryId],
      token = `${t.key}:0`;
    t.parts = { ...entry.parts[0] };
    finishAssembly(s);
    expect(s.task!.index).toBe(1);
    expect(s.plants[0].ammo).toBe(0);
    placeAmmoPart(s, 'tone', 1, token);
    expect(s.task!.parts.tone).toBeNull();
    s.task!.parts = { ...entry.parts[1] };
    finishAssembly(s);
    expect(s.task?.finished).toBe(true);
    tickGarden(s, 0.01);
    expect(s.plants[0].firing).toBe(true);
  });
  it('does not submit while paused and automatically selects a compatible target', () => {
    const s = setup();
    expect(s.task).not.toBeNull();
    s.paused = true;
    s.task!.parts = { ...ENTRY_MAP[s.task!.entryId].parts[0] };
    finishAssembly(s);
    expect(s.attempts).toHaveLength(0);
  });
});

it('launches the first heavy projectile on the next frame even without a manual fire action', () => {
  const s = setup(true);
  s.task!.parts = { ...ENTRY_MAP[s.task!.entryId].parts[0] };
  finishAssembly(s);
  s.task!.parts = { ...ENTRY_MAP[s.task!.entryId].parts[1] };
  finishAssembly(s);
  expect(s.projectiles).toHaveLength(0);
  tickGarden(s, 1 / 60);
  expect(s.projectiles).toHaveLength(1);
  expect(s.events.some((e) => e.type === 'cone_launch')).toBe(true);
});

it('counts a continuous correction once, including switching away and restoring the task', async () => {
  const {
    selectKnowledge,
    parseLegacyProfile: parseProfile,
    legacyProfile: newProfile,
    resumeSnapshot,
  } = await import('@children-games/shared');
  const s = createGarden(3);
  startWave(s);
  selectKnowledge(s, 'char-8');
  const token = `${s.task!.key}:0`;
  placeAmmoPart(s, 'initial', 'b', token);
  placeAmmoPart(s, 'medial', 'i', token);
  placeAmmoPart(s, 'final', 'e', token);
  placeAmmoPart(s, 'tone', 2, token);
  placeAmmoPart(s, 'initial', 'h', token);
  expect(s.attempts).toHaveLength(1);
  selectKnowledge(s, 'char-1');
  selectKnowledge(s, 'char-8');
  const p = newProfile('测试');
  p.unlocked = 3;
  p.checkpoint = resumeSnapshot(s);
  const restored = parseProfile(JSON.parse(JSON.stringify(p))).checkpoint!;
  placeAmmoPart(restored, 'medial', 'u', token);
  placeAmmoPart(restored, 'final', 'a', token);
  placeAmmoPart(restored, 'tone', 1, token);
  expect(restored.attempts.map((a) => a.correct)).toEqual([false, true]);
  expect(restored.task!.errors).toBe(1);
  expect(restored.sharedAmmo).toContain('char-8');
});

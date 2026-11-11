import { describe, it, expect } from 'vitest';
import {
  createGarden,
  startWave,
  placePlant,
  removePlant,
  collectDrop,
  tickGarden,
} from './simulation';
import { cellX } from './model';
function game() {
  const s = createGarden();
  startWave(s);
  return s;
}
function drop(s: ReturnType<typeof game>, age = 0) {
  const d = { id: s.nextId++, x: 600, y: 300, age, value: 25 };
  s.drops.push(d);
  return d;
}
function collector(s: ReturnType<typeof game>) {
  expect(placePlant(s, 'plant_dew_collector', 1, 0)).toBe(true);
  return s.plants[0];
}
function advance(s: ReturnType<typeof game>, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) tickGarden(s, 0.1);
}
describe('dew requires a living collector', () => {
  it('cannot collect by clicking when no collector has been planted', () => {
    const s = game(),
      d = drop(s),
      before = s.dew;
    collectDrop(s, d.id);
    collectDrop(s, d.id);
    expect(s.dew).toBe(before);
    expect(s.drops).toContain(d);
    expect(s.events.filter((e) => e.type === 'dew_collect')).toHaveLength(0);
  });
  it('cannot collect after the last collector is shoveled, independently of its refund', () => {
    const s = game(),
      p = collector(s),
      d = drop(s);
    removePlant(s, p.id);
    const afterRefund = s.dew;
    collectDrop(s, d.id);
    expect(s.dew).toBe(afterRefund);
    expect(s.drops).toContain(d);
    expect(s.events.filter((e) => e.type === 'dew_collect')).toHaveLength(0);
  });
  it('expires old droplets without automatic income when no collector exists', () => {
    const s = game(),
      d = drop(s, 7.99),
      before = s.dew;
    tickGarden(s, 0.02);
    expect(s.dew).toBe(before);
    expect(s.drops).not.toContain(d);
    expect(s.events.filter((e) => e.type === 'dew_collect')).toHaveLength(0);
  });
  it('stops automatic income immediately after removing the last collector', () => {
    const s = game(),
      p = collector(s),
      d = drop(s, 7.99);
    removePlant(s, p.id);
    const before = s.dew;
    tickGarden(s, 0.02);
    expect(s.dew).toBe(before);
    expect(s.drops).not.toContain(d);
  });
  it('does not count a defeated collector or collect on its lethal damage frame', () => {
    const s = game(),
      p = collector(s),
      d = drop(s, 7.99),
      before = s.dew;
    p.hp = 20;
    s.enemies.push({
      id: s.nextId++,
      kind: 'enemy_ink_blob',
      row: 1,
      x: cellX(0) + 60,
      hp: 80,
      armor: 0,
      entryId: 'char-1',
      attackTimer: 1.19,
    });
    tickGarden(s, 0.02);
    expect(s.plants).toHaveLength(0);
    expect(s.dew).toBe(before);
    expect(s.drops).not.toContain(d);
  });
  it('collects exactly once with a living collector and retains normal feedback', () => {
    const s = game();
    collector(s);
    const d = drop(s),
      before = s.dew;
    collectDrop(s, d.id);
    collectDrop(s, d.id);
    expect(s.dew).toBe(before + 25);
    expect(s.drops).not.toContain(d);
    expect(s.events.filter((e) => e.type === 'dew_collect')).toHaveLength(1);
  });
  it('still collects automatically with a living collector', () => {
    const s = game();
    collector(s);
    const d = drop(s, 7.99),
      before = s.dew;
    tickGarden(s, 0.02);
    expect(s.dew).toBe(before + 25);
    expect(s.drops).not.toContain(d);
  });
  it('allows collection while another living collector remains', () => {
    const s = game(),
      first = collector(s);
    advance(s, 5.1);
    expect(placePlant(s, 'plant_dew_collector', 1, 1)).toBe(true);
    removePlant(s, first.id);
    const d = drop(s),
      before = s.dew;
    collectDrop(s, d.id);
    expect(s.dew).toBe(before + 25);
  });
  it('can collect a still-fresh droplet after planting a collector', () => {
    const s = game(),
      d = drop(s);
    collectDrop(s, d.id);
    collector(s);
    const before = s.dew;
    collectDrop(s, d.id);
    expect(s.dew).toBe(before + 25);
  });
  it('does not accumulate uncollectable natural drops or income', () => {
    const s = game(),
      before = s.dew;
    s.nextSpawn = 1e9;
    advance(s, 65);
    expect(s.dew).toBe(before);
    expect(s.drops.length).toBeLessThanOrEqual(1);
  });
  it('still respects pause, help and non-playing stages', () => {
    for (const mode of ['paused', 'help', 'ready', 'between', 'won', 'lost'] as const) {
      const s = game();
      collector(s);
      const d = drop(s),
        before = s.dew;
      if (mode === 'paused') s.paused = true;
      else if (mode === 'help') s.helpOpen = true;
      else s.stage = mode;
      collectDrop(s, d.id);
      expect(s.dew).toBe(before);
      expect(s.drops).toContain(d);
    }
  });
});

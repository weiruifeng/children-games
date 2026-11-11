import { describe, it, expect } from 'vitest';
import { createGarden, placePlant, startWave, cellX, rowY } from '@children-games/shared';
import { boardAction } from './boardInteraction';
describe('garden touch modes', () => {
  it('shovel ignores overlapping dew and enemies and only removes the partner', () => {
    const s = createGarden(3);
    startWave(s);
    placePlant(s, 'plant_pod_slinger', 1, 1);
    const x = cellX(1),
      y = rowY(1);
    s.drops.push({ id: s.nextId++, x, y, age: 0, value: 25 });
    s.enemies.push({
      id: s.nextId++,
      kind: 'enemy_ink_blob',
      entryId: 'char-1',
      x,
      row: 1,
      hp: 80,
      armor: 0,
      attackTimer: 0,
    });
    expect(boardAction(s, x, y, true, 0.5)).toEqual({ type: 'plant', id: s.plants[0].id });
    expect(boardAction(s, x, y, false, 0.5)).toEqual({ type: 'drop', id: s.drops[0].id });
    expect(boardAction(s, cellX(2), y, true, 0.5)).toEqual({ type: 'empty-shovel' });
  });
  it('maintains a 52 CSS pixel dew target on a narrow canvas', () => {
    const s = createGarden(3);
    s.drops.push({ id: s.nextId++, x: 500, y: 300, age: 0, value: 25 });
    expect(boardAction(s, 500 + 25 / 0.3, 300, false, 0.3)?.type).toBe('drop');
    expect(boardAction(s, 500 + 27 / 0.3, 300, false, 0.3)?.type).not.toBe('drop');
  });
});

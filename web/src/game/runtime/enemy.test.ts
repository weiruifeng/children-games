import { describe, it, expect } from 'vitest';
import { enemyStep } from './enemy';

describe('enemyStep', () => {
  it('朝玩家移动一个 step', () => {
    const r = enemyStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, 0.5);
    expect(r.x).toBe(50);
    expect(r.y).toBe(0);
  });

  it('到达玩家后不越过', () => {
    const r = enemyStep({ x: 0, y: 0 }, { x: 30, y: 0 }, 100, 1);
    expect(r.x).toBe(30);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveHit, type HitState } from './hit';

const bounds = { minX: 0, minY: 0, maxX: 1280, maxY: 720 };
const state = (over?: Partial<HitState>): HitState => ({
  score: 50,
  lives: 3,
  collected: [{ asset: 'star', score: 5 }],
  gameOver: false,
  ...over,
});

describe('resolveHit', () => {
  it('bounce：不扣分不掉命，只弹开', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'bounce', state(), 60, bounds, 5);
    expect(r.state.score).toBe(50);
    expect(r.state.lives).toBe(3);
    expect(r.position.x).toBeGreaterThan(100); // 被朝远离源的方向弹开
  });

  it('lose-score：扣 hitScore 分且不出现负分', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-score', state({ score: 3 }), 60, bounds, 5);
    expect(r.state.score).toBe(0); // 3 - 5 = -2 → clamp 到 0
  });

  it('lose-life：扣命，命尽 gameOver', () => {
    const r1 = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-life', state({ lives: 3 }), 60, bounds, 5);
    expect(r1.state.lives).toBe(2);
    expect(r1.state.gameOver).toBe(false);
    const r2 = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-life', state({ lives: 1 }), 60, bounds, 5);
    expect(r2.state.lives).toBe(0);
    expect(r2.state.gameOver).toBe(true);
  });

  it('drop-item：collected 非空时掉一个且扣该物品自己的分值', () => {
    const r = resolveHit(
      { x: 100, y: 100 }, { x: 50, y: 100 }, 'drop-item',
      state({ collected: [{ asset: 'star', score: 5 }, { asset: 'star', score: 5 }, { asset: 'star', score: 5 }], score: 15 }),
      60, bounds, 5,
    );
    expect(r.state.collected).toHaveLength(2); // 掉一个
    expect(r.state.score).toBe(10);            // 15 - 5 = 10
  });

  it('drop-item：collected 为空时不掉、不 crash、分数不变', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'drop-item', state({ collected: [], score: 15 }), 60, bounds, 5);
    expect(r.state.collected).toHaveLength(0);
    expect(r.state.score).toBe(15);
  });
});

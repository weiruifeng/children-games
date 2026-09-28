import { describe, it, expect } from 'vitest';
import { layoutCollectibles } from './layout';
import { distance } from '../math';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bounds = { width: 1280, height: 720 };
const start = { x: 640, y: 360 };

describe('layoutCollectibles', () => {
  it('多类型之间不重叠（跨类型也保持间距）', () => {
    const rng = mulberry32(42);
    const defs = [
      { asset: 'strawberry', score: 10, count: 20 },
      { asset: 'star', score: 5, count: 20 },
    ];
    const placed = layoutCollectibles(defs, bounds, 60, start, 60, rng);
    expect(placed).toHaveLength(40);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(distance(placed[i].point, placed[j].point)).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('所有点避开起点', () => {
    const rng = mulberry32(7);
    const defs = [{ asset: 'a', score: 1, count: 10 }];
    const placed = layoutCollectibles(defs, bounds, 60, start, 60, rng);
    for (const p of placed) {
      expect(distance(p.point, start)).toBeGreaterThanOrEqual(60);
    }
  });

  it('返回的 def 与生成点一一对应', () => {
    const rng = mulberry32(3);
    const defs = [
      { asset: 'strawberry', score: 10, count: 3 },
      { asset: 'star', score: 5, count: 2 },
    ];
    const placed = layoutCollectibles(defs, bounds, 60, start, 60, rng);
    const assets = placed.map((p) => p.def.asset);
    expect(assets.filter((a) => a === 'strawberry')).toHaveLength(3);
    expect(assets.filter((a) => a === 'star')).toHaveLength(2);
  });
});

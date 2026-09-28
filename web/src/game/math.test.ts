import { describe, it, expect } from 'vitest';
import { clamp, distance, moveToward, randomPositions } from './math';

describe('clamp', () => {
  it('夹在范围内', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('distance', () => {
  it('计算欧氏距离', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('moveToward', () => {
  it('按速度朝目标移动', () => {
    const r = moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 5, 1); // 5px/s * 1s
    expect(r.x).toBe(5);
    expect(r.y).toBe(0);
  });

  it('到达目标后不再越过', () => {
    const r = moveToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 5, 1);
    expect(r.x).toBe(3); // 不越过目标
  });
});

describe('randomPositions', () => {
  it('返回 count 个点且都在边界内', () => {
    const rng = mulberry32(42); // 确定性随机，保证可重复
    const pts = randomPositions(50, { width: 1280, height: 720 }, 60, [{ x: 640, y: 360 }], 60, rng);
    expect(pts).toHaveLength(50);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(60);
      expect(p.x).toBeLessThanOrEqual(1220);
      expect(p.y).toBeGreaterThanOrEqual(60);
      expect(p.y).toBeLessThanOrEqual(660);
    }
  });

  it('点之间不重叠（距离 >= minDist）', () => {
    const rng = mulberry32(7);
    const pts = randomPositions(20, { width: 1280, height: 720 }, 60, [{ x: 640, y: 360 }], 60, rng);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(distance(pts[i], pts[j])).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

// 可复现的伪随机数生成器
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

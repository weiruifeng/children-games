import { describe, it, expect } from 'vitest';
import { followSpeed, movePlayerClamped } from './movement';

const bounds = { minX: 24, minY: 24, maxX: 1256, maxY: 696 };

describe('movePlayerClamped', () => {
  it('朝目标移动且未到达时不报 arrived', () => {
    const r = movePlayerClamped({ x: 100, y: 100 }, { x: 200, y: 100 }, 100, 0.5, bounds); // 移动 50
    expect(r.x).toBe(150);
    expect(r.y).toBe(100);
    expect(r.arrived).toBe(false);
  });

  it('贴近目标时判定 arrived', () => {
    const r = movePlayerClamped({ x: 100, y: 100 }, { x: 102, y: 100 }, 100, 1, bounds);
    expect(r.arrived).toBe(true);
  });

  it('目标在边界外时停在边界并判定 arrived（不再贴边抖动）', () => {
    const r = movePlayerClamped({ x: 1256, y: 360 }, { x: 1500, y: 360 }, 100, 1, bounds);
    expect(r.x).toBe(1256); // 被 clamp 卡住
    expect(r.arrived).toBe(true);
  });

  it('clamp 生效：目标在边界外时位置被夹回边界内', () => {
    const r = movePlayerClamped({ x: 0, y: 0 }, { x: -100, y: 0 }, 100, 1, bounds);
    expect(r.x).toBe(24); // clamp 到 minX
    expect(r.arrived).toBe(true);
  });
});

describe('followSpeed', () => {
  it('远离目标时加速，贴近目标时减速，并保持合理上下限', () => {
    expect(followSpeed(300, 20)).toBe(120);
    expect(followSpeed(300, 300)).toBe(600);
    expect(followSpeed(300, 2000)).toBe(1200);
  });
});

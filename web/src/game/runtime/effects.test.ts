import { describe, it, expect } from 'vitest';
import { nextGrowScale, scaledDimensions } from './effects';

describe('nextGrowScale', () => {
  it('累加且不超过上限', () => {
    expect(nextGrowScale(1, 1.3)).toBe(1.06);
    expect(nextGrowScale(1.28, 1.3)).toBe(1.3); // clamp 到 cap
  });

  it('相对显示尺寸成长，不恢复图片原始像素尺寸', () => {
    const size = scaledDimensions(96, 96, 1.3);
    expect(size.width).toBeCloseTo(124.8);
    expect(size.height).toBeCloseTo(124.8);
  });
});

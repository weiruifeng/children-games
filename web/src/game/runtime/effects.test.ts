import { describe, it, expect } from 'vitest';
import { nextGrowScale } from './effects';

describe('nextGrowScale', () => {
  it('累加且不超过上限', () => {
    expect(nextGrowScale(1, 1.6)).toBeGreaterThan(1);
    expect(nextGrowScale(1.59, 1.6)).toBe(1.6); // clamp 到 cap
  });
});

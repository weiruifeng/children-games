const GROW_STEP = 0.08;

export function nextGrowScale(current: number, cap: number): number {
  return Math.min(current + GROW_STEP, cap);
}

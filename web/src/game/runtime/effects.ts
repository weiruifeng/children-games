const GROW_STEP = 0.06;

export function nextGrowScale(current: number, cap: number): number {
  return Math.min(current + GROW_STEP, cap);
}

export function scaledDimensions(width: number, height: number, scale: number) {
  return { width: width * scale, height: height * scale };
}

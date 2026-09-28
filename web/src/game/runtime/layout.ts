import { randomPositions, type Vec2 } from '../math';

export type CollectibleDef = { asset: string; score: number; count: number };

export type PlacedCollectible = { def: CollectibleDef; point: Vec2 };

// 为多类型收集物生成互不重叠的摆放点。
// 关键：所有类型共享同一个已放置列表作为 avoid，跨类型也不重叠（修复单类型各自生成导致的重叠）。
export function layoutCollectibles(
  defs: CollectibleDef[],
  bounds: { width: number; height: number },
  margin: number,
  start: Vec2,
  minDist: number,
  rng: () => number = Math.random,
): PlacedCollectible[] {
  const placed: Vec2[] = [start];
  const result: PlacedCollectible[] = [];
  for (const def of defs) {
    const points = randomPositions(def.count, bounds, margin, placed, minDist, rng);
    for (const point of points) {
      placed.push(point);
      result.push({ def, point });
    }
  }
  return result;
}

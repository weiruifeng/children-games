import { randomPositions, type Vec2 } from '../math';
import type { GameObject } from '@children-games/shared';

export type PlacedObject = { object: GameObject; point: Vec2 };

// 为所有「有 count 的随机对象」（collectible/obstacle/enemy）生成互不重叠的摆放点。
// hazard 有绝对坐标 area，不在此处理。
export function layoutObjects(
  objects: GameObject[],
  bounds: { width: number; height: number },
  margin: number,
  start: Vec2,
  minDist: number,
  rng: () => number = Math.random,
): PlacedObject[] {
  const placed: Vec2[] = [start];
  const result: PlacedObject[] = [];
  for (const object of objects) {
    if (object.type === 'hazard') continue; // hazard 由场景用 area 渲染
    const points = randomPositions(object.count, bounds, margin, placed, minDist, rng);
    for (const point of points) {
      placed.push(point);
      result.push({ object, point });
    }
  }
  return result;
}

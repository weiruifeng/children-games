import { clamp, distance, moveToward, type Vec2 } from '../math';

export type MoveResult = { x: number; y: number; arrived: boolean };

const ARRIVE_EPSILON = 4;

// 拖拽时让角色按距离调整速度：远处迅速跟上手指，临近目标自然放慢。
export function followSpeed(baseSpeed: number, distanceToTarget: number): number {
  return clamp(distanceToTarget * 2, baseSpeed * 0.4, baseSpeed * 4);
}

// 朝 target 移动并 clamp 到边界；到达目标或贴边时返回 arrived=true。
// 关键：目标在边界外时，clamp 后玩家永远无法进入 ARRIVE_EPSILON 内，
// 通过检测「clamp 是否生效」来判定贴边到达，避免 target 永不释放导致的边缘抖动。
export function movePlayerClamped(
  pos: Vec2,
  target: Vec2,
  speed: number,
  deltaSeconds: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): MoveResult {
  const next = moveToward(pos, target, speed, deltaSeconds);
  const x = clamp(next.x, bounds.minX, bounds.maxX);
  const y = clamp(next.y, bounds.minY, bounds.maxY);
  const hitBoundary = x !== next.x || y !== next.y;
  const arrived = hitBoundary || distance(target, { x, y }) < ARRIVE_EPSILON;
  return { x, y, arrived };
}

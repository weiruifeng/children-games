import { clamp, type Vec2 } from '../math';
import type { HitPolicy } from '@children-games/shared';

export type CollectedItem = { asset: string; score: number };

export type HitState = {
  score: number;
  lives: number;
  collected: CollectedItem[];
  gameOver: boolean;
};

export type HitResult = { position: Vec2; state: HitState; dropped: CollectedItem | null };

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

// 把玩家从 source 朝「玩家←source」方向弹开 dist 距离，并 clamp 到 bounds。
function knockback(player: Vec2, source: Vec2, dist: number, bounds: Bounds): Vec2 {
  const dx = player.x - source.x;
  const dy = player.y - source.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: clamp(player.x + (dx / len) * dist, bounds.minX, bounds.maxX),
    y: clamp(player.y + (dy / len) * dist, bounds.minY, bounds.maxY),
  };
}

// 应用失败策略，返回玩家新位置 + 更新后的状态。纯函数，不依赖 Phaser。
export function resolveHit(
  player: Vec2,
  source: Vec2,
  policy: HitPolicy,
  state: HitState,
  knockbackDist: number,
  bounds: Bounds,
  hitScore: number,
): HitResult {
  const position = knockback(player, source, knockbackDist, bounds);
  const next: HitState = { ...state, collected: [...state.collected] };
  let dropped: CollectedItem | null = null;

  switch (policy) {
    case 'bounce':
      break;
    case 'lose-score':
      next.score = Math.max(0, next.score - hitScore);
      break;
    case 'lose-life':
      next.lives = Math.max(0, next.lives - 1);
      if (next.lives === 0) next.gameOver = true;
      break;
    case 'drop-item': {
      const d = next.collected.pop();
      if (d) {
        next.score = Math.max(0, next.score - d.score);
        dropped = d;
      }
      break;
    }
  }

  return { position, state: next, dropped };
}

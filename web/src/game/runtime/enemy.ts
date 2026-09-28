import { moveToward, type Vec2 } from '../math';

export function enemyStep(enemy: Vec2, player: Vec2, speed: number, deltaSeconds: number): Vec2 {
  return moveToward(enemy, player, speed, deltaSeconds);
}

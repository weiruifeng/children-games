import { BOARD, type GardenState } from '@children-games/shared';
/** Input priority is a mode decision; a droplet must never steal a shovel action. */
export function boardAction(
  s: GardenState,
  x: number,
  y: number,
  shovel: boolean,
  pixelsPerUnit: number,
) {
  const row = Math.floor((y - BOARD.top) / BOARD.cellH),
    col = Math.floor((x - BOARD.left) / BOARD.cellW);
  const plant = s.plants.find((p) => p.row === row && p.col === col);
  if (shovel)
    return plant ? { type: 'plant' as const, id: plant.id } : { type: 'empty-shovel' as const };
  const radius = Math.max(28, 26 / Math.max(0.1, pixelsPerUnit));
  const drop = [...s.drops]
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    .find((d) => Math.hypot(d.x - x, d.y - y) < radius);
  if (drop) return { type: 'drop' as const, id: drop.id };
  const enemy = s.enemies.find(
    (e) =>
      Math.abs(e.x - x) < 48 &&
      y > BOARD.top + e.row * BOARD.cellH - 45 &&
      y < BOARD.top + e.row * BOARD.cellH + 106,
  );
  if (enemy) return { type: 'enemy' as const, id: enemy.id };
  if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.columns) return null;
  return plant ? { type: 'plant' as const, id: plant.id } : { type: 'cell' as const, row, col };
}

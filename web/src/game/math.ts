export type Vec2 = { x: number; y: number };

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 按 speed（px/s）在 deltaSeconds 内朝 target 移动，不超过目标
export function moveToward(pos: Vec2, target: Vec2, speed: number, deltaSeconds: number): Vec2 {
  const d = distance(pos, target);
  const step = speed * deltaSeconds;
  if (d <= step) return { x: target.x, y: target.y };
  const t = step / d;
  return { x: pos.x + (target.x - pos.x) * t, y: pos.y + (target.y - pos.y) * t };
}

// 在 bounds 内（留 margin 边距）、避开 avoid 列表、彼此间距 >= minDist，生成 count 个点。
// 每个点最多尝试 200 次，之后降级（接受一次不满足间距的点），保证不会死循环。
export function randomPositions(
  count: number,
  bounds: { width: number; height: number },
  margin: number,
  avoid: Vec2[],
  minDist: number,
  rng: () => number = Math.random,
): Vec2[] {
  const placed: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    let p: Vec2 | null = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate: Vec2 = {
        x: margin + rng() * (bounds.width - margin * 2),
        y: margin + rng() * (bounds.height - margin * 2),
      };
      const okAvoid = avoid.every((a) => distance(a, candidate) >= minDist);
      const okPlaced = placed.every((q) => distance(q, candidate) >= minDist);
      if (okAvoid && okPlaced) { p = candidate; break; }
    }
    if (!p) {
      // 降级：随机取一个点，避免死循环
      p = {
        x: margin + rng() * (bounds.width - margin * 2),
        y: margin + rng() * (bounds.height - margin * 2),
      };
    }
    placed.push(p);
  }
  return placed;
}

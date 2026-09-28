# Collect 机制扩展实现计划（GameSpec v0.2）

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤用 `- [ ]` checkbox 跟踪。

**Goal:** 给 Collect 模板加四类机制（collectible 带特效 / obstacle / hazard / enemy）+ 四种失败策略，让游戏真正好玩。继续脱离 LLM，用手写 v0.2 spec 验证 Runtime。

**Architecture:** 把 `schemaVersion` 升到 `0.2`，`collectibles` 字段改成统一 `objects` 数组 + `type` 判别；新增纯函数 `resolveHit` / `enemyStep` / `nextGrowScale`，把失败策略、追逐、grow 累加的可确定性逻辑抽出 Phaser；CollectScene 只做渲染 + 绑定输入 + 调用纯函数。碰撞继续手动判定（圆 + 矩形）。

**Tech Stack:** TypeScript, npm workspaces, React 18, Vite 6, Phaser 3.87, Zod 3, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-28-collect-mechanics-design.md`。本计划从 spec 出发论证，执行者需同时读 spec 与本文档。

## Global Constraints

- Node >= 20；npm workspaces（shared/web/server）。
- 逻辑分辨率 1280×720 横屏，`WORLD` 常量在 `web/src/game/runtime/world.ts` 单一事实源。
- schemaVersion 升 `'0.2'`，不做 v0.1→v0.2 自动迁移（3 份手写 spec 直接改）。
- `objects` 统一数组 + `type` 判别；`hitPolicy` 顶层全局，默认 `lose-score`，`hitScore` 默认 5。
- 敌人只做直线追逐（复用 `moveToward`），寻路/Boss血条/转身动画不做。
- 碰撞手动判定（圆 + 矩形），不启用 Arcade 物理。
- grow 特效永久累加、上限 1.6；fly 特效 tween 抛物线。
- 无敌期 2000ms，期间玩家 alpha 闪烁且跳过敌人/障碍/危险区碰撞（收集物仍可吃）。
- lose-life 初始 3 条命，命尽 game over（v0.2 唯一会 game over 的情况）。
- 不做音效/BGM/TTS、不做 grow/fly 之外特效、不做后端/LLM/持久化/Patch。

## Review Focus

以下 5 类是最可能咬人的失败模式，按最可能排：

1. **lose-score 扣分出现负分**：分数必须 clamp 到 0。
2. **lose-life 命尽后敌人继续撞 / 游戏不结束**：gameOver 后必须停止敌人追逐、停止碰撞、不再重生收集物。
3. **无敌期碰撞未跳过**：`invulnerableUntil` 未生效会让玩家被敌人追着连续撞、分数瞬间清零。
4. **drop-item 在 collected 为空时 crash**：掉物品必须判空，collected 为空则什么都不掉。
5. **grow 无限累加超过上限**：`nextGrowScale` 必须 clamp 到 cap。

---

## 文件结构

```
shared/
  src/schema.ts        # 改：BaseSpec 升 0.2；objects 数组 + type 判别；hitPolicy/hitScore
  src/schema.test.ts   # 改：新增 objects 四类对象 + hitPolicy 默认值 + 版本拒绝测试
  specs/*.json         # 改：3 份都改成 v0.2 objects 结构
web/src/game/
  runtime/hit.ts       # 新：resolveHit 纯函数（四种失败策略）
  runtime/hit.test.ts  # 新
  runtime/enemy.ts     # 新：enemyStep 直线追逐
  runtime/enemy.test.ts# 新
  runtime/effects.ts   # 新：nextGrowScale
  runtime/effects.test.ts # 新
  runtime/layout.ts    # 改：layoutObjects 泛化（支持 obstacle/enemy）
  runtime/layout.test.ts # 改
  runtime/world.ts     # 改：加 knockback / initialLives 常量
  runtime/scenes/CollectScene.ts # 改：四类对象渲染 + 敌人追逐 + applyHit + 无敌 + grow
  runtime/assets/proceduralAssets.ts # 改：加 rock/lava/t-rex/wolf 素材
```

---

### Task 1: GameSpec v0.2 Schema + 3 份 spec

**Files:**
- Modify: `shared/src/schema.ts`
- Modify: `shared/src/schema.test.ts`
- Modify: `shared/specs/dinosaur-strawberry.json` / `cat-stars.json` / `rabbit-carrot.json`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `HitPolicySchema` / `type HitPolicy = 'bounce'|'lose-score'|'lose-life'|'drop-item'`
  - `GameObjectSchema` / `type GameObject`（判别键 `type`）
  - `type CollectibleObject` / `ObstacleObject` / `HazardObject` / `EnemyObject`
  - `CollectSpec`（`objects` 字段，`hitPolicy?` 默认 lose-score，`hitScore?` 默认 5）

- [ ] **Step 1: 改 schema.ts**

```ts
import { z } from 'zod';

const BaseSpec = z.object({
  schemaVersion: z.literal('0.2'),
  orientation: z.literal('landscape'),
  title: z.string().min(1),
});

export const HitPolicySchema = z.union([
  z.literal('bounce'),
  z.literal('lose-score'),
  z.literal('lose-life'),
  z.literal('drop-item'),
]);

const CollectibleObjectSchema = z.object({
  type: z.literal('collectible'),
  asset: z.string().min(1),
  score: z.number().positive(),
  count: z.number().int().positive(),
  effect: z.union([z.literal('grow'), z.literal('fly')]).optional(),
});

const ObstacleObjectSchema = z.object({
  type: z.literal('obstacle'),
  asset: z.string().min(1),
  count: z.number().int().positive(),
});

const HazardObjectSchema = z.object({
  type: z.literal('hazard'),
  asset: z.string().min(1),
  area: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

const EnemyObjectSchema = z.object({
  type: z.literal('enemy'),
  asset: z.string().min(1),
  speed: z.number().positive(),
  count: z.number().int().positive(),
});

export const GameObjectSchema = z.discriminatedUnion('type', [
  CollectibleObjectSchema,
  ObstacleObjectSchema,
  HazardObjectSchema,
  EnemyObjectSchema,
]);

export const CollectSpecSchema = BaseSpec.extend({
  gameType: z.literal('collect'),
  player: z.object({
    character: z.string().min(1),
    movement: z.literal('follow-finger'),
    speed: z.number().positive().optional().default(300),
  }),
  background: z.object({ asset: z.string().min(1) }),
  objects: z.array(GameObjectSchema).min(1),
  hitPolicy: HitPolicySchema.optional().default('lose-score'),
  hitScore: z.number().positive().optional().default(5),
  win: z.object({ type: z.literal('score'), value: z.number().positive() }),
}).strict();

export const DodgeSpecSchema = BaseSpec.extend({ gameType: z.literal('dodge') }).strict();
export const JumpSpecSchema = BaseSpec.extend({ gameType: z.literal('jump') }).strict();

export const GameSpecSchema = z.discriminatedUnion('gameType', [
  CollectSpecSchema,
  DodgeSpecSchema,
  JumpSpecSchema,
]);

export type GameSpec = z.infer<typeof GameSpecSchema>;
export type CollectSpec = z.infer<typeof CollectSpecSchema>;
export type GameObject = z.infer<typeof GameObjectSchema>;
export type HitPolicy = z.infer<typeof HitPolicySchema>;
export type CollectibleObject = z.infer<typeof CollectibleObjectSchema>;
export type ObstacleObject = z.infer<typeof ObstacleObjectSchema>;
export type HazardObject = z.infer<typeof HazardObjectSchema>;
export type EnemyObject = z.infer<typeof EnemyObjectSchema>;
```

- [ ] **Step 2: 改 index.ts 导出新类型**

```ts
export { GameSpecSchema, CollectSpecSchema, DodgeSpecSchema, JumpSpecSchema, GameObjectSchema, HitPolicySchema } from './schema';
export type { GameSpec, CollectSpec, GameObject, HitPolicy, CollectibleObject, ObstacleObject, HazardObject, EnemyObject } from './schema';
export { validateGameSpec } from './validate';
```

- [ ] **Step 3: 改 schema.test.ts（覆盖 v0.2 行为）**

```ts
import { describe, it, expect } from 'vitest';
import { validateGameSpec } from './validate';

const validCollect = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '测试',
  player: { character: 'cat', movement: 'follow-finger' },
  background: { asset: 'meadow' },
  objects: [
    { type: 'collectible', asset: 'star', score: 5, count: 10 },
    { type: 'obstacle', asset: 'rock', count: 4 },
    { type: 'hazard', asset: 'lava', area: { x: 0, y: 600, width: 1280, height: 120 } },
    { type: 'enemy', asset: 't-rex', speed: 150, count: 1 },
  ],
  win: { type: 'score', value: 100 },
};

describe('validateGameSpec v0.2', () => {
  it('通过合法 collect spec', () => {
    const spec = validateGameSpec(validCollect);
    if (spec.gameType !== 'collect') throw new Error('unreachable');
    expect(spec.objects).toHaveLength(4);
    expect(spec.hitPolicy).toBe('lose-score'); // 默认值
    expect(spec.hitScore).toBe(5);             // 默认值
  });

  it('拒绝 0.1 版本', () => {
    expect(() => validateGameSpec({ ...validCollect, schemaVersion: '0.1' })).toThrow();
  });

  it('拒绝 objects 为空数组', () => {
    expect(() => validateGameSpec({ ...validCollect, objects: [] })).toThrow();
  });

  it('拒绝 collectible 缺 score', () => {
    const objects = [{ type: 'collectible', asset: 'star', count: 1 }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('拒绝 hazard 缺 area', () => {
    const objects = [{ type: 'hazard', asset: 'lava' }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('拒绝未知对象 type', () => {
    const objects = [{ type: 'trap', asset: 'x' }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('接受 dodge/jump 占位分支', () => {
    expect(validateGameSpec({ schemaVersion: '0.2', gameType: 'dodge', orientation: 'landscape', title: 'd' }).gameType).toBe('dodge');
    expect(validateGameSpec({ schemaVersion: '0.2', gameType: 'jump', orientation: 'landscape', title: 'j' }).gameType).toBe('jump');
  });

  describe('真实 specs fixture', () => {
    const files = ['dinosaur-strawberry.json', 'cat-stars.json', 'rabbit-carrot.json'];
    for (const f of files) {
      it(`${f} 能通过校验`, async () => {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(new URL('../specs/' + f, import.meta.url), 'utf8');
        expect(() => validateGameSpec(JSON.parse(raw))).not.toThrow();
      });
    }
  });
});
```

- [ ] **Step 4: 改 3 份 spec JSON 为 v0.2 objects 结构**

`dinosaur-strawberry.json`（全机制 + lose-score）：
```json
{
  "schemaVersion": "0.2",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "火山恐龙大冒险",
  "player": { "character": "yellow-dinosaur", "movement": "follow-finger", "speed": 300 },
  "background": { "asset": "volcano" },
  "objects": [
    { "type": "collectible", "asset": "strawberry", "score": 10, "count": 15, "effect": "grow" },
    { "type": "obstacle", "asset": "rock", "count": 4 },
    { "type": "hazard", "asset": "lava", "area": { "x": 0, "y": 600, "width": 1280, "height": 120 } },
    { "type": "enemy", "asset": "t-rex", "speed": 150, "count": 1 }
  ],
  "hitPolicy": "lose-score",
  "hitScore": 5,
  "win": { "type": "score", "value": 100 }
}
```

`cat-stars.json`（障碍 + bounce）：
```json
{
  "schemaVersion": "0.2",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "小猫捡星星",
  "player": { "character": "cat", "movement": "follow-finger", "speed": 350 },
  "background": { "asset": "space" },
  "objects": [
    { "type": "collectible", "asset": "star", "score": 5, "count": 30 },
    { "type": "obstacle", "asset": "rock", "count": 6 }
  ],
  "hitPolicy": "bounce",
  "win": { "type": "score", "value": 100 }
}
```

`rabbit-carrot.json`（敌人 + grow + lose-life）：
```json
{
  "schemaVersion": "0.2",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "小兔子拔胡萝卜",
  "player": { "character": "rabbit", "movement": "follow-finger", "speed": 280 },
  "background": { "asset": "meadow" },
  "objects": [
    { "type": "collectible", "asset": "carrot", "score": 10, "count": 15, "effect": "grow" },
    { "type": "enemy", "asset": "wolf", "speed": 160, "count": 1 }
  ],
  "hitPolicy": "lose-life",
  "win": { "type": "score", "value": 100 }
}
```

- [ ] **Step 5: 跑测试**

Run: `npm test -w web`
Expected: schema 测试全绿（fixture 校验 3 份新 spec 通过）。

- [ ] **Step 6: 提交**

```bash
git add shared/src shared/specs
git commit -m "feat(shared): GameSpec v0.2 — objects array with 4 types + hitPolicy"
```

---

### Task 2: 纯函数 resolveHit（四种失败策略）

**Files:**
- Create: `web/src/game/runtime/hit.ts`
- Create: `web/src/game/runtime/hit.test.ts`

**Interfaces:**
- Consumes: `type HitPolicy`（shared）、`clamp`/`Vec2`（math）。
- Produces:
  - `type CollectedItem = { asset: string; score: number }`
  - `type HitState = { score: number; lives: number; collected: CollectedItem[]; gameOver: boolean }`
  - `type HitResult = { position: Vec2; state: HitState }`
  - `resolveHit(player: Vec2, source: Vec2, policy: HitPolicy, state: HitState, knockbackDist: number, bounds: {minX;minY;maxX;maxY}, hitScore: number): HitResult`

- [ ] **Step 1: 写失败测试 hit.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { resolveHit, type HitState } from './hit';

const bounds = { minX: 0, minY: 0, maxX: 1280, maxY: 720 };
const state = (over?: Partial<HitState>): HitState => ({
  score: 50,
  lives: 3,
  collected: [{ asset: 'star', score: 5 }],
  gameOver: false,
  ...over,
});

describe('resolveHit', () => {
  it('bounce：不扣分不掉命，只弹开', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'bounce', state(), 60, bounds, 5);
    expect(r.state.score).toBe(50);
    expect(r.state.lives).toBe(3);
    expect(r.position.x).toBeGreaterThan(100); // 被朝远离源的方向弹开
  });

  it('lose-score：扣 hitScore 分且不出现负分', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-score', state({ score: 3 }), 60, bounds, 5);
    expect(r.state.score).toBe(0); // 3 - 5 = -2 → clamp 到 0
  });

  it('lose-life：扣命，命尽 gameOver', () => {
    const r1 = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-life', state({ lives: 3 }), 60, bounds, 5);
    expect(r1.state.lives).toBe(2);
    expect(r1.state.gameOver).toBe(false);
    const r2 = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'lose-life', state({ lives: 1 }), 60, bounds, 5);
    expect(r2.state.lives).toBe(0);
    expect(r2.state.gameOver).toBe(true);
  });

  it('drop-item：collected 非空时掉一个且扣该物品自己的分值', () => {
    const r = resolveHit(
      { x: 100, y: 100 }, { x: 50, y: 100 }, 'drop-item',
      state({ collected: [{ asset: 'star', score: 5 }, { asset: 'star', score: 5 }, { asset: 'star', score: 5 }], score: 15 }),
      60, bounds, 5,
    );
    expect(r.state.collected).toHaveLength(2); // 掉一个
    expect(r.state.score).toBe(10);            // 15 - 5 = 10
  });

  it('drop-item：collected 为空时不掉、不 crash、分数不变', () => {
    const r = resolveHit({ x: 100, y: 100 }, { x: 50, y: 100 }, 'drop-item', state({ collected: [], score: 15 }), 60, bounds, 5);
    expect(r.state.collected).toHaveLength(0);
    expect(r.state.score).toBe(15);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -w web`
Expected: FAIL（`./hit` 模块不存在）

- [ ] **Step 3: 实现 hit.ts**

```ts
import { clamp, type Vec2 } from '../math';
import type { HitPolicy } from '@children-games/shared';

export type CollectedItem = { asset: string; score: number };

export type HitState = {
  score: number;
  lives: number;
  collected: CollectedItem[];
  gameOver: boolean;
};

export type HitResult = { position: Vec2; state: HitState };

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
      const dropped = next.collected.pop();
      if (dropped) next.score = Math.max(0, next.score - dropped.score);
      break;
    }
  }

  return { position, state: next };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w web`
Expected: hit.test.ts 5 个测试全绿。

- [ ] **Step 5: 提交**

```bash
git add web/src/game/runtime/hit.ts web/src/game/runtime/hit.test.ts
git commit -m "feat(web): add resolveHit pure fn (4 hit policies)"
```

---


### Task 3: 纯函数 enemyStep + nextGrowScale

**Files:**
- Create: `web/src/game/runtime/enemy.ts`
- Create: `web/src/game/runtime/enemy.test.ts`
- Create: `web/src/game/runtime/effects.ts`
- Create: `web/src/game/runtime/effects.test.ts`

**Interfaces:**
- Consumes: `moveToward`/`Vec2`（math）。
- Produces:
  - `enemyStep(enemy: Vec2, player: Vec2, speed: number, deltaSeconds: number): Vec2`
  - `nextGrowScale(current: number, cap: number): number`

- [ ] **Step 1: 写失败测试 enemy.test.ts + effects.test.ts**

enemy.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { enemyStep } from './enemy';

describe('enemyStep', () => {
  it('朝玩家移动一个 step', () => {
    const r = enemyStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, 0.5);
    expect(r.x).toBe(50);
    expect(r.y).toBe(0);
  });

  it('到达玩家后不越过', () => {
    const r = enemyStep({ x: 0, y: 0 }, { x: 30, y: 0 }, 100, 1);
    expect(r.x).toBe(30);
  });
});
```

effects.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { nextGrowScale } from './effects';

describe('nextGrowScale', () => {
  it('累加且不超过上限', () => {
    expect(nextGrowScale(1, 1.6)).toBeGreaterThan(1);
    expect(nextGrowScale(1.59, 1.6)).toBe(1.6); // clamp 到 cap
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -w web`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 enemy.ts + effects.ts**

enemy.ts:
```ts
import { moveToward, type Vec2 } from '../math';

export function enemyStep(enemy: Vec2, player: Vec2, speed: number, deltaSeconds: number): Vec2 {
  return moveToward(enemy, player, speed, deltaSeconds);
}
```

effects.ts:
```ts
const GROW_STEP = 0.08;

export function nextGrowScale(current: number, cap: number): number {
  return Math.min(current + GROW_STEP, cap);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w web`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/game/runtime/enemy.ts web/src/game/runtime/enemy.test.ts web/src/game/runtime/effects.ts web/src/game/runtime/effects.test.ts
git commit -m "feat(web): add enemyStep and nextGrowScale pure fns"
```

---

### Task 4: 素材 + layoutObjects 泛化

**Files:**
- Modify: `web/src/game/runtime/assets/proceduralAssets.ts`
- Modify: `web/src/game/runtime/assets/proceduralAssets.test.ts`
- Modify: `web/src/game/runtime/layout.ts`
- Modify: `web/src/game/runtime/layout.test.ts`
- Modify: `web/src/game/runtime/world.ts`

**Interfaces:**
- Consumes: `randomPositions`/`Vec2`（math）。
- Produces:
  - `getAsset('rock'|'lava'|'t-rex'|'wolf')` 返回对应素材
  - `layoutObjects(objects: GameObject[], bounds, margin, start, minDist, rng?): PlacedObject[]`
  - `WORLD.knockback` / `WORLD.initialLives`

- [ ] **Step 1: 改 proceduralAssets.ts + test（加新素材）**

在 `REGISTRY` 加：
```ts
  rock:  { kind: 'emoji', emoji: '🪨' },
  lava:  { kind: 'color', color: 0xff4500, tint: 0xcc3700 },
  't-rex': { kind: 'emoji', emoji: '🦖' },
  wolf:  { kind: 'emoji', emoji: '🐺' },
```

test 追加：
```ts
  it('注册新素材', () => {
    expect(getAsset('rock').emoji).toBe('🪨');
    expect(getAsset('t-rex').emoji).toBe('🦖');
    expect(getAsset('wolf').emoji).toBe('🐺');
    expect(getAsset('lava').kind).toBe('color');
  });
```

- [ ] **Step 2: 改 world.ts（加常量）**

```ts
export const WORLD = {
  width: 1280,
  height: 720,
  margin: 60,
  minDist: 60,
  playerSize: 48,
  knockback: 80,      // 被碰到后的弹开距离
  initialLives: 3,    // lose-life 的初始命数
  invulnerableMs: 2000, // 无敌时长
  growCap: 1.6,       // grow 特效的 scale 上限
} as const;
```

- [ ] **Step 3: 改 layout.ts 为 layoutObjects**

把 `layoutCollectibles` 泛化成 `layoutObjects`，接受 `GameObject[]`。collectible 有 `count`，obstacle/enemy 也有 `count`；hazard 用绝对坐标 `area`，不走随机摆放。所以 `layoutObjects` 只处理「有 count 的随机对象」，hazard 单独处理（见 Task 5 场景）。

```ts
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
```

- [ ] **Step 4: 改 layout.test.ts（用 layoutObjects）**

```ts
import { describe, it, expect } from 'vitest';
import { layoutObjects } from './layout';
import { distance } from '../math';
import type { GameObject } from '@children-games/shared';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bounds = { width: 1280, height: 720 };
const start = { x: 640, y: 360 };

describe('layoutObjects', () => {
  it('多类型之间不重叠（含 enemy/obstacle）', () => {
    const rng = mulberry32(42);
    const objects: GameObject[] = [
      { type: 'collectible', asset: 'strawberry', score: 10, count: 20 },
      { type: 'obstacle', asset: 'rock', count: 10 },
      { type: 'enemy', asset: 't-rex', speed: 150, count: 2 },
    ];
    const placed = layoutObjects(objects, bounds, 60, start, 60, rng);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(distance(placed[i].point, placed[j].point)).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('hazard 跳过随机摆放', () => {
    const rng = mulberry32(7);
    const objects: GameObject[] = [
      { type: 'collectible', asset: 'a', score: 1, count: 3 },
      { type: 'hazard', asset: 'lava', area: { x: 0, y: 600, width: 1280, height: 120 } },
    ];
    const placed = layoutObjects(objects, bounds, 60, start, 60, rng);
    expect(placed).toHaveLength(3); // hazard 不计入
  });
});
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npm test -w web`
Expected: PASS（proceduralAssets 4、layout 2 全绿）

- [ ] **Step 6: 提交**

```bash
git add web/src/game/runtime/assets web/src/game/runtime/layout.ts web/src/game/runtime/layout.test.ts web/src/game/runtime/world.ts
git commit -m "feat(web): add new assets, layoutObjects generalization, world constants"
```

---

### Task 5: CollectScene 四类对象 + 失败策略 + 无敌 + grow

**Files:**
- Modify: `web/src/game/runtime/scenes/CollectScene.ts`

**Interfaces:**
- Consumes: `resolveHit`（hit）、`enemyStep`（enemy）、`nextGrowScale`（effects）、`layoutObjects`（layout）、`WORLD`（world）、`getAsset`（assets）、`GameObject`/`CollectSpec`/`HitPolicy`（shared）。

- [ ] **Step 1: 重写 CollectScene.ts**

```ts
import Phaser from 'phaser';
import type { CollectSpec, GameObject } from '@children-games/shared';
import { getAsset } from '../assets/proceduralAssets';
import { movePlayerClamped } from '../movement';
import { resolveHit, type HitState, type CollectedItem } from '../hit';
import { enemyStep } from '../enemy';
import { nextGrowScale } from '../effects';
import { layoutObjects } from '../layout';
import { WORLD } from '../world';

export const COLLECT_SCENE_KEY = 'CollectScene';

const WIDTH = WORLD.width;
const HEIGHT = WORLD.height;

type CollectibleDef = { asset: string; score: number; effect?: 'grow' | 'fly' };

export class CollectScene extends Phaser.Scene {
  private spec!: CollectSpec;
  private player!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private target: { x: number; y: number } | null = null;
  private enemies: { sprite: Phaser.GameObjects.Text; speed: number }[] = [];
  private score = 0;
  private lives = WORLD.initialLives;
  private collected: CollectedItem[] = [];
  private won = false;
  private gameOver = false;
  private invulnerableUntil = 0;
  private playerScale = 1;

  constructor() {
    super({ key: COLLECT_SCENE_KEY });
  }

  init(): void {
    this.spec = this.registry.get('spec') as CollectSpec;
    this.score = 0;
    this.lives = WORLD.initialLives;
    this.collected = [];
    this.won = false;
    this.gameOver = false;
    this.invulnerableUntil = 0;
    this.playerScale = 1;
    this.target = null;
    this.enemies = [];
  }

  create(): void {
    this.drawBackground();
    this.spawnPlayer();
    this.spawnObjects();
    this.createHud();
    this.bindInput();
  }

  private drawBackground(): void {
    const bg = getAsset(this.spec.background.asset);
    this.cameras.main.setBackgroundColor(bg.color ?? 0x000000);
    if (bg.tint != null) {
      this.add.rectangle(WIDTH / 2, HEIGHT, WIDTH, 140, bg.tint).setOrigin(0.5, 1);
    }
  }

  private spawnPlayer(): void {
    const p = getAsset(this.spec.player.character);
    this.player = this.add
      .text(WIDTH / 2, HEIGHT / 2, p.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private spawnObjects(): void {
    const start = { x: WIDTH / 2, y: HEIGHT / 2 };
    const placed = layoutObjects(this.spec.objects, { width: WIDTH, height: HEIGHT }, WORLD.margin, start, WORLD.minDist);
    for (const { object, point } of placed) {
      this.addObject(object, point);
    }
    // hazard 用绝对坐标 area 渲染
    for (const object of this.spec.objects) {
      if (object.type === 'hazard') {
        this.addHazard(object);
      }
    }
  }

  private addObject(object: GameObject, point: { x: number; y: number }): void {
    const a = getAsset(object.asset);
    if (object.type === 'enemy') {
      const sprite = this.add
        .text(point.x, point.y, a.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
        .setOrigin(0.5)
        .setDepth(3);
      this.enemies.push({ sprite, speed: object.speed });
      return;
    }
    const kind = object.type === 'collectible' ? 'collectible' : 'obstacle';
    const def = object.type === 'collectible'
      ? { asset: object.asset, score: object.score, effect: object.effect }
      : null;
    this.add
      .text(point.x, point.y, a.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(1)
      .setData('kind', kind)
      .setData('asset', object.asset)
      .setData('def', def);
  }

  private addHazard(object: { area: { x: number; y: number; width: number; height: number }; asset: string }): void {
    const a = getAsset(object.asset);
    const { x, y, width, height } = object.area;
    this.add
      .rectangle(x + width / 2, y + height / 2, width, height, a.color ?? 0x000000)
      .setOrigin(0.5)
      .setDepth(0)
      .setData('kind', 'hazard');
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(32, 32, this.scoreLabel(), { fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0).setDepth(10).setStroke('#000000', 6);
    if (this.spec.hitPolicy === 'lose-life') {
      this.livesText = this.add
        .text(32, 100, this.livesLabel(), { fontSize: '40px', color: '#ff6b6b' })
        .setOrigin(0, 0).setDepth(10).setStroke('#000000', 4);
    }
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setTarget(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.setTarget(p);
    });
    this.input.on('pointerup', () => { this.target = null; });
    this.input.on('pointerupoutside', () => { this.target = null; });
  }

  private setTarget(p: Phaser.Input.Pointer): void {
    if (this.won || this.gameOver) return;
    this.target = { x: p.worldX, y: p.worldY };
  }

  update(_time: number, delta: number): void {
    if (this.won || this.gameOver) return;
    this.movePlayer(delta);
    this.moveEnemies(delta);
    this.handleInvulnerableFlicker();
    this.checkCollectibles();
    this.checkHazards();
    this.checkEnemies();
  }

  private movePlayer(delta: number): void {
    const speed = this.spec.player.speed ?? 300;
    if (this.target) {
      const r = movePlayerClamped(
        { x: this.player.x, y: this.player.y }, this.target, speed, delta / 1000,
        { minX: WORLD.playerSize / 2, minY: WORLD.playerSize / 2, maxX: WIDTH - WORLD.playerSize / 2, maxY: HEIGHT - WORLD.playerSize / 2 },
      );
      this.player.setPosition(r.x, r.y);
      if (r.arrived) this.target = null;
    }
  }

  private moveEnemies(delta: number): void {
    for (const e of this.enemies) {
      const next = enemyStep({ x: e.sprite.x, y: e.sprite.y }, { x: this.player.x, y: this.player.y }, e.speed, delta / 1000);
      e.sprite.setPosition(next.x, next.y);
    }
  }

  private handleInvulnerableFlicker(): void {
    if (this.now() < this.invulnerableUntil) {
      this.player.setAlpha(Math.floor(this.now() / 100) % 2 === 0 ? 0.3 : 1);
    } else {
      this.player.setAlpha(1);
    }
  }

  private checkCollectibles(): void {
    const items = [...this.children.list].filter(
      (c) => (c as Phaser.GameObjects.Text).getData?.('kind') === 'collectible',
    ) as Phaser.GameObjects.Text[];
    for (const item of items) {
      if (!item.active) continue;
      if (Math.hypot(item.x - this.player.x, item.y - this.player.y) < WORLD.playerSize) {
        const def = item.getData('def') as CollectibleDef;
        this.score += def.score;
        this.collected.push({ asset: def.asset, score: def.score });
        if (def.effect === 'grow') this.playerScale = nextGrowScale(this.playerScale, WORLD.growCap);
        this.player.setScale(this.playerScale);
        this.scoreText.setText(this.scoreLabel());
        item.destroy();
        if (this.score >= this.spec.win.value) { this.victory(); return; }
        this.respawnOne(def);
      }
    }
  }

  private checkHazards(): void {
    if (this.isInvulnerable()) return;
    const hazards = [...this.children.list].filter(
      (c) => (c as Phaser.GameObjects.Rectangle).getData?.('kind') === 'hazard',
    ) as Phaser.GameObjects.Rectangle[];
    for (const h of hazards) {
      const rect = h.getBounds();
      if (rect.contains(this.player.x, this.player.y)) {
        this.applyHit({ x: h.x, y: h.y });
        return;
      }
    }
  }

  private checkEnemies(): void {
    if (this.isInvulnerable()) return;
    for (const e of this.enemies) {
      if (Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) < WORLD.playerSize) {
        this.applyHit({ x: e.sprite.x, y: e.sprite.y });
        return;
      }
    }
  }

  private isInvulnerable(): boolean {
    return this.now() < this.invulnerableUntil;
  }

  private applyHit(source: { x: number; y: number }): void {
    const state: HitState = { score: this.score, lives: this.lives, collected: this.collected, gameOver: false };
    const r = resolveHit(
      { x: this.player.x, y: this.player.y }, source, this.spec.hitPolicy ?? 'lose-score', state,
      WORLD.knockback,
      { minX: WORLD.playerSize / 2, minY: WORLD.playerSize / 2, maxX: WIDTH - WORLD.playerSize / 2, maxY: HEIGHT - WORLD.playerSize / 2 },
      this.spec.hitScore ?? 5,
    );
    this.score = r.state.score;
    this.lives = r.state.lives;
    this.collected = r.state.collected;
    this.player.setPosition(r.position.x, r.position.y);
    this.invulnerableUntil = this.now() + WORLD.invulnerableMs;
    this.scoreText.setText(this.scoreLabel());
    if (this.spec.hitPolicy === 'lose-life' && this.livesText) this.livesText.setText(this.livesLabel());
    if (r.state.gameOver) this.gameOverScreen();
  }

  private respawnOne(def: CollectibleDef): void {
    const placed = layoutObjects(
      [{ type: 'collectible', asset: def.asset, score: def.score, count: 1 }],
      { width: WIDTH, height: HEIGHT }, WORLD.margin,
      { x: this.player.x, y: this.player.y }, WORLD.minDist,
    );
    this.addObject(placed[0].object, placed[0].point);
  }

  private scoreLabel(): string {
    return `${this.score} / ${this.spec.win.value}`;
  }

  private livesLabel(): string {
    return `❤️ × ${this.lives}`;
  }

  private now(): number {
    return this.time.now;
  }

  private victory(): void {
    this.won = true;
    this.target = null;
    this.tweens.add({ targets: this.player, scale: { from: this.playerScale, to: this.playerScale + 0.4 }, duration: 300, yoyo: true, repeat: 2 });
    this.add.text(WIDTH / 2, HEIGHT / 2 - 80, '🎉 你赢啦！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' }).setOrigin(0.5).setDepth(20).setStroke('#000000', 8);
    this.addRestartButton();
  }

  private gameOverScreen(): void {
    this.gameOver = true;
    this.target = null;
    this.add.text(WIDTH / 2, HEIGHT / 2 - 80, '😢 再试一次！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' }).setOrigin(0.5).setDepth(20).setStroke('#000000', 8);
    this.addRestartButton();
  }

  private addRestartButton(): void {
    const btn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, '🔄 再玩一次', { fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5).setDepth(20).setStroke('#000000', 6).setPadding(20).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
  }
}
```

- [ ] **Step 2: type-check + build**

Run: `npm run type-check -w web && npm run build -w web`
Expected: 无类型错误，build 成功。

- [ ] **Step 3: 手动验证**

Run: `npm run dev -w web`
Expected: 三个游戏玩法不同——恐龙(追人霸王龙+岩浆+障碍+吃草莓变大)、小猫(障碍弹开)、兔子(躲狼+掉命+吃胡萝卜变大)。

- [ ] **Step 4: 提交**

```bash
git add web/src/game/runtime/scenes/CollectScene.ts
git commit -m "feat(web): CollectScene four object types + hit policies + invulnerability + grow"
```

---

## Self-Review 记录

- **Spec 覆盖**：M5（objects 数组）→ Task1；M2（四策略）→ Task2 resolveHit + Task5 applyHit；M3/M4（四类对象/敌人直线）→ Task3 enemyStep + Task5；M7（grow 累加）→ Task3 nextGrowScale + Task5；M8（0.2 版本）→ Task1；M9（手动碰撞）→ Task5 圆+矩形判定。D 系列决策（不做迁移/音效/寻路）无任务（正确）。
- **类型一致性**：`GameObject`/`HitPolicy` 来自 shared Task1，Task4/5 使用一致；`resolveHit` 签名在 Task2 定义（7 参数含 hitScore），Task5 调用一致；`layoutObjects` 签名 Task4 定义，Task5 使用一致。
- **Review Focus 覆盖**：1（负分）→ Task2 lose-score clamp 测试；2（命尽停止）→ Task5 `gameOver` 守卫（update/setTarget 早退）；3（无敌跳过）→ Task5 `isInvulnerable()` 守卫 hazards/enemies；4（drop-item 空）→ Task2 drop-item 空 collected 测试；5（grow 上限）→ Task3 nextGrowScale clamp 测试。
- **已知边界**：Phaser 场景无 node 单测，靠 type-check + 手动运行验证（plan 内已注明）。

---

**执行方式：** 本计划含 5 个任务，接口逐层依赖（schema → hit → enemy/effects → assets/layout → scene）。请先 review 本计划，确认后选择执行方式（subagent-driven 或 native）。

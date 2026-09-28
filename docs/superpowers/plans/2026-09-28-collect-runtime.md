# Collect Game Runtime 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤用 `- [ ]` checkbox 跟踪。

**Goal:** 跑通「GameSpec → Phaser Collect Runtime」：首页列出 3 份手写游戏，点进去能玩（跟随手指移动、捡东西加分、捡够赢、再玩一次）。

**Architecture:** shared 包提供 GameSpec 的 Zod schema + validator（单一事实源）；web 包实现纯函数（移动/随机摆放/素材解析）与 Phaser CollectScene，React 只做壳与悬浮按钮。素材用程序化占位（emoji+色块）。

**Tech Stack:** TypeScript, npm workspaces, React 18, Vite 6, Phaser 3.87, Zod 3, Vitest 3.

**Spec:** `docs/mvp-design.md`（13 条 ADR + GameSpec v0.1 Schema + Collect Runtime 设计）。本计划从 spec 出发论证，执行者需同时读 spec 与本文档。

## Global Constraints

- Node >= 20（`.nvmrc` 为 20）。
- npm workspaces：`shared` / `web` / `server` 三个包；用 npm（无 yarn.lock）。
- 逻辑分辨率固定 1280×720 横屏，Phaser `Scale.FIT` + `CENTER_BOTH` 自适应。
- GameSpec 里素材只写 assetId（字符串），不写 URL/颜色描述；描述归 AssetSpec。
- 素材用程序化占位（emoji + 色块），第一刀不碰真实图片/AI 生图。
- 只赢不输：捡够分数赢，无失败条件、无倒计时、无敌人。
- 移动只实现 `follow-finger`（跟随手指拖拽），不做虚拟摇杆。
- 收集物纯随机摆放，不写坐标。
- 不做 Patch、不做持久化、不调后端、不做音效/BGM/TTS、不做 Dodge/Jump。
- 所有 AI 输出/图片/语音/用户输入与游戏内容须符合儿童安全（本计划无 LLM/网络生成，天然满足）。

## Review Focus

以下 5 类是 spec 隐含、但各任务单测未必覆盖的最可能咬人的失败模式，按最可能排：

1. **收集物数量过大导致随机摆放死循环/重叠**：count 很大时 `randomPositions` 必须有尝试次数上限并优雅降级，不能卡死。
2. **手指拖出 canvas 边界**：`pointerupoutside` 未处理会让玩家在手指离开屏幕后继续移动。
3. **胜利后玩家仍可被拖拽移动**：victory 后必须锁输入，否则分数达标后角色还能动、还能继续吃。
4. **「再玩一次」后 spec 丢失**：`scene.restart()` 必须保留 init data，重启后能正常重玩。
5. **未知 assetId**：素材解析层必须返回 fallback（❓），不能 crash 或渲染 undefined。

---

## 文件结构

```
shared/
  src/schema.ts        # GameSpec v0.1 Zod schema + TS 类型（BaseSpec / CollectSpecSchema / GameSpecSchema）
  src/validate.ts      # validateGameSpec(input): GameSpec（strict 模式）
  src/index.ts         # 统一导出 schema + validate
  src/schema.test.ts   # schema/validator 单测 + 真实 specs fixture 校验
web/
  src/game/math.ts                       # 纯函数：clamp/distance/moveToward/randomPositions
  src/game/math.test.ts
  src/game/runtime/assets/proceduralAssets.ts   # getAsset(id): AssetSpec
  src/game/runtime/assets/proceduralAssets.test.ts
  src/game/runtime/scenes/CollectScene.ts       # Phaser 场景
  src/game/runtime/createGame.ts                # createGame(parent, spec): Phaser.Game
  src/game/PhaserGame.tsx                       # React 组件挂载 Phaser
  src/game/specs.ts                             # 从 shared/specs 显式 import 3 份 JSON → GAMES 列表
  src/pages/Home.tsx                            # 首页：列出游戏
  src/pages/Game.tsx                            # 游戏页：PhaserGame + 悬浮按钮 + 返回
  src/App.tsx                                   # 简单 state 路由（不用 react-router）
  src/main.tsx                                  # 去掉 StrictMode（避免 Phaser 双实例）
  src/styles/global.css                         # 首页/游戏页样式
```

每个文件职责单一：纯逻辑（math/assets/schema）与 Phaser/React 视图分离，前者可单测，后者靠 type-check + 手动验证（Phaser 场景无法在 node 环境自动化）。

---

### Task 1: GameSpec Schema + Validator（shared）

**Files:**
- Create: `shared/src/schema.ts`
- Create: `shared/src/validate.ts`
- Modify: `shared/src/index.ts`（替换占位内容）
- Create: `shared/src/schema.test.ts`
- Test: 用 vitest（在 web 包跑，见下）

**Interfaces:**
- Consumes: 无（Task 1 是地基）。
- Produces:
  - `GameSpecSchema`（`z.ZodDiscriminatedUnion`，判别键 `gameType`）
  - `type GameSpec = z.infer<typeof GameSpecSchema>`
  - `type CollectSpec = z.infer<typeof CollectSpecSchema>`
  - `validateGameSpec(input: unknown): GameSpec`（strict 模式）

- [ ] **Step 1: 写 schema.ts**

```ts
import { z } from 'zod';

const BaseSpec = z.object({
  schemaVersion: z.literal('0.1'),
  orientation: z.literal('landscape'),
  title: z.string().min(1),
});

export const CollectSpecSchema = BaseSpec.extend({
  gameType: z.literal('collect'),
  player: z.object({
    character: z.string().min(1),
    movement: z.literal('follow-finger'),
    speed: z.number().positive().optional().default(300),
  }),
  background: z.object({
    asset: z.string().min(1),
  }),
  collectibles: z
    .array(
      z.object({
        asset: z.string().min(1),
        score: z.number().positive(),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
  win: z.object({
    type: z.literal('score'),
    value: z.number().positive(),
  }),
});

export const DodgeSpecSchema = BaseSpec.extend({
  gameType: z.literal('dodge'),
});

export const JumpSpecSchema = BaseSpec.extend({
  gameType: z.literal('jump'),
});

export const GameSpecSchema = z.discriminatedUnion('gameType', [
  CollectSpecSchema,
  DodgeSpecSchema,
  JumpSpecSchema,
]);

export type GameSpec = z.infer<typeof GameSpecSchema>;
export type CollectSpec = z.infer<typeof CollectSpecSchema>;
```

- [ ] **Step 2: 写 validate.ts**

```ts
import { GameSpecSchema, type GameSpec } from './schema';

// strict：出现未定义字段即抛错，是「Validator 即合同」的体现
export function validateGameSpec(input: unknown): GameSpec {
  return GameSpecSchema.strict().parse(input);
}
```

- [ ] **Step 3: 改写 index.ts**

```ts
export { GameSpecSchema, CollectSpecSchema, DodgeSpecSchema, JumpSpecSchema } from './schema';
export type { GameSpec, CollectSpec } from './schema';
export { validateGameSpec } from './validate';
```

- [ ] **Step 4: 配置 vitest（web 包承载所有测试）**

改 `web/package.json`：在 `devDependencies` 加入 `"vitest": "^3.0.0"`，`scripts` 加入：
```json
"test": "vitest run",
"test:watch": "vitest"
```

改 `web/vite.config.ts`：在 `export default defineConfig({...})` 里加：
```ts
test: {
  environment: 'node',
  include: ['src/**/*.test.ts', '../shared/src/**/*.test.ts'],
},
```

- [ ] **Step 5: 写失败测试 shared/src/schema.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { validateGameSpec } from './validate';

describe('validateGameSpec', () => {
  it('通过合法 collect spec', () => {
    const spec = validateGameSpec({
      schemaVersion: '0.1',
      gameType: 'collect',
      orientation: 'landscape',
      title: '测试',
      player: { character: 'yellow-dinosaur', movement: 'follow-finger' },
      background: { asset: 'volcano' },
      collectibles: [{ asset: 'strawberry', score: 10, count: 20 }],
      win: { type: 'score', value: 100 },
    });
    expect(spec.gameType).toBe('collect');
    expect(spec.player.speed).toBe(300); // 默认值生效
  });

  it('拒绝未定义的字段（strict）', () => {
    expect(() =>
      validateGameSpec({
        schemaVersion: '0.1',
        gameType: 'collect',
        orientation: 'landscape',
        title: '测试',
        player: { character: 'x', movement: 'follow-finger' },
        background: { asset: 'y' },
        collectibles: [{ asset: 'z', score: 1, count: 1 }],
        win: { type: 'score', value: 1 },
        bogus: true,
      }),
    ).toThrow();
  });

  it('拒绝 collectibles 为空数组', () => {
    expect(() =>
      validateGameSpec({
        schemaVersion: '0.1',
        gameType: 'collect',
        orientation: 'landscape',
        title: '测试',
        player: { character: 'x', movement: 'follow-finger' },
        background: { asset: 'y' },
        collectibles: [],
        win: { type: 'score', value: 1 },
      }),
    ).toThrow();
  });

  it('接受 dodge/jump 占位分支', () => {
    expect(validateGameSpec({ schemaVersion: '0.1', gameType: 'dodge', orientation: 'landscape', title: 'd' }).gameType).toBe('dodge');
    expect(validateGameSpec({ schemaVersion: '0.1', gameType: 'jump', orientation: 'landscape', title: 'j' }).gameType).toBe('jump');
  });
});
```

- [ ] **Step 6: 跑测试验证失败/通过**

Run: `npm test -w web`
Expected: 4 个测试通过（schema 已实现，首次即绿；若实现前先跑会因 `validateGameSpec` 未定义而报错——此处 schema 与测试同任务交付，直接验证绿）。

- [ ] **Step 7: 用真实 specs 校验（追加 fixture 测试）**

在 `shared/src/schema.test.ts` 末尾追加：

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('真实 specs fixture', () => {
  const files = ['dinosaur-strawberry.json', 'cat-stars.json', 'rabbit-carrot.json'];
  for (const f of files) {
    it(`${f} 能通过校验`, () => {
      const raw = readFileSync(join(__dirname, '../specs', f), 'utf8');
      expect(() => validateGameSpec(JSON.parse(raw))).not.toThrow();
    });
  }
});
```

> 注：`__dirname` 在 vitest ESM 下不可用，改用 `new URL('../specs/'+f, import.meta.url)`。

- [ ] **Step 8: 提交**

```bash
git add shared/src web/package.json web/vite.config.ts
git commit -m "feat(shared): add GameSpec v0.1 schema and validator"
```

---

### Task 2: 纯函数 math 模块

**Files:**
- Create: `web/src/game/math.ts`
- Create: `web/src/game/math.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `type Vec2 = { x: number; y: number }`
  - `clamp(v: number, min: number, max: number): number`
  - `distance(a: Vec2, b: Vec2): number`
  - `moveToward(pos: Vec2, target: Vec2, speed: number, deltaSeconds: number): Vec2`
  - `randomPositions(count: number, bounds: {width:number;height:number}, margin: number, avoid: Vec2[], minDist: number, rng?: () => number): Vec2[]`

- [ ] **Step 1: 写失败测试 math.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { clamp, distance, moveToward, randomPositions } from './math';

describe('clamp', () => {
  it('夹在范围内', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('distance', () => {
  it('计算欧氏距离', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('moveToward', () => {
  it('按速度朝目标移动', () => {
    const r = moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 5, 1); // 5px/s * 1s
    expect(r.x).toBe(5);
    expect(r.y).toBe(0);
  });

  it('到达目标后不再越过', () => {
    const r = moveToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 5, 1);
    expect(r.x).toBe(3); // 不越过目标
  });
});

describe('randomPositions', () => {
  it('返回 count 个点且都在边界内', () => {
    const rng = mulberry32(42); // 确定性随机，保证可重复
    const pts = randomPositions(50, { width: 1280, height: 720 }, 60, [{ x: 640, y: 360 }], 60, rng);
    expect(pts).toHaveLength(50);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(60);
      expect(p.x).toBeLessThanOrEqual(1220);
      expect(p.y).toBeGreaterThanOrEqual(60);
      expect(p.y).toBeLessThanOrEqual(660);
    }
  });

  it('点之间不重叠（距离 >= minDist）', () => {
    const rng = mulberry32(7);
    const pts = randomPositions(20, { width: 1280, height: 720 }, 60, [{ x: 640, y: 360 }], 60, rng);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(distance(pts[i], pts[j])).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

// 可复现的伪随机数生成器
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -w web`
Expected: FAIL（`./math` 模块不存在）

- [ ] **Step 3: 实现 math.ts**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w web`
Expected: PASS（5 个测试）

- [ ] **Step 5: 提交**

```bash
git add web/src/game/math.ts web/src/game/math.test.ts
git commit -m "feat(web): add math primitives for movement and random placement"
```

---

### Task 3: 素材解析层 proceduralAssets

**Files:**
- Create: `web/src/game/runtime/assets/proceduralAssets.ts`
- Create: `web/src/game/runtime/assets/proceduralAssets.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `type AssetSpec = { kind: 'emoji' | 'color'; emoji?: string; color?: number; radius?: number; tint?: number }`
  - `getAsset(id: string): AssetSpec`（未知 id 返回 FALLBACK）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { getAsset } from './proceduralAssets';

describe('getAsset', () => {
  it('返回已注册的 emoji 素材', () => {
    expect(getAsset('strawberry').emoji).toBe('🍓');
    expect(getAsset('yellow-dinosaur').emoji).toBe('🦖');
  });

  it('返回已注册的 color 背景', () => {
    expect(getAsset('volcano').kind).toBe('color');
  });

  it('未知 id 返回 fallback', () => {
    const a = getAsset('nonexistent');
    expect(a.kind).toBe('emoji');
    expect(a.emoji).toBe('❓');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -w web`
Expected: FAIL

- [ ] **Step 3: 实现 proceduralAssets.ts**

```ts
export type AssetSpec = {
  kind: 'emoji' | 'color';
  emoji?: string;
  color?: number;
  radius?: number;
  tint?: number;
};

const FALLBACK: AssetSpec = { kind: 'emoji', emoji: '❓', color: 0xcccccc };

const REGISTRY: Record<string, AssetSpec> = {
  'yellow-dinosaur': { kind: 'emoji', emoji: '🦖' },
  strawberry: { kind: 'emoji', emoji: '🍓' },
  star: { kind: 'emoji', emoji: '⭐' },
  carrot: { kind: 'emoji', emoji: '🥕' },
  cat: { kind: 'emoji', emoji: '🐱' },
  rabbit: { kind: 'emoji', emoji: '🐰' },
  volcano: { kind: 'color', color: 0xb3541e, tint: 0x7a2e0e },
  meadow: { kind: 'color', color: 0x7ec850, tint: 0x4a9e2f },
  sky: { kind: 'color', color: 0x87ceeb, tint: 0x5bb3d8 },
  space: { kind: 'color', color: 0x1b1b3a, tint: 0x2a2a5a },
};

export function getAsset(id: string): AssetSpec {
  return REGISTRY[id] ?? FALLBACK;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w web`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/game/runtime/assets
git commit -m "feat(web): add procedural asset resolver (emoji + color placeholder)"
```

---

### Task 4: CollectScene（Phaser 场景）

**Files:**
- Create: `web/src/game/runtime/scenes/CollectScene.ts`

**Interfaces:**
- Consumes: `validateGameSpec`（shared）、`getAsset`（Task 3）、`moveToward`/`randomPositions`/`clamp`（Task 2）。
- Produces:
  - `export const COLLECT_SCENE_KEY = 'CollectScene'`
  - `export class CollectScene extends Phaser.Scene`（构造 `{ key: COLLECT_SCENE_KEY }`；通过 `init(data)` 接收 `{ spec: CollectSpec }`）

- [ ] **Step 1: 实现 CollectScene.ts**

```ts
import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { getAsset } from '../assets/proceduralAssets';
import { clamp, moveToward, randomPositions, type Vec2 } from '../../math';

export const COLLECT_SCENE_KEY = 'CollectScene';

const WIDTH = 1280;
const HEIGHT = 720;
const MARGIN = 60;      // 收集物/玩家安全边距
const PLAYER_SIZE = 48; // 角色与收集物的世界尺寸
const MIN_DIST = 60;    // 生成点最小间距

type CollectibleDef = { asset: string; score: number; count: number };

export class CollectScene extends Phaser.Scene {
  private spec!: CollectSpec;
  private player!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private target: Vec2 | null = null;
  private score = 0;
  private won = false;

  constructor() {
    super({ key: COLLECT_SCENE_KEY });
  }

  init(data: { spec: CollectSpec }): void {
    this.spec = data.spec;
    this.score = 0;
    this.won = false;
    this.target = null;
  }

  create(): void {
    this.drawBackground();

    // 玩家
    const p = getAsset(this.spec.player.character);
    this.player = this.add
      .text(0, 0, p.emoji ?? '?', { fontSize: `${PLAYER_SIZE}px` })
      .setOrigin(0.5)
      .setDepth(2);
    this.player.setPosition(WIDTH / 2, HEIGHT / 2);

    // 收集物（纯随机摆放，避开玩家起点）
    this.spawnCollectibles();

    // HUD 分数
    this.scoreText = this.add
      .text(32, 32, this.scoreLabel(), { fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0)
      .setDepth(10)
      .setStroke('#000000', 6);

    // 输入：跟随手指拖拽
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setTarget(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.setTarget(p);
    });
    this.input.on('pointerup', () => { this.target = null; });
    this.input.on('pointerupoutside', () => { this.target = null; });
  }

  private drawBackground(): void {
    const bg = getAsset(this.spec.background.asset);
    this.cameras.main.setBackgroundColor(bg.color ?? 0x000000);
    if (bg.tint != null) {
      this.add.rectangle(WIDTH / 2, HEIGHT, WIDTH, 140, bg.tint).setOrigin(0.5, 1);
    }
  }

  private spawnCollectibles(): void {
    const start: Vec2 = { x: WIDTH / 2, y: HEIGHT / 2 };
    for (const def of this.spec.collectibles) {
      const points = randomPositions(def.count, { width: WIDTH, height: HEIGHT }, MARGIN, [start], MIN_DIST);
      for (const pt of points) {
        this.addCollectible(def, pt);
      }
    }
  }

  private addCollectible(def: CollectibleDef, pt: Vec2): void {
    const a = getAsset(def.asset);
    const item = this.add
      .text(pt.x, pt.y, a.emoji ?? '?', { fontSize: `${PLAYER_SIZE}px` })
      .setOrigin(0.5)
      .setDepth(1);
    // 用矩形碰撞体（text 无物理体，用 getBounds 手动判定）
    this.physics.add.existing(item as unknown as Phaser.GameObjects.GameObject);
    // 手动存储：用 data 保存计分信息
    item.setData('score', def.score);
    item.setData('kind', 'collectible');
  }

  private setTarget(p: Phaser.Input.Pointer): void {
    if (this.won) return;
    this.target = { x: p.worldX, y: p.worldY };
  }

  update(_time: number, delta: number): void {
    if (this.won) return;
    const speed = this.spec.player.speed ?? 300;
    if (this.target) {
      const next = moveToward(
        { x: this.player.x, y: this.player.y },
        this.target,
        speed,
        delta / 1000,
      );
      this.player.setPosition(
        clamp(next.x, PLAYER_SIZE / 2, WIDTH - PLAYER_SIZE / 2),
        clamp(next.y, PLAYER_SIZE / 2, HEIGHT - PLAYER_SIZE / 2),
      );
      // 到达目标附近即停下
      if (Math.hypot(this.target.x - this.player.x, this.target.y - this.player.y) < 4) {
        this.target = null;
      }
    }
    this.checkCollect();
  }

  private checkCollect(): void {
    const children = this.children.list;
    for (const child of children) {
      const item = child as Phaser.GameObjects.Text;
      if (item.getData('kind') !== 'collectible' || !item.active) continue;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < PLAYER_SIZE) {
        const score = item.getData('score') as number;
        this.score += score;
        this.scoreText.setText(this.scoreLabel());
        item.destroy();
        if (this.score >= this.spec.win.value) {
          this.victory();
          return;
        }
        this.respawnOne(item);
      }
    }
  }

  // 捡到后随机重生一个，保证场上永远有东西可捡（只赢不输）
  private respawnOne(_item: Phaser.GameObjects.Text): void {
    // 简化：按已收集物类型重新生成一个
    const def = this.spec.collectibles[0];
    const points = randomPositions(1, { width: WIDTH, height: HEIGHT }, MARGIN, [{ x: this.player.x, y: this.player.y }], MIN_DIST);
    this.addCollectible(def, points[0]);
  }

  private scoreLabel(): string {
    return `${this.score} / ${this.spec.win.value}`;
  }

  private victory(): void {
    this.won = true;
    this.target = null;
    // 胜利动画：角色弹跳
    this.tweens.add({
      targets: this.player,
      scale: { from: 1, to: 1.4 },
      duration: 300,
      yoyo: true,
      repeat: 2,
    });
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 80, '🎉 你赢啦！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', 8);
    const btn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, '🔄 再玩一次', { fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', 6)
      .setPadding(20)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
  }
}
```

> **注意：** 收集物用 `Phaser.Text`（emoji）而非 Arcade Sprite，`checkCollect` 用 `Math.hypot` 手动圆形判定（半径 PLAYER_SIZE），不启用物理碰撞器——简单可靠、无 sprite 纹理依赖。`this.physics.add.existing` 那行实际无需，可直接删掉；保留 arcade 会要求启动物理系统，这里**不启用** arcade（config 不设 physics），碰撞走手动判定。

- [ ] **Step 2: 修正——移除无用的 physics 行**

把 `addCollectible` 里 `this.physics.add.existing(...)` 与 `setData` 中的多余逻辑简化为（最终版本）：

```ts
  private addCollectible(def: CollectibleDef, pt: Vec2): void {
    const a = getAsset(def.asset);
    this.add
      .text(pt.x, pt.y, a.emoji ?? '?', { fontSize: `${PLAYER_SIZE}px` })
      .setOrigin(0.5)
      .setDepth(1)
      .setData('score', def.score)
      .setData('kind', 'collectible');
  }
```

- [ ] **Step 3: type-check + build**

Run: `npm run type-check -w web && npm run build -w web`
Expected: 无类型错误，build 成功。（Phaser 场景无 node 单测；正确性靠 type-check + 下一步手动运行验证。）

- [ ] **Step 4: 提交**

```bash
git add web/src/game/runtime/scenes/CollectScene.ts
git commit -m "feat(web): add CollectScene (follow-finger, collect, win)"
```

---

### Task 5: createGame + PhaserGame 组件 + 游戏壳

**Files:**
- Create: `web/src/game/runtime/createGame.ts`
- Create: `web/src/game/PhaserGame.tsx`
- Create: `web/src/game/specs.ts`
- Create: `web/src/pages/Home.tsx`
- Create: `web/src/pages/Game.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Consumes: `CollectScene`/`COLLECT_SCENE_KEY`（Task 4）、`validateGameSpec`（shared）、3 份 specs JSON。
- Produces:
  - `createGame(parent: HTMLElement, spec: CollectSpec): Phaser.Game`
  - `PhaserGame({ spec }: { spec: CollectSpec })` React 组件
  - `GAMES: { id: string; spec: CollectSpec }[]`
  - `Home` / `Game` 页面组件

- [ ] **Step 1: 写 specs.ts（显式 import JSON）**

```ts
import type { CollectSpec } from '@children-games/shared';
import { validateGameSpec } from '@children-games/shared';
import dinosaur from '@children-games/shared/specs/dinosaur-strawberry.json';
import cat from '@children-games/shared/specs/cat-stars.json';
import rabbit from '@children-games/shared/specs/rabbit-carrot.json';

export const GAMES: { id: string; spec: CollectSpec }[] = [
  { id: 'dinosaur', spec: validateGameSpec(dinosaur) },
  { id: 'cat', spec: validateGameSpec(cat) },
  { id: 'rabbit', spec: validateGameSpec(rabbit) },
];
```

> **注意：** 若 Vite 无法直接 `import` 子路径 JSON（因 shared 的 `exports` 只暴露 `.`），改在 `shared/package.json` 的 `exports` 加 `"./specs/*": "./specs/*"`。本任务 Step 2 处理。

- [ ] **Step 2: 扩展 shared 导出子路径（如需）**

改 `shared/package.json` 的 `exports`：
```json
"exports": {
  ".": "./src/index.ts",
  "./specs/*": "./specs/*"
}
```
改 `shared/tsconfig.json` 增加 `"resolveJsonModule": true`。若 web 直接读不到，则在 `web/vite.config.ts` 加：
```ts
resolve: { alias: { '@specs': fileURLToPath(new URL('../shared/specs', import.meta.url)) } }
```
并改 specs.ts 用 `import dinosaur from '@specs/dinosaur-strawberry.json'`（最稳）。采用后者。

- [ ] **Step 3: 写 createGame.ts**

```ts
import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { CollectScene } from './scenes/CollectScene';

export function createGame(parent: HTMLElement, spec: CollectSpec): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CollectScene],
  });
  // 注入 spec
  game.scene.start('CollectScene', { spec });
  return game;
}
```

> 注：`game.scene.start` 在 Game 构造后立刻调用会因场景未 ready 而失效。正确做法：用 `game.scene.scenes[0]` 或传 `scene: [new CollectScene({ spec })]`。改用后者：

```ts
export function createGame(parent: HTMLElement, spec: CollectSpec): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CollectScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('spec', spec);
      },
    },
  });
}
```

最终采用最可靠方案：让 `CollectScene.init` 从 `this.registry.get('spec')` 读取，`createGame` 用 `callbacks.preBoot` 写入 registry。修改 Task 4 的 `CollectScene.init`：

```ts
init(): void {
  this.spec = this.registry.get('spec') as CollectSpec;
  this.score = 0;
  this.won = false;
  this.target = null;
}
```

- [ ] **Step 4: 写 PhaserGame.tsx**

```tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { createGame } from './runtime/createGame';

export default function PhaserGame({ spec }: { spec: CollectSpec }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    gameRef.current = createGame(parentRef.current, spec);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [spec]);

  return <div ref={parentRef} className="phaser-container" />;
}
```

- [ ] **Step 5: 写 Home.tsx**

```tsx
import { GAMES } from '../game/specs';

export default function Home({ onPlay }: { onPlay: (id: string) => void }) {
  return (
    <div className="home">
      <h1>🎮 我的游戏</h1>
      <div className="game-grid">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPlay(g.id)}>
            <span className="game-emoji">{g.spec.player.character === 'cat' ? '🐱' : g.spec.player.character === 'rabbit' ? '🐰' : '🦖'}</span>
            <span className="game-title">{g.spec.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

> 简化：emoji 从 `proceduralAssets.getAsset(g.spec.player.character).emoji` 取，避免硬编码判断。改成：

```tsx
import { GAMES } from '../game/specs';
import { getAsset } from '../game/runtime/assets/proceduralAssets';

export default function Home({ onPlay }: { onPlay: (id: string) => void }) {
  return (
    <div className="home">
      <h1>🎮 我的游戏</h1>
      <div className="game-grid">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPlay(g.id)}>
            <span className="game-emoji">{getAsset(g.spec.player.character).emoji}</span>
            <span className="game-title">{g.spec.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 写 Game.tsx**

```tsx
import { GAMES } from '../game/specs';
import PhaserGame from '../game/PhaserGame';

export default function Game({ id, onBack }: { id: string; onBack: () => void }) {
  const game = GAMES.find((g) => g.id === id);
  if (!game) return <div>找不到游戏</div>;
  return (
    <div className="game-page">
      <PhaserGame spec={game.spec} />
      <div className="game-overlay">
        <button className="overlay-btn" onClick={onBack}>🏠</button>
        <button className="overlay-btn big">🎤 我要改游戏</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 改写 App.tsx**

```tsx
import { useState } from 'react';
import Home from './pages/Home';
import Game from './pages/Game';

type Route = { name: 'home' } | { name: 'game'; id: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  if (route.name === 'game') {
    return <Game id={route.id} onBack={() => setRoute({ name: 'home' })} />;
  }
  return <Home onPlay={(id) => setRoute({ name: 'game', id })} />;
}
```

- [ ] **Step 8: 改写 main.tsx（去掉 StrictMode，避免 Phaser 双实例）**

```tsx
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 9: 追加 global.css 样式**

```css
.home { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 32px; }
.game-grid { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.game-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 32px; font-size: 28px; border: 3px solid #444; border-radius: 20px; background: #1c1c3a; color: #fff; cursor: pointer; }
.game-card:active { background: #2c2c5a; }
.game-emoji { font-size: 64px; }
.game-page { position: relative; width: 100%; height: 100%; }
.phaser-container { width: 100%; height: 100%; }
.phaser-container canvas { display: block; }
.game-overlay { position: absolute; top: 16px; right: 16px; display: flex; gap: 16px; z-index: 10; }
.overlay-btn { padding: 16px 24px; font-size: 28px; border: 3px solid #444; border-radius: 16px; background: rgba(20,20,50,.8); color: #fff; cursor: pointer; }
.overlay-btn.big { padding: 16px 32px; }
```

- [ ] **Step 10: type-check + build + 手动验证**

Run: `npm run type-check -w web && npm run build -w web && npm run dev -w web`
Expected: 构建通过；浏览器打开 `http://localhost:5173`，首页见 3 张卡片，点入可玩：拖拽恐龙移动、吃草莓加分、到 100 弹出「你赢啦」、点「再玩一次」重玩。

- [ ] **Step 11: 提交**

```bash
git add -A
git commit -m "feat(web): wire Home/Game shell to Phaser Collect runtime"
```

---

## Self-Review 记录

- **Spec 覆盖**：D4/D5（schema 骨架+版本）→Task1；D6/D7（assetId+占位素材）→Task3；D10（随机摆放）→Task2/4；D11（follow-finger）→Task4；D12（UI 分工）→Task4/5；D8（只赢不输）→Task4 victory/respawn；D13（读静态 JSON）→Task5 specs.ts。D9（不做 Patch）无任务（正确）。
- **类型一致性**：`CollectSpec` 来自 shared；`moveToward`/`randomPositions`/`clamp` 签名在 Task2 定义、Task4 使用一致；`getAsset` 签名 Task3 定义、Task4/5 使用一致。
- **Review Focus 覆盖**：1（随机死循环）→Task2 `randomPositions` 200 次上限 + 降级；2（拖出边界）→Task4 `pointerupoutside`；3（胜利后仍可动）→Task4 `won` 标志 + `setTarget`/`update` 守卫；4（重启丢 spec）→Task5 `callbacks.preBoot` registry + Task4 `init` 从 registry 读；5（未知 assetId）→Task3 fallback 测试。
- **已知边界**：Phaser 场景无 node 单测，靠 type-check + 手动运行验证（plan 内已注明）。

---

**执行方式：** 本计划含 5 个任务，任务间靠 interface（schema → math → assets → scene → 壳）逐层依赖，每个任务交付物独立可验证（纯函数有单测、场景靠 type-check）。请先 review 本计划，确认后选择执行方式（subagent-driven 或 native）。

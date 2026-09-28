# 儿童游戏创造 Agent — MVP 设计文档

> 本文件是「第一刀」的设计结论，所有决策都已在设计讨论中逐条确认。
> 范围：脱离 LLM，用 2~3 份手写 GameSpec 跑通「GameSpec → Collect Runtime」。
> 原则：优先确定性代码，能不做的不做；为「语音改游戏」留好扩展点，但不提前实现。

---

## 0. 决策记录（ADR 摘要）

| # | 决策 | 结论 | 理由（一句话） |
|---|---|---|---|
| D1 | 第一刀切哪 | 脱离 LLM，手写 spec 跑通 GameSpec+Collect | 先验证契约本身，排除 LLM 输出不稳定的干扰 |
| D2 | 仓库结构 | myfe 形状 + shared 包 + npm workspaces | 复用你熟悉的结构，补上「契约单一事实源」这块 myfe 没有的板 |
| D3 | 包管理 | npm（无 yarn.lock） | 你的脚本全用 npm |
| D4 | schema 边界 | 带 gameType 枚举的通用骨架，Collect 完整，Dodge/Jump 占位 | gameType 是模板分派开关，现在不加将来要改根结构 |
| D5 | 版本字段 | schemaVersion: '0.1' 第一天放入 | GameSpec 要版本化，零成本但不可回补 |
| D6 | 素材写法 | 只写 assetId（写法 A），描述归 AssetSpec | 换素材不改 spec，符合「LLM 不决定 CDN URL」 |
| D7 | 素材来源 | v0.1 程序化占位（色块+emoji） | 零外部依赖离线可跑，映射层以后换成 URL 即可 |
| D8 | 胜负 | 只赢不输，捡够分数就赢 | 5 岁孩子挫败感极强，失败条件=额外机制 |
| D9 | Patch | v0.1 不做，只做全量 spec 替换 | 没有 LLM 就没有 Patch 的产生方/消费方 |
| D10 | 收集物摆放 | 纯随机生成，不写坐标 | 确定性代码，5 岁孩子不关心坐标 |
| D11 | 移动方式 | 跟随手指拖拽 | 5 岁孩子对「拖着走」理解快于「抽象摇杆」 |
| D12 | UI 分工 | Phaser 画游戏内 UI，React 画壳+悬浮按钮 | 游戏内 UI 强绑帧循环，壳 UI 好写大按钮 |
| D13 | spec 来源 | 读 shared/specs 静态 JSON，不持久化 | 第一刀无 LLM，接 API 那一刀再替换读取层 |

---

## 1. 目标

第一刀产出一个可运行的 Web App：

- 首页列出 2~3 份手写游戏（黄恐龙吃草莓 / 小猫捡星星 / 兔子捡胡萝卜）。
- 点进去，Phaser Runtime 读对应 GameSpec，生成可玩游戏。
- 孩子「跟随手指拖拽」角色移动，碰到收集物加分，捡够分数赢，胜利后「再玩一次」。
- 全程不碰 LLM / 语音 / 生图 / 数据库。

---

## 2. 技术架构

```
React Shell (web)                     Phaser Runtime (web)
┌─────────────────────┐               ┌──────────────────────┐
│ 首页：列出 spec      │   点击加载     │ CollectScene         │
│ 游戏页：Phaser 容器  │ ───────────▶  │ 读 GameSpec          │
│ 悬浮按钮(🎤改游戏)   │               │ 画背景/角色/收集物    │
└─────────────────────┘               │ 跟随手指移动          │
                                      │ 碰撞→加分            │
        ▲                             │ 分数达标→胜利动画      │
        │ import                      └──────────────────────┘
        │                                     ▲ import
┌───────┴─────────┐                 ┌──────────┴──────────┐
│ @children-games/shared            │ proceduralAssets    │
│  schema.ts (类型)                  │  assetId → 色块+emoji │
│  validate.ts (Zod)                │  (AssetService 占位) │
└─────────────────┘                 └─────────────────────┘
        ▲
        │ 读取
┌───────┴─────────┐
│ shared/specs/*.json               （第二刀：server 也 import 同一份 shared）
└─────────────────┘
```

关键点：

1. **shared 是单一事实源**。web 的 Runtime 和（将来的）server 的 Planner 都 `import` 同一份 schema + validator，不在两端复制。
2. **素材解析层独立**。Runtime 不直接知道 `"strawberry"` 长什么样，而是查 `proceduralAssets`（assetId → 绘制函数）。将来换成 `assetId → URL` 时，Runtime 和 GameSpec 一行不改。
3. **spec 读取层独立**。v0.1 从静态 JSON 读；第二刀接后端 API 时只换这一层，Runtime 无感。

---

## 3. 目录设计（第一刀完成后）

```
children-games/
├── package.json               # npm workspaces: shared / web / server
├── .nvmrc                     # 20
├── docs/
│   └── mvp-design.md          # 本文档
├── shared/
│   ├── package.json           # @children-games/shared，deps: zod
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts           # 统一导出
│   │   ├── schema.ts          # GameSpec v0.1 类型 + Zod schema
│   │   └── validate.ts        # validateGameSpec(json): GameSpec
│   └── specs/
│       ├── dinosaur-strawberry.json
│       ├── cat-stars.json
│       └── rabbit-carrot.json
├── web/
│   ├── package.json           # @children-games/web，deps: react/phaser/shared
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx            # 路由/壳
│       ├── pages/
│       │   ├── Home.tsx       # 首页：列出 specs，点进游戏
│       │   └── Game.tsx       # 游戏页：Phaser 容器 + 悬浮按钮
│       ├── game/
│       │   ├── PhaserGame.tsx # React 组件，mount Phaser 实例
│       │   ├── runtime/
│       │   │   ├── createGame.ts      # 按 gameType 创建对应 scene
│       │   │   ├── scenes/
│       │   │   │   └── CollectScene.ts
│       │   │   └── assets/
│       │   │       └── proceduralAssets.ts
│       │   └── input/
│       │       └── followFinger.ts    # 跟随手指拖拽（可拆成独立模块以便复用/测试）
│       └── styles/
│           └── global.css
└── server/                    # 骨架已建，第一刀不写业务
    └── src/{main.ts, app.module.ts, health.controller.ts, modules/{core,business}/}
```

> 说明：`web/src/game/` 下尽量少依赖 React，方便第二刀「Game Evaluator」脱离 React 单独驱动 Phaser。

---

## 4. GameSpec v0.1 Schema

### 4.1 字段定义

```jsonc
{
  "schemaVersion": "0.1",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "火山恐龙大冒险",

  "player": {
    "character": "yellow-dinosaur",   // assetId
    "movement": "follow-finger",      // v0.1 只实现这一种
    "speed": 300                      // 可选，px/s，默认 300
  },

  "background": {
    "asset": "volcano"                // assetId
  },

  "collectibles": [                   // v0.1 只有可收集物这一类
    {
      "asset": "strawberry",
      "score": 10,                    // 捡到加分
      "count": 20                     // 场上同时最多数量
    }
  ],

  "win": {
    "type": "score",                  // v0.1 只有「分数达标」
    "value": 100                      // 达标分数
  }
}
```

### 4.2 Zod schema（严格模式）

```ts
import { z } from 'zod';

const BaseSpec = z.object({
  schemaVersion: z.literal('0.1'),
  orientation: z.literal('landscape'),
  title: z.string().min(1),
});

const CollectSpec = BaseSpec.extend({
  gameType: z.literal('collect'),
  player: z.object({
    character: z.string().min(1),
    movement: z.literal('follow-finger'),
    speed: z.number().positive().optional().default(300),
  }),
  background: z.object({ asset: z.string().min(1) }),
  collectibles: z
    .array(
      z.object({
        asset: z.string().min(1),
        score: z.number().positive(),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
  win: z.object({ type: z.literal('score'), value: z.number().positive() }),
});

// Dodge / Jump：v0.1 占位，字段待第二刀按需定义
const DodgeSpec = BaseSpec.extend({ gameType: z.literal('dodge') });
const JumpSpec = BaseSpec.extend({ gameType: z.literal('jump') });

export const GameSpecSchema = z.discriminatedUnion('gameType', [
  CollectSpec,
  DodgeSpec,
  JumpSpec,
]);

export type GameSpec = z.infer<typeof GameSpecSchema>;
export type CollectSpec = z.infer<typeof CollectSpec>;
```

### 4.3 Validator

```ts
import { GameSpecSchema, type GameSpec } from './schema';

// 严格模式：spec 里出现任何未定义字段都会抛错
export function validateGameSpec(input: unknown): GameSpec {
  return GameSpecSchema.strict().parse(input);
}
```

**设计要点：**

- `discriminatedUnion('gameType')` 让「collect 分支的字段」在 collect 时被强校验；将来 dodge/jump 各自扩展分支即可。
- `.strict()` 是「Validator 即合同」的体现——第二刀接 LLM 时，第一时间抓出 LLM 幻觉出的字段。
- assetId 一律 `string`，不枚举。因为资产库会增长，枚举会导致「加一个素材就要改 schema」。合法性交给 Asset 解析层兜底（找不到 id 就给一个 fallback 占位图）。

---

## 5. Collect 最小 Runtime 设计

### 5.1 素材解析层（AssetService 占位）

`proceduralAssets.ts` 导出一个 `getAsset(id: string): AssetSpec`，`AssetSpec` 描述「怎么画」：

```ts
type AssetSpec = {
  kind: 'emoji' | 'color';   // 用 emoji 还是纯色块
  emoji?: string;            // 🍓 🦖 ⭐ 🥕
  color?: number;            // 纯色块时的 Phaser 颜色
  radius?: number;           // 圆形占位半径（可选，默认 24）
  tint?: number;             // 背景/主题色调
};

const FALLBACK: AssetSpec = { kind: 'emoji', emoji: '❓', color: 0xcccccc };

const REGISTRY: Record<string, AssetSpec> = {
  'yellow-dinosaur': { kind: 'emoji', emoji: '🦖' },
  strawberry:        { kind: 'emoji', emoji: '🍓' },
  star:              { kind: 'emoji', emoji: '⭐' },
  carrot:            { kind: 'emoji', emoji: '🥕' },
  cat:               { kind: 'emoji', emoji: '🐱' },
  rabbit:            { kind: 'emoji', emoji: '🐰' },
  volcano:           { kind: 'color', color: 0xb3541e, tint: 0x7a2e0e },
  meadow:            { kind: 'color', color: 0x7ec850, tint: 0x4a9e2f },
  sky:               { kind: 'color', color: 0x87ceeb, tint: 0x5bb3d8 },
  space:             { kind: 'color', color: 0x1b1b3a, tint: 0x2a2a5a },
};

export function getAsset(id: string): AssetSpec {
  return REGISTRY[id] ?? FALLBACK;
}
```

> 背景是「整屏颜色」而非一张图；emoji 用 Phaser Text 渲染，色块用 Graphics / 圆。v0.1 一切占位。

### 5.2 CollectScene 生命周期

```
create()
  ├─ 读 spec（通过 scene 的 data 传入）
  ├─ 画背景（getAsset(background.asset)）
  ├─ 生成玩家 sprite（getAsset(player.character)）
  ├─ 按 collectibles[].count 随机摆放收集物（不重叠、不出界）
  ├─ 建 HUD：分数文本（Phaser Text，画在 canvas 内）
  └─ 注册输入：跟随手指拖拽

update(time, delta)
  └─ 按当前输入方向移动玩家；夹在屏幕边界内

collect(object, player)
  └─ 加分 → 收集物消失（或重生）→ 更新 HUD
     └─ 若 score >= win.value → 触发 victory()

victory()
  ├─ 停输入
  ├─ 播放胜利动画（角色 scale 弹跳 + 简单粒子）
  ├─ 画「🎉 你赢啦！」+「再玩一次」按钮（Phaser 内）
  └─ 点击 → this.scene.restart()
```

### 5.3 关键实现约定

1. **角色大小 / 收集物大小**：MVP 统一约 48px（Phaser 世界坐标），用 `scale` 适配横屏。角色固定居中垂直、贴底？——不，跟随手指是自由移动，全屏范围移动。
2. **跟随手指**：`pointerdown + pointermove` 取指针世界坐标，玩家朝该点移动（速度 = `player.speed`）；手指松开停在原地。这是「朝手指位置走」，不是「绝对吸附」，手感更接近「拖着走」但实现简单。
3. **收集物重生**：捡到一个后，若离 `win.value` 还远，在随机新位置重生，保证场上始终有东西可捡（因为「只赢不输」，必须永远可玩到赢）。
4. **屏幕边界**：玩家 clamp 在可视区域内，收集物生成在安全边距内。
5. **HUD 分数**：Phaser Text，大号、圆角底，画在 canvas 左上角（游戏内 UI 归 Phaser）。

### 5.4 边界之外（明确不做）

- 不做虚拟摇杆（只做 follow-finger）。
- 不做失败/倒计时/掉血。
- 不做收集物「变大/飞」等碰撞特效。
- 不做音效/BGM/TTS。
- 不做持久化、不做 Patch、不做后端调用。
- 不做 Dodge/Jump 场景。

# Collect 机制扩展设计（GameSpec v0.2）

> 本文档是「第二刀」的设计结论。目标：让 Collect 模板从「只赢不输捡东西」升级为「有敌人、有障碍、有危险区、有碰撞特效」的真正好玩的小游戏。
> 范围：脱离 LLM，继续用手写 GameSpec 验证 Runtime。新增四类机制，每个只做最简实现。

## 0. 背景与动机

第一刀跑通了「GameSpec → Collect Runtime」，但体验下来「太简单，没有玩的欲望」。根因不是「模板太少」，而是**现有 Collect 没有失败策略、没有敌人、没有碰撞特效**——它只是「移动 + 碰到加分」。

关键洞察：Dodge（躲陨石）和 Jump（跳障碍）这两个模板，**本质上也需要「敌人/障碍/危险区 + 失败策略」这些机制**。所以先把这些机制做成 GameSpec 能力，做深一个 Collect 模板，后续 Dodge/Jump 能直接复用同一套能力，而不是再做两个「换皮但一样无聊」的模板。

## 1. 决策记录（ADR 摘要）

| # | 决策 | 结论 |
|---|---|---|
| M1 | 方向 | 先给 Collect 加机制，再考虑扩模板 |
| M2 | 失败策略 | 四种策略全部做成 GameSpec 可选（bounce / lose-score / lose-life / drop-item），不是写死一种 |
| M3 | 机制范围 | 四类对象全做：collectible(带effect) / obstacle / hazard / enemy，每个最简实现 |
| M4 | 敌人实现 | 只做直线追逐（每帧朝玩家移动），寻路/Boss血条/转身动画显式划下一刀 |
| M5 | 对象建模 | 统一 `objects` 数组 + `type` 判别，取代 v0.1 的 `collectibles` 字段 |
| M6 | hitPolicy 位置 | 放顶层（全局规则），不是每个对象各自配 |
| M7 | grow 特效 | 永久累加（每次捡到变大一点，有上限），不是暂时变大 |
| M8 | 版本 | schemaVersion 0.1 → 0.2，破坏性变更，不做自动迁移 |
| M9 | 物理 | 继续手动碰撞判定（圆 + 矩形），不启用 Arcade 物理 |

## 2. GameSpec v0.2 Schema

```jsonc
{
  "schemaVersion": "0.2",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "火山恐龙大冒险",

  "player": {
    "character": "yellow-dinosaur",
    "movement": "follow-finger",
    "speed": 300                    // 可选，默认 300
  },

  "background": { "asset": "volcano" },

  "objects": [
    {
      "type": "collectible",
      "asset": "strawberry",
      "score": 10,
      "count": 20,                   // 场上同时数量
      "effect": "grow"               // 可选：grow | fly
    },
    {
      "type": "obstacle",
      "asset": "rock",
      "count": 4
    },
    {
      "type": "hazard",
      "asset": "lava",
      "area": { "x": 0, "y": 600, "width": 1280, "height": 120 }   // 危险区（绝对坐标）
    },
    {
      "type": "enemy",
      "asset": "t-rex",
      "speed": 150,                  // 直线追逐速度 px/s
      "count": 1
    }
  ],

  "hitPolicy": "lose-score",        // 全局失败策略，可选，默认 lose-score
  "hitScore": 5,                    // lose-score 时扣多少分，可选，默认 5

  "win": { "type": "score", "value": 100 }
}
```

### 2.1 四类对象

| 类型 | 必需字段 | 可选字段 | 说明 |
|---|---|---|---|
| `collectible` | asset, score, count | effect | 捡到加分 + 触发 effect + 重生同类 |
| `obstacle` | asset, count | — | 静态，碰到弹开（随机摆放） |
| `hazard` | asset, area | — | 一块危险区（绝对坐标），走进触发 hitPolicy |
| `enemy` | asset, speed, count | — | 直线追逐玩家，碰到触发 hitPolicy |

### 2.2 失败策略 hitPolicy（顶层，全局）

| 值 | 行为 |
|---|---|
| `bounce` | 玩家沿「玩家←碰撞源」方向弹开 + 2 秒无敌闪烁，不扣分 |
| `lose-score` | 弹开 + 无敌，另扣 `hitScore` 分（最低扣到 0，不出现负分） |
| `lose-life` | 扣一条命（初始 3 条）+ 弹开 + 无敌；命 = 0 时 game over |
| `drop-item` | 玩家身上随机一个已收集物回到随机位置，分数减去该物分值 + 无敌 |

默认 `lose-score`，`hitScore` 默认 5。可省略。

### 2.3 碰撞特效 effect（collectible 专属，可选）

| 值 | 行为 |
|---|---|
| `grow` | 玩家永久变大一点点，有上限（1.6 倍） |
| `fly` | 玩家 tween 一个向上抛物线位移再落下 |

### 2.4 明确不做（下一刀或更后）

- 敌人寻路 / Boss 血条 / 转身动画
- 音效 / BGM / TTS
- grow/fly 之外的特效种类（爆炸、磁吸等）
- v0.1 → v0.2 自动迁移
- 后端 / LLM / 持久化 / Patch

## 3. 架构：GameSpec 能力 vs 写死代码

沿用项目核心原则「优先确定性代码」，可确定性计算的逻辑全部抽成纯函数，Phaser 场景只做「渲染 + 绑定输入 + 调用纯函数」。

新增纯函数（`web/src/game/` 下，全部 TDD 带单测）：

| 文件 | 函数 | 职责 |
|---|---|---|
| `runtime/hit.ts` | `resolveHit(player, source, policy, opts)` | 输入玩家位置、碰撞源、policy、当前分数/命数/已收集物 → 输出新位置 + 分数/命数增减 + 是否 game over |
| `runtime/enemy.ts` | `enemyStep(enemy, player, speed, deltaSeconds)` | 直线追逐一步，返回新位置（复用已有 `moveToward`） |
| `runtime/effects.ts` | `nextGrowScale(current, cap)` | grow 累加：`min(current + step, cap)` |

`resolveHit` 是核心：把「弹开 + 扣分/掉命/掉物品 + 无敌」的纯逻辑从 Phaser 抽出来，四种 policy 都能单测覆盖而不碰 Phaser。

## 4. Runtime 实现（CollectScene 改动）

四类对象的渲染与碰撞判定：

| 对象 | 渲染 | 碰撞判定 | 反馈 |
|---|---|---|---|
| collectible | emoji Text | 圆（距玩家 < playerSize） | 加分 → effect → 重生同类 |
| obstacle | emoji Text（静态） | 圆 | 沿「玩家←障碍」方向弹开 |
| hazard | 色块 Rectangle | 玩家中心点进入矩形 | 触发 hitPolicy |
| enemy | emoji Text（动态） | 圆 | 触发 hitPolicy |

- 敌人每帧 `enemyStep()`，不做寻路。
- 失败策略统一走 `applyHit()`：先设 `invulnerableUntil = now + 2000ms`（期间玩家 alpha 闪烁 0↔1，碰撞判定跳过），再按 policy 弹开/扣分/掉命/掉物品。
- grow 特效：维护玩家 `currentScale`，每次 grow 累加，clamp 到 1.6。

## 5. 手写 spec（3 份，各体现不同机制组合）

1. **火山恐龙大冒险**（最丰富）：collectible(grow) + enemy(t-rex) + hazard(岩浆) + obstacle，hitPolicy: lose-score。
2. **小猫捡星星**（轻松）：collectible + obstacle，hitPolicy: bounce。
3. **小兔子拔胡萝卜**（躲狼紧张感）：collectible(grow) + enemy(wolf)，hitPolicy: lose-life。

3 个游戏玩法差异明显，不再是「换皮换分」的同一个东西。

## 6. 测试策略

- 纯函数 TDD（红绿）：重点覆盖 `resolveHit` 四种 policy 分支 + 边界（扣分不出现负分、掉命到 0 触发 game over、无敌期跳过碰撞、drop-item 分数同步扣减）。
- Phaser 场景：type-check + build + 手动运行验证（与第一刀一致）。

## 7. 成功标准

- 3 份 v0.2 spec 校验通过，`objects` 里 4 类对象都能正确渲染并触发各自反馈。
- 敌人会追、碰到会按 hitPolicy 反馈、有无敌闪烁、grow 会累加变大。
- 三种 hitPolicy 各在一份 spec 里跑通，体验上「有紧张感但不至于挫败」。
- 纯函数单测全绿，根目录 type-check / build 全绿。

# 接 LLM：生成新游戏 设计（第一刀）

> 本文档是「第三刀」的设计结论。目标：跑通「孩子说一句话 → LLM 生成 GameSpec → Runtime 可玩」这条核心技术链路。
> 第一刀刻意收窄：只做「生成新游戏」，不做「修改已有游戏」、不做语音、不做多轮对话。

## 0. 背景

前两刀已经把「GameSpec → Phaser Runtime」的确定性底座做扎实（v0.2 四类对象 + 失败策略）。现在整条产品链路里，只剩最前面「孩子说话」这一环是断的——之前用手写 spec 替代了 LLM。

第一刀要验证的核心假设：**LLM 能不能稳定产出合法 GameSpec，并让 Runtime 跑起来。** 这一段与输入是文本还是语音无关。

## 1. 决策记录（ADR 摘要）

| # | 决策 | 结论 |
|---|---|---|
| L1 | 输入方式 | 第一刀文本输入，输入层抽象成 `getKidInput()` 接口，语音第二刀换实现 |
| L2 | 范围 | 第一刀只「生成新游戏」，「修改已有游戏」第二刀 |
| L3 | Agent 形态 | 单次 chat + Zod 校验，不做 ReAct、不做多轮（ReAct 留给 Kid Agent 多轮对话 / Agent Play） |
| L4 | 后端结构 | `llm.service` + `game` 模块，单模型、无 fallback、无熔断 |
| L5 | 失败兜底 | 校验失败重试 2 次 → 仍失败回退默认游戏 → 记日志 |
| L6 | 模型 | 参考 ai-tools `llm.config.ts`，用 `deepseek-v4-pro`（或 flash）单模型 |
| L7 | 前端交互 | 首页＋创造入口 → 输入页 → 生成中 loading → 进游戏页 → 失败无感给默认 |
| L8 | 配置安全 | API key 走 `.env`，不硬编码进仓库 |

## 2. 参考 ai-tools 的取舍

ai-tools（`/Users/weiruifeng/Workspace/ai-tools`）有成熟 LLM 实践，本刀**参考其配置结构与调用方式，砍掉所有企业级基础设施**：

| ai-tools 有的 | 本刀 |
|---|---|
| 多端点 + 多模型注册表 + fallback 链 | ✅ 参考注册表分层，但只保留 1 个模型 |
| `LLMService.chat()`（OpenAI 兼容 + axios） | ✅ 直接参考调用方式 |
| prompt 模板 + `templateVars` 渲染 | ✅ 参考，但 prompt 写代码常量，不进数据库 |
| 熔断器 / event emitter / token 计费 / ReAct runner / session | ❌ 全部砍掉（多租户企业平台才需要） |

关键区别：ai-tools 的 `core/agent`（ReAct 框架）是为了「要调业务工具的 agent」设计的；我们第一刀的 Planner 是「一句话 → JSON」的单步转换，无工具、无多步推理，用单次 chat 即可。ReAct 留到第二刀的 Kid Agent 多轮对话，以及后期的 Agent Play（AI 试玩）。

## 3. 架构

```
孩子（文本输入）
  ↓  getKidInput()  —— 第一刀 <input> 实现，第二刀换 🎤
  ↓
前端 Game 页面
  ↓  POST /api/game/generate  { idea: string }
  ↓
NestJS game.service
  ├─ buildPrompt(idea)          —— 把 v0.2 schema 结构 + 四类对象 + hitPolicy 取值 作为 few-shot 写进 prompt
  ├─ llm.chat(prompt)          —— axios 调 OpenAI 兼容端点，返回 content
  ├─ JSON.parse(content)
  ├─ validateGameSpec(spec)    —— 复用 shared 包的 Zod 校验（单一事实源）
  │      └─ 失败 → 重试（把错误回喂 LLM，最多 2 次）
  │      └─ 仍失败 → 返回默认游戏 spec
  └─ 返回 { spec: CollectSpec }
  ↓
前端 PhaserGame —— 与手写 spec 走同一条 Runtime 路径，零分叉
```

### 3.1 后端文件

```
server/src/
├── config/llm.config.ts            # 端点 + 模型（抄 ai-tools 分层，单模型）
└── modules/
    ├── llm/
    │   └── llm.service.ts          # chat()：axios 调 OpenAI 兼容端点，返回 content
    └── game/
        ├── game.module.ts
        ├── game.controller.ts      # POST /api/game/generate
        ├── game.service.ts         # 编排：buildPrompt → llm.chat → parse → validate → 兜底
        └── prompts/game-planner.prompt.ts  # system prompt + user 模板
```

依赖：`@nestjs/axios` + `axios`（或直接用 axios）。`shared` 包被 server 引用（`validateGameSpec`）。

### 3.2 失败兜底（L5）

1. `validateGameSpec` 抛错 → 把 Zod 错误信息回喂给 LLM，重新生成（最多 2 次重试）。
2. 重试后仍失败 → 返回内置的「默认游戏」spec（恐龙吃草莓，复用 `shared/specs` 里的那份）。
3. 每次失败都 `logger.warn`，为后期 Game Evaluator 收集「哪些输入容易失败」打底。

失败兜底的意义：符合「能确定性解决的不要交给 LLM」「AI 不应该控制所有东西」——AI 生成失败时降级到确定性默认，孩子永远有点得玩的游戏。

## 4. 前端交互（L7）

```
首页（现有 3 张卡片）
  + 新增一个大按钮  ＋ 创造新游戏
  ↓ 点击
输入页
  大输入框 + 「变出来！」按钮
  引导语：「想玩什么游戏？说给魔法师听」
  ↓ 提交
生成中 loading
  「✨ 魔法师正在变魔术……🦖」（LLM 生成 2~5 秒，不能白屏）
  ↓ 成功
游戏页 —— 复用现有 PhaserGame，喂后端返回的 spec
  ↓ 失败（后端已兜底为默认游戏，前端无感）
游戏页 —— 孩子看到的是一个能玩的游戏
```

技术点：
- `getKidInput(): Promise<string>` 接口，第一刀 `<input>` 实现，第二刀 🎤 实现。
- 新增 `POST /api/game/generate`，前端 fetch，vite 配 `/api` 代理到 `localhost:3009`（与 myfe 一致）。

## 5. 明确不做（边界）

- 不做「修改已有游戏」（第二刀）
- 不做语音 STT/TTS（第二刀）
- 不做 Kid Agent 多轮对话（第二刀）
- 不做 ReAct / 工具调用 / Agent Play（后期）
- 不做 prompt 数据库管理 / 熔断 / 多模型 fallback / token 计费
- 不做游戏持久化（生成完即玩，不存库）
- 不做 Game Evaluator（后期）

## 6. 测试策略

- 后端：`game.service` 的失败兜底逻辑可单测（mock `llm.chat` 返回非法 JSON / 合法 spec / 两次失败）。`validateGameSpec` 已在 shared 测过。
- prompt 生成质量：不做自动化断言（LLM 输出不稳定），靠手动运行 + 后续 Evaluator。
- 前端：type-check + build + 手动运行。

## 7. 成功标准

- 输入「我要一只黄恐龙在火山吃草莓」，能生成合法 CollectSpec 并跑起来。
- 输入「我要躲陨石」「我要跳障碍」，Planner 能生成含 enemy/obstacle 的 spec（当前 Runtime 只支持 collect 类型，Dodge/Jump 第二刀）。
- 输入乱码/无关内容，后端不崩溃，回退默认游戏。
- 手动验证：从输入到可玩，全程无报错、有 loading 过渡。

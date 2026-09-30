# 对话式游戏创造（生成 + 修改 + Kid Agent 多轮）设计

> 本文档是「第四刀」的设计结论。目标：把「一句话生成」升级为「会追问、能基于上下文修改」的完整对话式创造体验。
> 沿用第三刀的单模型 LLM 底座；新增 session 状态机 + 多轮追问 + 修改闭环。

## 0. 背景

第三刀跑通了「一句话 → LLM 生成 GameSpec → Runtime 可玩」。但它是单向的：孩子说一句，LLM 一次性生成，没有追问、也不能改。

这一刀补上两块：
1. **Kid Agent 多轮**：信息不够时追问（一次一个问题 + 图标选项），不是「产品经理连环追问」。
2. **修改已有游戏**：孩子玩完说「让恐龙会飞」，基于当前游戏改。

两者统一成一个「对话式规划器」——生成和修改本质都是「孩子说一句，系统基于上下文更新 spec」，区别只在上下文里有没有旧 spec。

## 1. 决策记录（ADR 摘要）

| # | 决策 | 结论 |
|---|---|---|
| C1 | 架构 | 「生成」和「修改」统一成一个有状态的对话式规划器，一个 `/api/game/converse` 端点 |
| C2 | 多轮触发 | LLM 自主判断：每次返回 `{type:'spec',spec}` 或 `{type:'question',question,options}` |
| C3 | 封顶 | 整个 session 累计追问 2 次后，下一次必须输出 spec（不能无限追问） |
| C4 | 追问交互 | 给 2-3 个图标推荐选项；孩子可点选，或不满意自由回答（自由回答 = 下一轮输入） |
| C5 | session 存储 | 内存 Map<sessionId, state>，不持久化（持久化/版本管理是后面「Game Studio」那一刀） |
| C6 | 修改语义 | 全量重生成 + 旧 spec 人类可读摘要作上下文，不做 GameSpec Patch |
| C7 | Runtime 更新 | 前端销毁重建 Phaser（复用现有 PhaserGame，spec prop 变即重建），不热更新 |
| C8 | 前端 UI | 生成/修改共用同一套对话 UI；修改入口在游戏页「🎤 我要改游戏」按钮 |
| C9 | 模型 | 沿用第三刀 `deepseek-v4-pro` 单模型 |

## 2. 对话式规划器（后端）

### 2.1 session 状态

```ts
type SessionState = {
  spec: CollectSpec | null;              // 当前游戏（null = 还没生成）
  history: { role: 'user' | 'assistant'; content: string }[];  // 对话历史（不含 system prompt）
  questionCount: number;                 // 已追问次数（封顶用）
};
```

- 存内存 `Map<string, SessionState>`，key 是 sessionId。
- sessionId 由后端生成（uuid 或时间戳），第一次 `converse` 返回给前端，前端后续带上。

### 2.2 接口

```
POST /api/game/converse
  body: { sessionId?: string, input: string }
  → 200 { sessionId: string, result: ConverseResult }

ConverseResult =
  | { type: 'spec', spec: CollectSpec }
  | { type: 'question', question: string, options: string[] }   // options 2-3 个，如 ['🌋 火山','🌙 月球','🏰 城堡']
```

无 sessionId 时：新建 session，`spec=null`，这是「生成新游戏」。
有 sessionId 且已有 spec 时：这是「修改已有游戏」。

### 2.3 LLM 调用（一次对话 = 一次 LLM 调用）

每次 `converse`：
1. 把 `history` + 孩子本次 `input` 组装成 messages。
2. system prompt 告知 LLM：你是儿童游戏规划器，判断「信息够不够」。
   - 够：输出 `{ "type": "spec", "spec": {...} }`（spec 是完整 GameSpec，schemaVersion 0.2，gameType 固定 collect）。
   - 不够：输出 `{ "type": "question", "question": "...", "options": ["...","..."] }`，只问一个问题。
3. 若是「修改」（session 已有 spec）：system prompt 里附上旧 spec 的人类可读摘要，要求输出**完整新 spec**。
4. 若 `questionCount >= 2`：system prompt 强制要求本次必须输出 spec（不再追问），LLM 用合理默认值补全。
5. 校验输出：spec 走 `validateGameSpec`；question 走轻量结构校验。
6. 更新 session（追加 history、更新 spec/questionCount），返回结果。

### 2.4 失败兜底

- LLM 调用异常 → 若已有 spec，返回旧 spec（改失败就保持原样）；若无 spec，返回内置默认游戏。
- LLM 输出非法（既不是合法 spec 也不是合法 question）→ 视为一次失败，若已到封顶则回退默认/旧 spec。

## 3. 前端交互

### 3.1 对话 UI（生成/修改共用）

一个 `Converse` 组件：
- 输入框 + 提交（文本，语音第二刀换实现）。
- 收到 `question` → 展示问题 + 图标选项按钮（点选）+ 一个「自己说」输入框（自由回答）。
- 收到 `spec` → 进入/更新游戏页。

### 3.2 流程

```
【生成】首页 → ＋创造 → 输入 → (追问?) → spec → 游戏页
【修改】游戏页 → 🎤我要改游戏 → 输入 → (追问?) → spec → 游戏页重建
```

- 首页「创造新游戏」和游戏页「🎤 我要改游戏」都进入对话 UI；前者不带 sessionId，后者带当前 sessionId。
- 游戏页 `PhaserGame` 的 `spec` prop 更新时，React effect `destroy(true)` + `createGame` 重建（现有逻辑，spec 变化即触发）。

## 4. 明确不做（边界）

- 不做 GameSpec Patch（全量重生成）。
- 不做 session 持久化 / 游戏版本管理（后面「Game Studio」）。
- 不做语音 STT/TTS（第二刀，`getKidInput` 接口已预留）。
- 不做 Dodge/Jump 模板（gameType 仍只 collect）。
- 不做 ReAct / 工具调用 / Agent Play（后期）。
- 不做音效/BGM。

## 5. 测试策略

- 后端：`ConversationPlanner` 纯逻辑单测（mock llm），覆盖：
  - 无 session 生成 spec
  - 有 session 修改（旧 spec 摘要进 prompt）
  - 追问返回 question + options
  - 封顶：questionCount 到 2 后强制 spec
  - LLM 异常时回退（有 spec 回旧、无 spec 回默认）
- 前端：type-check + build + 手动运行。
- LLM 输出质量：手动验证 + 后续 Evaluator。

## 6. 成功标准

- 输入「我要恐龙」→ 追问（去哪）+ 选项 → 点选 → 生成可玩游戏。
- 输入「我要躲陨石」→ 不追问（信息够）→ 直接生成含 enemy 的游戏。
- 游戏页点「改游戏」→「让恐龙会飞」→ 游戏重建（新 spec）。
- 输入乱码 → 不崩溃，回退默认/旧游戏。

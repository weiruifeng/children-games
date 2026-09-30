# 对话式游戏创造 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤用 `- [ ]` checkbox 跟踪。

**Goal:** 把「一句话生成」升级为「会追问、能基于上下文修改」的对话式创造。统一 `/api/game/converse` 端点 + 内存 session + 前端对话 UI + 游戏页修改入口。

**Architecture:** 后端新增 `ConversationPlanner`（纯逻辑，替代/扩展现有 `GamePlanner`），维护内存 `Map<sessionId, state>`；一次对话一次 LLM 调用，返回 `spec` 或 `question+options`；封顶 2 次追问。修改时把旧 spec 转成人类可读摘要作上下文，全量重生成。前端新增 `Converse` 对话 UI（生成/修改共用），游戏页「🎤 我要改游戏」按钮接入。

**Tech Stack:** NestJS 10, axios, vitest, TypeScript, React 18, Phaser 3, Zod 3。

**Spec:** `docs/superpowers/specs/2026-09-30-conversation-design.md`。本计划从 spec 出发论证，执行者需同时读 spec 与本文档。

## Global Constraints

- Node >= 20；npm workspaces（shared/web/server）。
- 单模型 `deepseek-v4-pro`，无 fallback、无熔断（沿用第三刀）。
- gameType 只 collect（L9 延续）。
- 复用 shared 的 `validateGameSpec`（相对路径 import shared 源码）。
- session 存内存 Map，不持久化（C5）。
- 修改 = 全量重生成 + 旧 spec 摘要，不做 Patch（C6）。
- Runtime 更新 = 销毁重建 Phaser，不热更新（C7）。
- 追问封顶 2 次（C3）；追问给 2-3 个图标选项，可自由回答（C4）。
- 不做语音/持久化/Dodge-Jump/音效。

## Review Focus

以下 5 类是最可能咬人的失败模式，按最可能排：

1. **LLM 输出「question」但 options 为空或不是数组**：必须校验 question 结构，非法就当作一次失败走兜底。
2. **封顶逻辑失效导致无限追问**：questionCount>=2 时 system prompt 强制 spec，但 LLM 仍可能输出 question，此时必须代码级强制回退。
3. **修改时旧 spec 摘要丢失导致「改飞了」**：修改路径必须把 spec→摘要 放进 prompt，且测试断言 prompt 含摘要关键信息。
4. **sessionId 无效/过期**：前端带一个不存在的 sessionId，后端必须新建 session 而不是 500。
5. **「改失败回旧 spec」但旧 spec 是 null（生成阶段失败）**：兜底分支必须区分「有无旧 spec」。

---

## 文件结构

```
server/src/modules/game/
  game-planner.ts            # 保留（第三刀生成逻辑，供回退）
  conversation-planner.ts    # 新：对话式规划器（纯逻辑）
  conversation-planner.prompt.ts  # 新：对话 system prompt + 摘要函数
  spec-summary.ts            # 新：spec → 人类可读中文摘要
  conversation.service.ts    # 新：@Injectable，持有内存 Map，注入 ConversationPlanner
  conversation.controller.ts # 新：POST /api/game/converse
  game.module.ts             # 改：注册新 controller/service
server/test/
  conversation-planner.test.ts  # 新：纯逻辑单测
web/src/service/game-api.ts  # 改：加 converse()
web/src/pages/Converse.tsx   # 新：对话 UI
web/src/pages/Create.tsx     # 改：改用 Converse 或删（用 Converse 覆盖）
web/src/pages/Game.tsx       # 改：接入「改游戏」→ Converse
web/src/App.tsx              # 改：路由加 converse 流程
web/src/styles/global.css    # 改：追问选项样式
```

### Task 1: spec-summary（spec → 人类可读中文摘要）

**Files:**
- Create: `server/src/modules/game/spec-summary.ts`
- Create: `server/test/spec-summary.test.ts`

**Interfaces:**
- Consumes: `CollectSpec`（shared）。
- Produces: `summarizeSpec(spec: CollectSpec): string`

- [ ] **Step 1: 写失败测试 spec-summary.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { summarizeSpec } from '../src/modules/game/spec-summary';
import type { CollectSpec } from '../../shared/src/index';

const spec: CollectSpec = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '恐龙吃草莓',
  player: { character: 'yellow-dinosaur', movement: 'follow-finger', speed: 300 },
  background: { asset: 'volcano' },
  objects: [
    { type: 'collectible', asset: 'strawberry', score: 10, count: 15, effect: 'grow' },
    { type: 'enemy', asset: 't-rex', speed: 150, count: 1 },
  ],
  hitPolicy: 'lose-score',
  hitScore: 5,
  win: { type: 'score', value: 100 },
};

describe('summarizeSpec', () => {
  it('摘要包含角色、背景、可收集物、敌人、胜利条件', () => {
    const s = summarizeSpec(spec);
    expect(s).toContain('恐龙');
    expect(s).toContain('火山');
    expect(s).toContain('草莓');
    expect(s).toContain('霸王龙');
    expect(s).toContain('100');
  });

  it('摘要包含失败策略', () => {
    expect(summarizeSpec(spec)).toContain('扣分');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -w server`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 spec-summary.ts**

assetId → 中文名的映射（与 proceduralAssets 对应），摘要用一句话串联：

```ts
import type { CollectSpec } from '../../../../shared/src/index';

const ASSET_NAMES: Record<string, string> = {
  'yellow-dinosaur': '黄色小恐龙',
  cat: '小猫',
  rabbit: '小兔子',
  strawberry: '草莓',
  star: '星星',
  carrot: '胡萝卜',
  rock: '石头',
  lava: '岩浆',
  't-rex': '霸王龙',
  wolf: '大灰狼',
  volcano: '火山',
  meadow: '草地',
  sky: '天空',
  space: '太空',
};

const HIT_POLICY_NAMES: Record<string, string> = {
  bounce: '被碰到会弹开',
  'lose-score': '被碰到会扣分',
  'lose-life': '被碰到会掉命',
  'drop-item': '被碰到会掉东西',
};

function objLabel(o: CollectSpec['objects'][number]): string {
  const name = ASSET_NAMES[o.asset] ?? o.asset;
  switch (o.type) {
    case 'collectible': return `${name}（收集，${o.score}分）`;
    case 'obstacle': return `${name}（障碍物）`;
    case 'hazard': return `${name}（危险区）`;
    case 'enemy': return `${name}（追你）`;
  }
}

// 把 spec 转成一段人类可读的中文描述，作为「修改」时的上下文
export function summarizeSpec(spec: CollectSpec): string {
  const player = ASSET_NAMES[spec.player.character] ?? spec.player.character;
  const bg = ASSET_NAMES[spec.background.asset] ?? spec.background.asset;
  const objs = spec.objects.map(objLabel).join('、');
  const hit = HIT_POLICY_NAMES[spec.hitPolicy ?? 'lose-score'] ?? spec.hitPolicy;
  return `游戏「${spec.title}」：${player}在${bg}，有 ${objs || '（无对象）'}，${hit}，捡够 ${spec.win.value} 分赢。`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w server`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add server/src/modules/game/spec-summary.ts server/test/spec-summary.test.ts
git commit -m "feat(server): spec → human-readable summary"
```

---

### Task 2: conversation-planner.prompt + conversation-planner（纯逻辑）

**Files:**
- Create: `server/src/modules/game/conversation-planner.prompt.ts`
- Create: `server/src/modules/game/conversation-planner.ts`
- Create: `server/test/conversation-planner.test.ts`

**Interfaces:**
- Consumes: `LlmService`、`validateGameSpec`、`CollectSpec`、`summarizeSpec`。
- Produces:
  - `type ConverseResult = { type:'spec'; spec:CollectSpec } | { type:'question'; question:string; options:string[] }`
  - `type SessionState = { spec: CollectSpec|null; history: {role,content}[]; questionCount:number }`
  - `ConversationPlanner.converse(state, input): Promise<ConverseResult>`

- [ ] **Step 1: 写 conversation-planner.prompt.ts**

```ts
export const CONVERSATION_SYSTEM_PROMPT = `你是一个儿童游戏规划器。孩子会说一句话，你要么把信息补全后生成一个游戏配置（GameSpec JSON），要么信息不够时追问一个问题。

你必须只输出 JSON，不要输出任何解释、不要用 markdown 代码块包裹。

输出格式二选一：
1. 信息够了：{"type":"spec","spec":{...GameSpec...}}
2. 信息不够：{"type":"question","question":"一个问题","options":["选项1","选项2","选项3"]}

GameSpec 结构（schemaVersion 固定 0.2，gameType 固定 collect）：
{
  "schemaVersion":"0.2","gameType":"collect","orientation":"landscape","title":"简短中文标题",
  "player":{"character":"角色assetId","movement":"follow-finger","speed":300},
  "background":{"asset":"背景assetId"},
  "objects":[
    {"type":"collectible","asset":"可收集物assetId","score":10,"count":15,"effect":"grow"},
    {"type":"obstacle","asset":"障碍物assetId","count":4},
    {"type":"hazard","asset":"危险区assetId","area":{"x":0,"y":600,"width":1280,"height":120}},
    {"type":"enemy","asset":"敌人assetId","speed":150,"count":1}
  ],
  "hitPolicy":"lose-score","hitScore":5,"win":{"type":"score","value":100}
}

规则：
1. gameType 必须 "collect"。「躲陨石」「跳障碍」→ collect + enemy/obstacle。
2. assetId 只能用：yellow-dinosaur, cat, rabbit, strawberry, star, carrot, rock, lava, t-rex, wolf, volcano, meadow, sky, space。
3. effect 只能 "grow" 或 "fly" 或不写。hitPolicy 只能 bounce/lose-score/lose-life/drop-item。
4. 信息不够就追问，一次只问一个问题，options 给 2-3 个带 emoji 的选项。
5. 孩子没说到的细节用合理默认值补全，不要事事追问。
`;

export function buildConverseUserPrompt(input: string, summary?: string, forceSpec?: boolean): string {
  const parts: string[] = [];
  if (summary) parts.push(`当前游戏：${summary}`);
  parts.push(`孩子说：「${input}」`);
  if (forceSpec) parts.push('现在必须生成游戏（不要再追问），信息不全就用合理默认值补全。');
  parts.push('请输出 JSON：');
  return parts.join('\n');
}
```

- [ ] **Step 2: 写 conversation-planner.ts（纯逻辑）**

```ts
import { validateGameSpec, type CollectSpec } from '../../../../shared/src/index';
import type { LlmService, ChatMessage } from '../llm/llm.service';
import { CONVERSATION_SYSTEM_PROMPT, buildConverseUserPrompt } from './conversation-planner.prompt';
import { summarizeSpec } from './spec-summary';

const MAX_QUESTIONS = 2;

export type SessionState = {
  spec: CollectSpec | null;
  history: { role: 'user' | 'assistant'; content: string }[];
  questionCount: number;
};

export type ConverseResult =
  | { type: 'spec'; spec: CollectSpec }
  | { type: 'question'; question: string; options: string[] };

export const DEFAULT_SPEC: CollectSpec = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '恐龙吃草莓',
  player: { character: 'yellow-dinosaur', movement: 'follow-finger', speed: 300 },
  background: { asset: 'volcano' },
  objects: [{ type: 'collectible', asset: 'strawberry', score: 10, count: 15, effect: 'grow' }],
  hitPolicy: 'lose-score',
  hitScore: 5,
  win: { type: 'score', value: 100 },
};

type Logger = { warn: (msg: string) => void };

export class ConversationPlanner {
  constructor(private readonly llm: LlmService, private readonly logger: Logger = { warn: () => {} }) {}

  async converse(state: SessionState, input: string): Promise<ConverseResult> {
    const forceSpec = state.questionCount >= MAX_QUESTIONS;
    const summary = state.spec ? summarizeSpec(state.spec) : undefined;

    const messages: ChatMessage[] = [
      { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
      ...state.history,
      { role: 'user', content: buildConverseUserPrompt(input, summary, forceSpec) },
    ];

    let content: string;
    try {
      content = await this.llm.chat(messages);
    } catch {
      return this.fallback(state);
    }

    const parsed = this.parseJson(content);
    const result = parsed ? this.validate(parsed) : null;

    if (result) {
      if (result.type === 'question' && forceSpec) {
        // LLM 无视强制，仍追问 → 强制回退（代码级兜底）
        return this.fallback(state);
      }
      return result;
    }
    return this.fallback(state);
  }

  // 生成阶段失败 → 默认游戏；修改阶段失败 → 保持旧 spec
  private fallback(state: SessionState): ConverseResult {
    if (state.spec) {
      this.logger.warn('对话失败，保持旧游戏');
      return { type: 'spec', spec: state.spec };
    }
    this.logger.warn('对话失败，回退默认游戏');
    return { type: 'spec', spec: DEFAULT_SPEC };
  }

  private parseJson(content: string): unknown | null {
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    try { return JSON.parse(text); } catch { return null; }
  }

  private validate(parsed: unknown): ConverseResult | null {
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p.type === 'spec') {
      try {
        const spec = validateGameSpec(p.spec);
        if (spec.gameType !== 'collect') return null;
        return { type: 'spec', spec };
      } catch { return null; }
    }
    if (p.type === 'question') {
      const question = p.question;
      const options = p.options;
      if (typeof question !== 'string' || !Array.isArray(options) || options.length === 0) return null;
      const strs = options.filter((o): o is string => typeof o === 'string');
      if (strs.length === 0) return null;
      return { type: 'question', question, options: strs };
    }
    return null;
  }
}
```

- [ ] **Step 3: 写测试 conversation-planner.test.ts**

```ts
import { describe, it, expect, vi } from 'vitest';
import { ConversationPlanner, DEFAULT_SPEC, type SessionState } from '../src/modules/game/conversation-planner';

const validSpec = {
  schemaVersion: '0.2', gameType: 'collect', orientation: 'landscape', title: '测试',
  player: { character: 'cat', movement: 'follow-finger' },
  background: { asset: 'sky' },
  objects: [{ type: 'collectible', asset: 'star', score: 5, count: 10 }],
  win: { type: 'score', value: 100 },
};

function makeLlm(responses: string[]) {
  return { chat: vi.fn().mockImplementation(() => Promise.resolve(responses.shift() ?? '')) };
}

const state = (over?: Partial<SessionState>): SessionState => ({
  spec: null, history: [], questionCount: 0, ...over,
});

describe('ConversationPlanner', () => {
  it('信息够：返回 spec', async () => {
    const llm = makeLlm([JSON.stringify({ type: 'spec', spec: validSpec })]);
    const p = new ConversationPlanner(llm as any);
    const r = await p.converse(state(), '我要捡星星');
    expect(r.type).toBe('spec');
  });

  it('信息不够：返回 question + options', async () => {
    const llm = makeLlm([JSON.stringify({ type: 'question', question: '去哪里？', options: ['🌋 火山', '🌙 月球'] })]);
    const p = new ConversationPlanner(llm as any);
    const r = await p.converse(state(), '我要恐龙');
    expect(r.type).toBe('question');
    if (r.type === 'question') expect(r.options).toHaveLength(2);
  });

  it('修改时：prompt 含旧 spec 摘要', async () => {
    const llm = makeLlm([JSON.stringify({ type: 'spec', spec: validSpec })]);
    const p = new ConversationPlanner(llm as any);
    await p.converse(state({ spec: DEFAULT_SPEC }), '让恐龙会飞');
    const call = (llm.chat as any).mock.calls[0][0];
    expect(JSON.stringify(call)).toContain('当前游戏');
  });

  it('questionCount>=2：prompt 强制 spec', async () => {
    const llm = makeLlm([JSON.stringify({ type: 'spec', spec: validSpec })]);
    const p = new ConversationPlanner(llm as any);
    await p.converse(state({ questionCount: 2 }), '我要恐龙');
    const call = (llm.chat as any).mock.calls[0][0];
    expect(JSON.stringify(call)).toContain('必须生成游戏');
  });

  it('封顶后 LLM 仍追问：强制回退（无旧 spec → 默认游戏）', async () => {
    const llm = makeLlm([JSON.stringify({ type: 'question', question: 'x', options: ['a'] })]);
    const p = new ConversationPlanner(llm as any);
    const r = await p.converse(state({ questionCount: 2 }), '我要恐龙');
    expect(r.type).toBe('spec');
    if (r.type === 'spec') expect(r.spec.title).toBe('恐龙吃草莓');
  });

  it('LLM 异常：无旧 spec 回退默认，有旧 spec 保持旧', async () => {
    const llm = { chat: vi.fn().mockRejectedValue(new Error('401')) };
    const p = new ConversationPlanner(llm as any);
    const r1 = await p.converse(state(), '我要恐龙');
    expect(r1.type).toBe('spec');
    if (r1.type === 'spec') expect(r1.spec.title).toBe('恐龙吃草莓');

    const r2 = await p.converse(state({ spec: validSpec as any }), '改一下');
    expect(r2.type).toBe('spec');
    if (r2.type === 'spec') expect(r2.spec.title).toBe('测试');
  });
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -w server`
Expected: 6 个测试全绿。

- [ ] **Step 5: 提交**

```bash
git add server/src/modules/game/conversation-planner.prompt.ts server/src/modules/game/conversation-planner.ts server/test/conversation-planner.test.ts
git commit -m "feat(server): ConversationPlanner (multi-turn + modify + fallback)"
```

---

### Task 3: conversation.service + controller + module

**Files:**
- Create: `server/src/modules/game/conversation.service.ts`
- Create: `server/src/modules/game/conversation.controller.ts`
- Modify: `server/src/modules/game/game.module.ts`

**Interfaces:**
- Consumes: `ConversationPlanner`、`SessionState`、`LlmService`。
- Produces: `POST /api/game/converse` → `{ sessionId, result }`

- [ ] **Step 1: 写 conversation.service.ts（持有内存 Map）**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import { ConversationPlanner, type SessionState } from './conversation-planner';

@Injectable()
export class ConversationService {
  private readonly planner: ConversationPlanner;
  private readonly logger = new Logger(ConversationService.name);
  private readonly sessions = new Map<string, SessionState>();

  constructor(llm: LlmService) {
    this.planner = new ConversationPlanner(llm, this.logger);
  }

  async converse(sessionId: string | undefined, input: string) {
    const id = sessionId && this.sessions.has(sessionId) ? sessionId : randomUUID();
    const state = this.sessions.get(id) ?? { spec: null, history: [], questionCount: 0 };

    const result = await this.planner.converse(state, input);

    // 更新 session
    state.history.push({ role: 'user', content: input });
    if (result.type === 'question') {
      state.questionCount += 1;
      state.history.push({ role: 'assistant', content: result.question });
    } else {
      state.spec = result.spec;
      state.questionCount = 0; // 新游戏后重置追问计数
      state.history.push({ role: 'assistant', content: '生成游戏' });
    }
    this.sessions.set(id, state);

    return { sessionId: id, result };
  }
}
```

- [ ] **Step 2: 写 conversation.controller.ts**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ConversationService } from './conversation.service';

class ConverseDto {
  sessionId?: string;
  input!: string;
}

@Controller('game')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('converse')
  async converse(@Body() body: ConverseDto) {
    return this.conversationService.converse(body.sessionId, body.input);
  }
}
```

- [ ] **Step 3: 改 game.module.ts 注册**

```ts
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { LlmService } from '../llm/llm.service';

@Module({
  controllers: [GameController, ConversationController],
  providers: [GameService, ConversationService, LlmService],
})
export class GameModule {}
```

- [ ] **Step 4: 验证编译**

Run: `npm run build -w server`
Expected: 编译成功。

- [ ] **Step 5: 提交**

```bash
git add server/src/modules/game/conversation.service.ts server/src/modules/game/conversation.controller.ts server/src/modules/game/game.module.ts
git commit -m "feat(server): /api/game/converse endpoint + in-memory session"
```

---

### Task 4: 前端 Converse 对话 UI + 接入

**Files:**
- Modify: `web/src/service/game-api.ts`
- Create: `web/src/pages/Converse.tsx`
- Modify: `web/src/pages/Create.tsx`
- Modify: `web/src/pages/Game.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Consumes: `POST /api/game/converse`。
- Produces:
  - `converse(sessionId, input): Promise<{sessionId, result}>`
  - `Converse` 组件（生成/修改共用）
  - `Game` 组件接入「改游戏」

- [ ] **Step 1: game-api.ts 加 converse()**

```ts
import type { CollectSpec } from '@children-games/shared';

export type ConverseResult =
  | { type: 'spec'; spec: CollectSpec }
  | { type: 'question'; question: string; options: string[] };

export async function converse(sessionId: string | undefined, input: string): Promise<{ sessionId: string; result: ConverseResult }> {
  const res = await fetch('/api/game/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, input }),
  });
  if (!res.ok) throw new Error(`对话失败: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: 写 Converse.tsx（对话 UI）**

```tsx
import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import { converse, type ConverseResult } from '../service/game-api';

export default function Converse({
  sessionId: initialSessionId,
  initialText,
  onSpec,
  onBack,
}: {
  sessionId?: string;
  initialText?: string;
  onSpec: (spec: CollectSpec, sessionId: string) => void;
  onBack: () => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [input, setInput] = useState(initialText ?? '');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');
    try {
      const res = await converse(sessionId, text.trim());
      setSessionId(res.sessionId);
      if (res.result.type === 'spec') {
        onSpec(res.result.spec, res.sessionId);
      } else {
        setQuestion(res.result.question);
        setOptions(res.result.options);
      }
    } catch {
      setError('魔法师走神了，再试一次吧');
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    send(input);
    setInput('');
  }

  if (loading) {
    return <div className="create-page"><div className="loading">✨ 魔法师正在变魔术…… 🦖</div></div>;
  }

  return (
    <div className="create-page">
      <h1>{question ? question : '想玩什么游戏？说给魔法师听'}</h1>
      {question && (
        <div className="option-grid">
          {options.map((o) => (
            <button key={o} className="option-btn" onClick={() => send(o)}>{o}</button>
          ))}
        </div>
      )}
      <input
        className="idea-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={question ? '或者自己说' : '比如：一只黄恐龙在火山吃草莓'}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <button className="big-btn" onClick={submit}>✨ 变出来！</button>
      {error && <div className="error">{error}</div>}
      <button className="back-btn" onClick={onBack}>🏠 返回</button>
    </div>
  );
}
```

> 注：选项点击直接 `send(o)`（把选项文本当输入发给后端），符合 spec 的「自由回答 = 下一轮输入」——选项本质上也是一段确定的输入。

- [ ] **Step 3: 删 Create.tsx，App.tsx 改用 Converse**

App.tsx 路由加 `converse`（生成，无 sessionId）和 `converse-modify`（修改，带 sessionId）：

```tsx
import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import Home from './pages/Home';
import Game from './pages/Game';
import Converse from './pages/Converse';
import { GAMES } from './game/specs';

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'modify'; sessionId: string }
  | { name: 'game'; spec: CollectSpec; sessionId?: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (route.name === 'create') {
    return (
      <Converse
        onBack={() => setRoute({ name: 'home' })}
        onSpec={(spec, sessionId) => setRoute({ name: 'game', spec, sessionId })}
      />
    );
  }
  if (route.name === 'modify') {
    return (
      <Converse
        sessionId={route.sessionId}
        onBack={() => setRoute({ name: 'home' })}
        onSpec={(spec, sessionId) => setRoute({ name: 'game', spec, sessionId })}
      />
    );
  }
  if (route.name === 'game') {
    return (
      <Game
        spec={route.spec}
        sessionId={route.sessionId}
        onBack={() => setRoute({ name: 'home' })}
        onModify={(sessionId) => setRoute({ name: 'modify', sessionId })}
      />
    );
  }
  return (
    <Home
      onPlay={(id) => {
        const g = GAMES.find((x) => x.id === id);
        if (g) setRoute({ name: 'game', spec: g.spec });
      }}
      onCreate={() => setRoute({ name: 'create' })}
    />
  );
}
```

- [ ] **Step 4: 改 Game.tsx 接入「改游戏」**

```tsx
import type { CollectSpec } from '@children-games/shared';
import PhaserGame from '../game/PhaserGame';

export default function Game({
  spec,
  sessionId,
  onBack,
  onModify,
}: {
  spec: CollectSpec;
  sessionId?: string;
  onBack: () => void;
  onModify: (sessionId: string) => void;
}) {
  return (
    <div className="game-page">
      <PhaserGame spec={spec} />
      <div className="game-overlay">
        <button className="overlay-btn" onClick={onBack}>🏠</button>
        <button className="overlay-btn big" onClick={() => sessionId && onModify(sessionId)}>
          🎤 我要改游戏
        </button>
      </div>
    </div>
  );
}
```

> 注：内置游戏（从 GAMES 进入）没有 sessionId，点「改游戏」无效果（或可第一刀先隐藏改按钮，仅 LLM 生成的游戏显示）。用 `sessionId &&` 守卫，内置游戏不改。

- [ ] **Step 5: 删 Create.tsx**

```bash
rm web/src/pages/Create.tsx
```

- [ ] **Step 6: 追加 global.css 样式**

```css
.option-grid { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.option-btn { padding: 16px 28px; font-size: 28px; border: 3px solid #444; border-radius: 16px; background: #1c1c3a; color: #fff; cursor: pointer; }
.option-btn:active { background: #2c2c5a; }
```

- [ ] **Step 7: type-check + build**

Run: `npm run type-check -w web && npm run build -w web`
Expected: 无类型错误，build 成功。

- [ ] **Step 8: 提交**

```bash
git add web/src web/vite.config.ts
git commit -m "feat(web): Converse dialog UI + modify-game entry"
```

---

### Task 5: 端到端手动验证

- [ ] **Step 1: 启动 + 验证生成带追问**

```bash
npm run dev
```
浏览器 → ＋创造 → 输入「我要恐龙」→ 预期返回追问（去哪？）+ 选项 → 点「🌋 火山」→ 生成游戏。

- [ ] **Step 2: 验证信息够时不追问**

输入「我要黄恐龙在火山吃草莓」→ 直接生成游戏。

- [ ] **Step 3: 验证修改**

游戏页点「🎤 我要改游戏」→ 输入「让恐龙会飞」→ 游戏重建（新 spec）。

- [ ] **Step 4: 验证乱码兜底**

输入「asdfgh」→ 不崩溃，回退默认/旧游戏。

- [ ] **Step 5: 提交（如有遗漏）**

```bash
git add -A && git commit -m "chore: finalize conversation flow"
```

---

## Self-Review 记录

- **Spec 覆盖**：C1（统一端点）→ Task2/3；C2（LLM 判断）→ Task2；C3（封顶2次）→ Task2 forceSpec + 测试；C4（选项/自由回答）→ Task4 Converse；C5（内存Map）→ Task3；C6（全量重生成+摘要）→ Task1/2；C7（销毁重建）→ 现有 PhaserGame 已支持；C8（共用UI）→ Task4；C9（单模型）→ 沿用。
- **类型一致性**：`ConverseResult`/`SessionState` 在 Task2 定义，Task3/4 使用一致；`summarizeSpec` Task1 定义、Task2 使用。
- **Review Focus 覆盖**：1（question options 空）→ Task2 validate；2（封顶失效）→ Task2 forceSpec 代码级兜底 + 测试；3（摘要丢失）→ Task2 测试断言 prompt 含「当前游戏」；4（无效 sessionId）→ Task3 服务层 `sessions.has` 判断新建；5（无旧 spec 兜底）→ Task2 fallback 分支 + 测试。
- **已知边界**：LLM 输出质量无自动化断言；前端靠 type-check + 手动。

---

**执行方式：** 本计划含 5 个任务，接口逐层依赖（summary → planner → service → 前端）。请先 review 本计划，确认后选择执行方式（subagent-driven 或 native）。

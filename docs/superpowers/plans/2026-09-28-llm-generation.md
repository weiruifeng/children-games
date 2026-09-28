# 接 LLM：生成新游戏 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤用 `- [ ]` checkbox 跟踪。

**Goal:** 跑通「孩子输入一句话 → LLM 生成合法 CollectSpec → Phaser Runtime 可玩」的核心链路。第一刀只做生成新游戏（文本输入），不做修改/语音/多轮。

**Architecture:** NestJS 端新增 `llm.service`（axios 调 OpenAI 兼容端点）+ `game` 模块（`GamePlanner` 纯逻辑：buildPrompt → llm.chat → JSON.parse → validateGameSpec → 重试 → 兜底）。复用 shared 包的 Zod 校验（单一事实源）。前端新增「创造新游戏」入口 + 输入页 + loading + 复用现有 PhaserGame。输入层抽象成 `getKidInput()` 接口。

**Tech Stack:** NestJS 10, axios, vitest（server 复用 web 的工具链）, TypeScript, React 18, Phaser 3, Zod 3。

**Spec:** `docs/superpowers/specs/2026-09-28-llm-generation-design.md`。本计划从 spec 出发论证，执行者需同时读 spec 与本文档。

## Global Constraints

- Node >= 20；npm workspaces（shared/web/server）。
- API key 走 `.env`，不硬编码进仓库（L8）。`.env` 已在 .gitignore。
- 单模型、无 fallback、无熔断（L4/L6）。
- 第一刀只生成 `collect` 类型（L9）：Prompt 约束 LLM 只输出 `gameType: "collect"`。
- 复用 shared 的 `validateGameSpec`（单一事实源），server 通过 tsconfig paths 引用 shared 源文件。
- 失败兜底：校验失败重试 2 次 → 仍失败回退默认游戏 → logger.warn（L5）。
- 输入层抽象 `getKidInput(): Promise<string>`，第一刀 `<input>` 实现。
- 不做修改游戏/语音/多轮/ReAct/持久化/Evaluator。

## Review Focus

以下 5 类是最可能咬人的失败模式，按最可能排：

1. **LLM 返回非 JSON 或包裹在 markdown 代码块里**：`JSON.parse` 前必须先剥离 ```json ... ``` 包裹。
2. **LLM 生成 `gameType: "dodge"/"jump"`**：第一刀 Runtime 只有 CollectScene，必须兜底（validate 通过但 gameType 非 collect 时也要回退/纠正）。
3. **重试把错误回喂给 LLM 后仍失败，且默认游戏也拿不到**：默认 spec 必须内联为 server 常量，不依赖文件读取。
4. **server 编译/运行无法解析 shared 的 .ts**：tsconfig paths + include 必须配好，否则 nest build 和 dev 都失败。
5. **LLM 生成的 `objects` 数组为空或四类对象字段缺失**：validateGameSpec 会抓，但重试 prompt 要带上具体错误。

---

## 文件结构

```
server/
  .env.example                    # 模板（baseUrl/model/apiKey 占位）
  .env                            # 真实配置（gitignore，用户自己填）
  tsconfig.json                   # 改：paths + baseUrl + include shared
  package.json                    # 改：加 axios + @children-games/shared + vitest
  src/config/llm.config.ts        # 新：端点 + 模型（单模型，key 从 env 读）
  src/modules/llm/llm.service.ts  # 新：chat()，axios 调 OpenAI 兼容端点
  src/modules/game/
    game-planner.ts               # 新：纯逻辑（buildPrompt + 重试 + 兜底），无 NestJS 装饰器
    game-planner.prompt.ts        # 新：system prompt + user 模板（few-shot）
    game.service.ts               # 新：@Injectable 薄封装，注入 LlmService 委托 GamePlanner
    game.controller.ts            # 新：POST /api/game/generate
    game.module.ts                # 新：注册
  src/app.module.ts               # 改：注册 GameModule
  test/game-planner.test.ts       # 新：兜底逻辑单测
web/
  vite.config.ts                  # 改：加 /api 代理到 localhost:3009
  src/game/input.ts               # 新：getKidInput() 接口 + 文本实现
  src/service/game-api.ts         # 新：generateGame(idea) → fetch POST
  src/pages/Create.tsx            # 新：输入页 + loading 状态
  src/pages/Game.tsx              # 改：支持直接传 spec（生成的新游戏）
  src/App.tsx                     # 改：加 create 路由 + 生成后的游戏路由
  src/pages/Home.tsx              # 改：加「＋ 创造新游戏」入口
  src/styles/global.css           # 改：输入页/loading 样式
```

### Task 1: server 集成 shared + LLM 配置 + llm.service

**Files:**
- Modify: `server/tsconfig.json`
- Modify: `server/package.json`
- Create: `server/.env.example`
- Create: `server/src/config/llm.config.ts`
- Create: `server/src/modules/llm/llm.service.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `LlmService.chat(messages: {role,content}[], opts?): Promise<string>`（返回纯文本 content）
  - `LLM_MODEL` / `LLM_ENDPOINT` 常量（从 env 读）

- [ ] **Step 1: 改 server/tsconfig.json（让 server 能编译 shared 的 .ts）**

关键：server 是 CommonJS，shared 是 ESM 源码。用 tsconfig paths 把 `@children-games/shared` 映射到 shared 源文件，并 include 进来，让 tsc/ts-node 都按 server 的 commonjs 设置编译 shared 源码（shared 源文件本身是模块格式无关的）。

在 `compilerOptions` 加 `baseUrl` 和 `paths`，`include` 加 shared：

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@children-games/shared": ["../shared/src/index.ts"]
    }
  },
  "include": ["src/**/*", "test/**/*", "../shared/src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> 注：`resolveJsonModule` 无需开（shared 源文件不 import json）。若 `incremental` + 跨目录 include 引发 tsbuildinfo 冲突，改 `"incremental": false`。

- [ ] **Step 2: 改 server/package.json**

在 `dependencies` 加 `axios`；在 `devDependencies` 加 `vitest`；`scripts` 加 test：

```json
"dependencies": {
  "@nestjs/common": "^10.4.15",
  "@nestjs/config": "^3.3.0",
  "@nestjs/core": "^10.4.15",
  "@nestjs/platform-express": "^10.4.15",
  "axios": "^1.9.0",
  "reflect-metadata": "^0.2.2",
  "rxjs": "^7.8.1"
},
"devDependencies": {
  "@nestjs/cli": "^10.4.9",
  "@nestjs/schematics": "^10.2.3",
  "@types/node": "^20.17.0",
  "source-map-support": "^0.5.21",
  "ts-node": "^10.9.2",
  "tsconfig-paths": "^4.2.0",
  "typescript": "~5.6.2",
  "vitest": "^3.0.0"
},
"scripts": {
  "build": "nest build",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:prod": "node dist/main",
  "type-check": "tsc --noEmit -p tsconfig.json",
  "test": "vitest run"
}
```

> 注：`@children-games/shared` 不写进 server 依赖，通过 tsconfig paths 引用（server 直接编译 shared 源文件）。这样避免 ESM/CJS 产物冲突。

- [ ] **Step 3: 写 .env.example**

```bash
# LLM 配置（复制成 .env 后填真实值）
LLM_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_API_KEY=
LLM_MODEL=deepseek-v4-pro
PORT=3009
```

- [ ] **Step 4: 写 llm.config.ts**

```ts
export const LLM_ENDPOINT = {
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.LLM_API_KEY ?? '',
  timeout: 60000,
};

export const LLM_MODEL = process.env.LLM_MODEL ?? 'deepseek-v4-pro';

export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_TEMPERATURE = 0.7;
```

- [ ] **Step 5: 写 llm.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LLM_ENDPOINT, LLM_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '../../config/llm.config';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  // 调 OpenAI 兼容端点，返回助手回复的纯文本 content
  async chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const res = await axios.post(
      `${LLM_ENDPOINT.baseUrl}/chat/completions`,
      {
        model: LLM_MODEL,
        messages,
        temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      },
      {
        headers: { Authorization: `Bearer ${LLM_ENDPOINT.apiKey}` },
        timeout: LLM_ENDPOINT.timeout,
      },
    );
    const content = res.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('LLM 返回缺少 content');
    }
    return content;
  }
}
```

- [ ] **Step 6: 验证编译**

Run: `npm install` 然后 `npm run build -w server`
Expected: 编译成功（shared 源码被一起编译）。

- [ ] **Step 7: 提交**

```bash
git add server/tsconfig.json server/package.json server/.env.example server/src/config server/src/modules/llm package-lock.json
git commit -m "feat(server): LLM config + LlmService (axios, OpenAI-compatible)"
```

---

### Task 2: GamePlanner + GameService + Controller + prompt

**Files:**
- Create: `server/src/modules/game/game-planner.prompt.ts`
- Create: `server/src/modules/game/game-planner.ts`
- Create: `server/src/modules/game/game.service.ts`
- Create: `server/src/modules/game/game.controller.ts`
- Create: `server/src/modules/game/game.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `LlmService.chat`（Task 1）、`validateGameSpec` / `CollectSpec`（shared）。
- Produces:
  - `GamePlanner.generate(idea: string): Promise<CollectSpec>`（纯逻辑，可注入 mock llm）
  - `POST /api/game/generate` → `{ spec: CollectSpec }`

- [ ] **Step 1: 写 game-planner.prompt.ts**

```ts
export const SYSTEM_PROMPT = `你是一个儿童游戏生成器。孩子会说一句话，比如「我要一只黄色小恐龙在火山吃草莓」，你要把它变成一个游戏配置（GameSpec JSON）。

你必须只输出 JSON，不要输出任何解释、不要用 markdown 代码块包裹。

JSON 结构如下（schemaVersion 固定 0.2，gameType 固定 collect）：
{
  "schemaVersion": "0.2",
  "gameType": "collect",
  "orientation": "landscape",
  "title": "游戏标题（简短，中文）",
  "player": { "character": "角色assetId", "movement": "follow-finger", "speed": 300 },
  "background": { "asset": "背景assetId" },
  "objects": [  // 数组，1 到多个对象，type 有四种
    { "type": "collectible", "asset": "可收集物assetId", "score": 10, "count": 15, "effect": "grow" },
    { "type": "obstacle", "asset": "障碍物assetId", "count": 4 },
    { "type": "hazard", "asset": "危险区assetId", "area": { "x": 0, "y": 600, "width": 1280, "height": 120 } },
    { "type": "enemy", "asset": "敌人assetId", "speed": 150, "count": 1 }
  ],
  "hitPolicy": "lose-score",
  "hitScore": 5,
  "win": { "type": "score", "value": 100 }
}

规则：
1. gameType 必须是 "collect"。如果孩子说「躲陨石」「跳障碍」，把它们理解成 collect 类型：躲陨石 = collect + enemy（陨石追孩子），跳障碍 = collect + obstacle。
2. assetId 只能用这些：yellow-dinosaur, cat, rabbit, strawberry, star, carrot, rock, lava, t-rex, wolf, volcano, meadow, sky, space。
3. effect 只能是 "grow" 或 "fly"，或者不写。
4. hitPolicy 只能是 bounce / lose-score / lose-life / drop-item 之一。
5. hitScore 是正整数（默认 5）。
6. win.value 是正整数（建议 50 到 200）。
7. count 是正整数。
8. 孩子没说到的细节，用合理的默认值补全（比如背景、分数）。

示例：
孩子说「我要小猫在太空捡星星」→
{"schemaVersion":"0.2","gameType":"collect","orientation":"landscape","title":"小猫捡星星","player":{"character":"cat","movement":"follow-finger","speed":350},"background":{"asset":"space"},"objects":[{"type":"collectible","asset":"star","score":5,"count":30}],"hitPolicy":"bounce","win":{"type":"score","value":100}}
`;

export function buildUserPrompt(idea: string): string {
  return `孩子说：「${idea}」\n\n请生成 GameSpec JSON：`;
}

export function buildRetryPrompt(error: string): string {
  return `你上次生成的 JSON 校验失败，错误是：${error}\n\n请修正后重新输出 JSON，不要输出任何解释。`;
}
```

- [ ] **Step 2: 写 game-planner.ts（纯逻辑，无 NestJS 装饰器）**

```ts
import { validateGameSpec, type CollectSpec } from '@children-games/shared';
import type { LlmService } from '../llm/llm.service';
import { SYSTEM_PROMPT, buildUserPrompt, buildRetryPrompt } from './game-planner.prompt';

const MAX_RETRIES = 2;

// 默认游戏（内联，不依赖文件读取，保证兜底永远可用）
const DEFAULT_SPEC: CollectSpec = {
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

export class GamePlanner {
  constructor(
    private readonly llm: LlmService,
    private readonly logger: { warn: (msg: string) => void } = { warn: () => {} },
  ) {}

  async generate(idea: string): Promise<CollectSpec> {
    let messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserPrompt(idea) },
    ];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const content = await this.llm.chat(messages);
      const parsed = this.parseJson(content);
      if (parsed) {
        const spec = this.toCollect(parsed);
        if (spec) return spec;
      }
      // 回喂错误，重试
      messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: buildUserPrompt(idea) },
        { role: 'assistant' as const, content },
        { role: 'user' as const, content: buildRetryPrompt('生成的 JSON 非法或不是 collect 类型') },
      ];
    }

    this.logger.warn(`GamePlanner 生成失败，回退默认游戏。idea=${idea}`);
    return DEFAULT_SPEC;
  }

  // 剥离 markdown 代码块包裹，再 JSON.parse；失败返回 null
  private parseJson(content: string): unknown | null {
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // 校验并收紧到 collect；非法返回 null
  private toCollect(parsed: unknown): CollectSpec | null {
    try {
      const spec = validateGameSpec(parsed);
      if (spec.gameType !== 'collect') return null;
      return spec;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 3: 写 game.service.ts（薄封装）**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { GamePlanner } from './game-planner';

@Injectable()
export class GameService {
  private readonly planner: GamePlanner;
  private readonly logger = new Logger(GameService.name);

  constructor(llm: LlmService) {
    this.planner = new GamePlanner(llm, this.logger);
  }

  generate(idea: string) {
    return this.planner.generate(idea);
  }
}
```

- [ ] **Step 4: 写 game.controller.ts**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { GameService } from './game.service';

class GenerateDto {
  idea!: string;
}

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('generate')
  async generate(@Body() body: GenerateDto) {
    const spec = await this.gameService.generate(body.idea);
    return { spec };
  }
}
```

- [ ] **Step 5: 写 game.module.ts**

```ts
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { LlmService } from '../llm/llm.service';

@Module({
  controllers: [GameController],
  providers: [GameService, LlmService],
})
export class GameModule {}
```

- [ ] **Step 6: 改 app.module.ts 注册 GameModule**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GameModule } from './modules/game/game.module';

@Module({
  imports: [GameModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: 验证编译**

Run: `npm run build -w server`
Expected: 编译成功。

- [ ] **Step 8: 提交**

```bash
git add server/src/modules/game server/src/app.module.ts
git commit -m "feat(server): GamePlanner + generate endpoint (NL → GameSpec)"
```

---

### Task 3: GamePlanner 兜底逻辑单测

**Files:**
- Create: `server/test/game-planner.test.ts`

**Interfaces:**
- Consumes: `GamePlanner`（Task 2）。
- Produces: 无。

- [ ] **Step 1: 写失败测试 game-planner.test.ts**

```ts
import { describe, it, expect, vi } from 'vitest';
import { GamePlanner } from '../src/modules/game/game-planner';

const validSpec = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '测试',
  player: { character: 'cat', movement: 'follow-finger' },
  background: { asset: 'sky' },
  objects: [{ type: 'collectible', asset: 'star', score: 5, count: 10 }],
  win: { type: 'score', value: 100 },
};

function makeLlm(responses: string[]) {
  return { chat: vi.fn().mockImplementation(() => Promise.resolve(responses.shift() ?? '')) };
}

describe('GamePlanner', () => {
  it('正常生成合法 spec', async () => {
    const llm = makeLlm([JSON.stringify(validSpec)]);
    const planner = new GamePlanner(llm as any);
    const spec = await planner.generate('我要捡星星');
    expect(spec.gameType).toBe('collect');
    expect(spec.title).toBe('测试');
    expect(llm.chat).toHaveBeenCalledTimes(1);
  });

  it('markdown 代码块包裹时也能解析', async () => {
    const llm = makeLlm(['```json\n' + JSON.stringify(validSpec) + '\n```']);
    const planner = new GamePlanner(llm as any);
    const spec = await planner.generate('我要捡星星');
    expect(spec.gameType).toBe('collect');
  });

  it('首次返回非 JSON，重试后成功', async () => {
    const llm = makeLlm(['这不是JSON', JSON.stringify(validSpec)]);
    const planner = new GamePlanner(llm as any);
    const spec = await planner.generate('我要捡星星');
    expect(spec.gameType).toBe('collect');
    expect(llm.chat).toHaveBeenCalledTimes(2);
  });

  it('生成 dodge 类型时被拒绝并重试', async () => {
    const dodge = { ...validSpec, gameType: 'dodge' };
    const llm = makeLlm([JSON.stringify(dodge), JSON.stringify(validSpec)]);
    const planner = new GamePlanner(llm as any);
    const spec = await planner.generate('我要躲陨石');
    expect(spec.gameType).toBe('collect');
    expect(llm.chat).toHaveBeenCalledTimes(2);
  });

  it('重试耗尽仍失败，回退默认游戏', async () => {
    const llm = makeLlm(['坏输出1', '坏输出2', '坏输出3']); // 1 + 2 次重试 = 3 次
    const logger = { warn: vi.fn() };
    const planner = new GamePlanner(llm as any, logger as any);
    const spec = await planner.generate('随便');
    expect(spec.gameType).toBe('collect');
    expect(spec.title).toBe('恐龙吃草莓');
    expect(logger.warn).toHaveBeenCalled();
    expect(llm.chat).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npm test -w server`
Expected: 5 个测试全绿。

> 注：vitest 在 server（commonjs + decorators）里跑，若遇到 decorator 编译问题，因 GamePlanner 无装饰器、测试不 import NestJS 装饰器文件，应无碍。若 vitest 无法解析 tsconfig paths 的 shared，在 `server` 加 `vitest.config.ts` 配 `resolve.alias`。

- [ ] **Step 3: 提交**

```bash
git add server/test
git commit -m "test(server): GamePlanner fallback logic"
```

---

### Task 4: 前端输入层 + 创造入口 + 输入页 + 游戏页

**Files:**
- Create: `web/src/game/input.ts`
- Create: `web/src/service/game-api.ts`
- Create: `web/src/pages/Create.tsx`
- Modify: `web/src/pages/Home.tsx`
- Modify: `web/src/pages/Game.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles/global.css`
- Modify: `web/vite.config.ts`

**Interfaces:**
- Consumes: `POST /api/game/generate`、`CollectSpec`（shared）、`PhaserGame`。
- Produces:
  - `getKidInput(): Promise<string>`（接口 + 文本实现）
  - `generateGame(idea: string): Promise<CollectSpec>`
  - `Create` / `Game`（支持直接传 spec）/ `Home`（创造入口）

- [ ] **Step 1: 写 input.ts（输入层抽象）**

```ts
// 输入层抽象：第一刀文本，第二刀换语音实现
export type KidInput = { getInput: () => Promise<string> };

// 文本实现：用 <input> 弹窗或自定义输入框
export function createTextInput(): KidInput {
  return {
    getInput: () => new Promise<string>((resolve) => {
      // 实际由 React 组件承载，这里仅作为接口占位
      // 组件拿到输入后 resolve
      void resolve;
    }),
  };
}
```

> 注：文本输入第一刀直接在 `Create.tsx` 里用 `<input>` + `onSubmit` 实现，`getKidInput` 接口先定义但由组件直接调用 `generateGame`。为保持「输入层抽象」，`Create.tsx` 内部用一个 `inputMode` 变量标记（文本/语音），第二刀再加语音分支。此接口文件先立起来，不强制抽出。

- [ ] **Step 2: 写 game-api.ts**

```ts
import type { CollectSpec } from '@children-games/shared';

export async function generateGame(idea: string): Promise<CollectSpec> {
  const res = await fetch('/api/game/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea }),
  });
  if (!res.ok) throw new Error(`生成失败: ${res.status}`);
  const data = await res.json();
  return data.spec as CollectSpec;
}
```

- [ ] **Step 3: 写 Create.tsx**

```tsx
import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import { generateGame } from '../service/game-api';

export default function Create({ onCreated }: { onCreated: (spec: CollectSpec) => void }) {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const spec = await generateGame(idea.trim());
      onCreated(spec);
    } catch (e) {
      setError('魔法师走神了，再试一次吧');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="create-page">
        <div className="loading">✨ 魔法师正在变魔术…… 🦖</div>
      </div>
    );
  }

  return (
    <div className="create-page">
      <h1>想玩什么游戏？说给魔法师听</h1>
      <input
        className="idea-input"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="比如：一只黄恐龙在火山吃草莓"
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <button className="big-btn" onClick={submit}>✨ 变出来！</button>
      {error && <div className="error">{error}</div>}
      <button className="back-btn" onClick={() => window.history.length > 1 ? undefined : undefined}>🏠 返回</button>
    </div>
  );
}
```

> 注：返回按钮需要 `onBack` prop，改用 `Create({ onCreated, onBack })`。

- [ ] **Step 4: 改 Home.tsx 加创造入口**

在 game-grid 后加：
```tsx
<button className="game-card create-card" onClick={onCreate}>
  <span className="game-emoji">✨</span>
  <span className="game-title">创造新游戏</span>
</button>
```
Home props 改为 `{ onPlay, onCreate }`。

- [ ] **Step 5: 改 Game.tsx 支持直接传 spec**

当前 Game 按 `id` 查 GAMES。改成两种模式：传 `spec` 直接玩，或传 `id` 查内置。最简单：改为接收 `spec` + `title`：

```tsx
import type { CollectSpec } from '@children-games/shared';
import PhaserGame from '../game/PhaserGame';

export default function Game({ spec, title, onBack }: { spec: CollectSpec; title: string; onBack: () => void }) {
  return (
    <div className="game-page">
      <PhaserGame spec={spec} />
      <div className="game-overlay">
        <button className="overlay-btn" onClick={onBack}>🏠</button>
        <button className="overlay-btn big">🎤 我要改游戏</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 改 App.tsx 加路由**

```tsx
import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import Home from './pages/Home';
import Game from './pages/Game';
import Create from './pages/Create';
import { GAMES } from './game/specs';

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'game'; spec: CollectSpec; title: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (route.name === 'create') {
    return <Create onBack={() => setRoute({ name: 'home' })} onCreated={(spec) => setRoute({ name: 'game', spec, title: spec.title })} />;
  }
  if (route.name === 'game') {
    return <Game spec={route.spec} title={route.title} onBack={() => setRoute({ name: 'home' })} />;
  }
  return (
    <Home
      onPlay={(id) => {
        const g = GAMES.find((x) => x.id === id);
        if (g) setRoute({ name: 'game', spec: g.spec, title: g.spec.title });
      }}
      onCreate={() => setRoute({ name: 'create' })}
    />
  );
}
```

- [ ] **Step 7: 改 vite.config.ts 加 /api 代理**

在 `server` 里加 proxy：
```ts
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://localhost:3009',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 8: 追加 global.css 样式**

```css
.create-page { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 24px; }
.create-page h1 { font-size: 36px; }
.idea-input { width: 70%; max-width: 600px; font-size: 28px; padding: 16px 20px; border-radius: 16px; border: 3px solid #444; background: #1c1c3a; color: #fff; }
.big-btn { padding: 18px 48px; font-size: 32px; border: none; border-radius: 20px; background: #ffd54a; color: #1c1c3a; cursor: pointer; font-weight: bold; }
.loading { font-size: 40px; text-align: center; }
.error { font-size: 24px; color: #ff6b6b; }
.create-card { border-color: #ffd54a; }
.back-btn { padding: 12px 24px; font-size: 24px; border: 3px solid #444; border-radius: 16px; background: transparent; color: #fff; cursor: pointer; }
```

- [ ] **Step 9: type-check + build**

Run: `npm run type-check -w web && npm run build -w web`
Expected: 无类型错误，build 成功。

- [ ] **Step 10: 提交**

```bash
git add web/src web/vite.config.ts
git commit -m "feat(web): create-game flow (input page + generate + play)"
```

---

### Task 5: 端到端手动验证

- [ ] **Step 1: 填 .env 并启动**

```bash
cp server/.env.example server/.env
# 填 LLM_API_KEY
npm run dev
```

- [ ] **Step 2: 验证生成链路**

浏览器打开 `http://localhost:5173` → 点「✨ 创造新游戏」→ 输入「我要一只黄恐龙在火山吃草莓」→ 变出来 → 进游戏页能玩。

- [ ] **Step 3: 验证兜底**

输入乱码（如「asdfgh」）→ 后端不崩溃，回退默认恐龙游戏，能玩。

- [ ] **Step 4: 验证代理**

`curl http://localhost:5173/api/game/generate -X POST -H 'Content-Type: application/json' -d '{"idea":"test"}'` 能返回 spec（或默认 spec）。

- [ ] **Step 5: 提交（若有 .env.example 等遗漏）**

```bash
git add -A
git commit -m "chore: finalize LLM generation flow"
```

---

## Self-Review 记录

- **Spec 覆盖**：L1（输入层接口）→ Task4 input.ts；L3（单次 chat）→ Task2 GamePlanner；L4（后端结构）→ Task1/2；L5（兜底）→ Task2 + Task3；L6（单模型）→ Task1；L7（前端交互）→ Task4；L8（env）→ Task1；L9（collect 约束）→ Task2 prompt + GamePlanner.toCollect。L2（不做修改）无任务（正确）。
- **类型一致性**：`CollectSpec` 来自 shared；`LlmService.chat` 签名 Task1 定义、Task2 GamePlanner 使用一致；`validateGameSpec` 在 GamePlanner 里 import，与前端 specs.ts 同源。
- **Review Focus 覆盖**：1（markdown 代码块）→ Task3 parseJson 测试；2（dodge 类型）→ Task3 dodge 拒绝测试；3（默认 spec 内联）→ Task2 DEFAULT_SPEC 常量；4（server 引用 shared）→ Task1 tsconfig paths；5（objects 空）→ Task2 toCollect + validateGameSpec。
- **已知边界**：LLM 输出质量无自动化断言（靠手动 + 后续 Evaluator）；.env 由用户填真实 key，本计划不包含真实 key。

---

**执行方式：** 本计划含 5 个任务，接口逐层依赖（config → llm → planner → controller → 前端）。请先 review 本计划，确认后选择执行方式（subagent-driven 或 native）。

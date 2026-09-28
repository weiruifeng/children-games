import { validateGameSpec, type CollectSpec } from '../../../../shared/src/index';
import type { LlmService, ChatMessage } from '../llm/llm.service';
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

type Logger = { warn: (msg: string) => void };

export class GamePlanner {
  constructor(
    private readonly llm: LlmService,
    private readonly logger: Logger = { warn: () => {} },
  ) {}

  async generate(idea: string): Promise<CollectSpec> {
    let messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(idea) },
    ];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let content: string;
      try {
        content = await this.llm.chat(messages);
      } catch {
        // LLM 调用本身失败（网络/鉴权），直接回退默认游戏
        this.logger.warn(`GamePlanner 生成失败（LLM 调用异常），回退默认游戏。idea=${idea}`);
        return DEFAULT_SPEC;
      }
      const outcome = this.tryParse(content);
      if (outcome.spec) return outcome.spec;
      // 回喂具体错误，重试
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(idea) },
        { role: 'assistant', content },
        { role: 'user', content: buildRetryPrompt(outcome.error ?? '生成的 JSON 非法或不是 collect 类型') },
      ];
    }

    this.logger.warn(`GamePlanner 生成失败，回退默认游戏。idea=${idea}`);
    return DEFAULT_SPEC;
  }

  // 解析并校验，返回 { spec } 或 { error }
  private tryParse(content: string): { spec: CollectSpec | null; error?: string } {
    let text = content.trim();
    // 大小写不敏感的 markdown 代码块包裹
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { spec: null, error: '输出不是合法 JSON' };
    }
    try {
      const spec = validateGameSpec(parsed);
      if (spec.gameType !== 'collect') {
        return { spec: null, error: `gameType 必须是 collect，实际是 ${spec.gameType}` };
      }
      return { spec };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { spec: null, error: msg };
    }
  }
}

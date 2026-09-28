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
      const parsed = this.parseJson(content);
      if (parsed) {
        const spec = this.toCollect(parsed);
        if (spec) return spec;
      }
      // 回喂错误，重试
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(idea) },
        { role: 'assistant', content },
        { role: 'user', content: buildRetryPrompt('生成的 JSON 非法或不是 collect 类型') },
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

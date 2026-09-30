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
  constructor(
    private readonly llm: LlmService,
    private readonly logger: Logger = { warn: () => {} },
  ) {}

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
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private validate(parsed: unknown): ConverseResult | null {
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p.type === 'spec') {
      try {
        const spec = validateGameSpec(p.spec);
        if (spec.gameType !== 'collect') return null;
        return { type: 'spec', spec };
      } catch {
        return null;
      }
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

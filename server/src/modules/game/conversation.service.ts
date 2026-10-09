import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import { ConversationPlanner, type SessionState } from './conversation-planner';

export type ConversationStreamEvent =
  | { type: 'stage'; stage: 'received' | 'generating' | 'validating' }
  | { type: 'result'; sessionId: string; result: Awaited<ReturnType<ConversationPlanner['converse']>> };

@Injectable()
export class ConversationService {
  private readonly planner: ConversationPlanner;
  private readonly logger = new Logger(ConversationService.name);
  private readonly sessions = new Map<string, SessionState>();

  constructor(llm: LlmService) {
    this.planner = new ConversationPlanner(llm, this.logger);
  }

  async converse(sessionId: string | undefined, input: string) {
    for await (const event of this.converseStream(sessionId, input)) {
      if (event.type === 'result') return { sessionId: event.sessionId, result: event.result };
    }
    throw new Error('对话流未返回结果');
  }

  async *converseStream(sessionId: string | undefined, input: string): AsyncGenerator<ConversationStreamEvent> {
    const id = sessionId && this.sessions.has(sessionId) ? sessionId : randomUUID();
    const state = this.sessions.get(id) ?? { spec: null, history: [], questionCount: 0 };

    yield { type: 'stage', stage: 'received' };
    yield { type: 'stage', stage: 'generating' };
    const content = await this.planner.request(state, input);
    yield { type: 'stage', stage: 'validating' };
    const result = this.planner.resolve(state, content);

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

    yield { type: 'result', sessionId: id, result };
  }
}

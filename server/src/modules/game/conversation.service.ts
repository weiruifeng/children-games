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

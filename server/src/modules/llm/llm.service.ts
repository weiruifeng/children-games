import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LLM_ENDPOINT, LLM_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '../../config/llm.config';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class LlmService {
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

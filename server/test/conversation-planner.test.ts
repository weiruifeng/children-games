import { describe, it, expect, vi } from 'vitest';
import { ConversationPlanner, DEFAULT_SPEC, type SessionState } from '../src/modules/game/conversation-planner';

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

const state = (over?: Partial<SessionState>): SessionState => ({
  spec: null,
  history: [],
  questionCount: 0,
  ...over,
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

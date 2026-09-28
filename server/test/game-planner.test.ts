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

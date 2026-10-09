import { describe, expect, it } from 'vitest';
import { ConversationService } from '../src/modules/game/conversation.service';

describe('ConversationService 流式事件', () => {
  it('在生成并校验结果时依次发送阶段事件', async () => {
    const service = new ConversationService({
      chat: async () => JSON.stringify({
        type: 'spec',
        spec: {
          schemaVersion: '0.2', gameType: 'collect', orientation: 'landscape', title: '小猫捡星星',
          player: { character: 'cat', movement: 'follow-finger', speed: 300 },
          background: { asset: 'space' },
          objects: [{ type: 'collectible', asset: 'star', score: 10, count: 15 }],
          hitPolicy: 'lose-score', hitScore: 5, win: { type: 'score', value: 100 },
        },
      }),
    } as any);

    const events = [];
    for await (const event of service.converseStream(undefined, '小猫收集星星')) events.push(event);

    expect(events.map((event) => event.type === 'stage' ? event.stage : event.type))
      .toEqual(['received', 'generating', 'validating', 'result']);
  });
});

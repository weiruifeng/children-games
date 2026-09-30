import { describe, it, expect } from 'vitest';
import { summarizeSpec } from '../src/modules/game/spec-summary';
import type { CollectSpec } from '../../shared/src/index';

const spec: CollectSpec = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '恐龙吃草莓',
  player: { character: 'yellow-dinosaur', movement: 'follow-finger', speed: 300 },
  background: { asset: 'volcano' },
  objects: [
    { type: 'collectible', asset: 'strawberry', score: 10, count: 15, effect: 'grow' },
    { type: 'enemy', asset: 't-rex', speed: 150, count: 1 },
  ],
  hitPolicy: 'lose-score',
  hitScore: 5,
  win: { type: 'score', value: 100 },
};

describe('summarizeSpec', () => {
  it('摘要包含角色、背景、可收集物、敌人、胜利条件', () => {
    const s = summarizeSpec(spec);
    expect(s).toContain('恐龙');
    expect(s).toContain('火山');
    expect(s).toContain('草莓');
    expect(s).toContain('霸王龙');
    expect(s).toContain('100');
  });

  it('摘要包含失败策略', () => {
    expect(summarizeSpec(spec)).toContain('扣分');
  });
});

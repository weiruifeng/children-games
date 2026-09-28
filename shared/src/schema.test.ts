import { describe, it, expect } from 'vitest';
import { validateGameSpec } from './validate';

const validCollect = {
  schemaVersion: '0.2',
  gameType: 'collect',
  orientation: 'landscape',
  title: '测试',
  player: { character: 'cat', movement: 'follow-finger' },
  background: { asset: 'meadow' },
  objects: [
    { type: 'collectible', asset: 'star', score: 5, count: 10 },
    { type: 'obstacle', asset: 'rock', count: 4 },
    { type: 'hazard', asset: 'lava', area: { x: 0, y: 600, width: 1280, height: 120 } },
    { type: 'enemy', asset: 't-rex', speed: 150, count: 1 },
  ],
  win: { type: 'score', value: 100 },
};

describe('validateGameSpec v0.2', () => {
  it('通过合法 collect spec', () => {
    const spec = validateGameSpec(validCollect);
    if (spec.gameType !== 'collect') throw new Error('unreachable');
    expect(spec.objects).toHaveLength(4);
    expect(spec.hitPolicy).toBe('lose-score'); // 默认值
    expect(spec.hitScore).toBe(5);             // 默认值
  });

  it('拒绝 0.1 版本', () => {
    expect(() => validateGameSpec({ ...validCollect, schemaVersion: '0.1' })).toThrow();
  });

  it('拒绝 objects 为空数组', () => {
    expect(() => validateGameSpec({ ...validCollect, objects: [] })).toThrow();
  });

  it('拒绝 collectible 缺 score', () => {
    const objects = [{ type: 'collectible', asset: 'star', count: 1 }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('拒绝 hazard 缺 area', () => {
    const objects = [{ type: 'hazard', asset: 'lava' }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('拒绝未知对象 type', () => {
    const objects = [{ type: 'trap', asset: 'x' }];
    expect(() => validateGameSpec({ ...validCollect, objects })).toThrow();
  });

  it('接受 dodge/jump 占位分支', () => {
    expect(validateGameSpec({ schemaVersion: '0.2', gameType: 'dodge', orientation: 'landscape', title: 'd' }).gameType).toBe('dodge');
    expect(validateGameSpec({ schemaVersion: '0.2', gameType: 'jump', orientation: 'landscape', title: 'j' }).gameType).toBe('jump');
  });

  describe('真实 specs fixture', () => {
    const files = ['dinosaur-strawberry.json', 'cat-stars.json', 'rabbit-carrot.json'];
    for (const f of files) {
      it(`${f} 能通过校验`, async () => {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(new URL('../specs/' + f, import.meta.url), 'utf8');
        expect(() => validateGameSpec(JSON.parse(raw))).not.toThrow();
      });
    }
  });
});

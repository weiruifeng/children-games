import { describe, it, expect } from 'vitest';
import { validateGameSpec } from './validate';

describe('validateGameSpec', () => {
  it('通过合法 collect spec', () => {
    const spec = validateGameSpec({
      schemaVersion: '0.1',
      gameType: 'collect',
      orientation: 'landscape',
      title: '测试',
      player: { character: 'yellow-dinosaur', movement: 'follow-finger' },
      background: { asset: 'volcano' },
      collectibles: [{ asset: 'strawberry', score: 10, count: 20 }],
      win: { type: 'score', value: 100 },
    });
    expect(spec.gameType).toBe('collect');
    if (spec.gameType !== 'collect') throw new Error('unreachable');
    expect(spec.player.speed).toBe(300); // 默认值生效
  });

  it('拒绝未定义的字段（strict）', () => {
    expect(() =>
      validateGameSpec({
        schemaVersion: '0.1',
        gameType: 'collect',
        orientation: 'landscape',
        title: '测试',
        player: { character: 'x', movement: 'follow-finger' },
        background: { asset: 'y' },
        collectibles: [{ asset: 'z', score: 1, count: 1 }],
        win: { type: 'score', value: 1 },
        bogus: true,
      }),
    ).toThrow();
  });

  it('拒绝 collectibles 为空数组', () => {
    expect(() =>
      validateGameSpec({
        schemaVersion: '0.1',
        gameType: 'collect',
        orientation: 'landscape',
        title: '测试',
        player: { character: 'x', movement: 'follow-finger' },
        background: { asset: 'y' },
        collectibles: [],
        win: { type: 'score', value: 1 },
      }),
    ).toThrow();
  });

  it('接受 dodge/jump 占位分支', () => {
    expect(validateGameSpec({ schemaVersion: '0.1', gameType: 'dodge', orientation: 'landscape', title: 'd' }).gameType).toBe('dodge');
    expect(validateGameSpec({ schemaVersion: '0.1', gameType: 'jump', orientation: 'landscape', title: 'j' }).gameType).toBe('jump');
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

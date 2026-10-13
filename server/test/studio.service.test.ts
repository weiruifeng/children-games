import { describe, expect, it } from 'vitest';
import { StudioService } from '../src/modules/studio/studio.service';

const spec = {
  schemaVersion: '0.2', gameType: 'collect', orientation: 'landscape', title: '星星小猫',
  player: { character: 'cat', movement: 'follow-finger', speed: 300 },
  background: { asset: 'space' },
  objects: [{ type: 'collectible', asset: 'star', score: 10, count: 10 }],
  hitPolicy: 'lose-score', hitScore: 5, win: { type: 'score', value: 100 },
};

describe('StudioService', () => {
  it('拒绝未通过 GameSpec 校验的作品', async () => {
    const database = { withTransaction: async () => undefined };
    const service = new StudioService(database as any);
    await expect(service.create({ gameType: 'collect' })).rejects.toThrow();
  });

  it('保存时先创建作品和第一个不可变版本', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const now = new Date('2026-10-09T00:00:00.000Z');
    const database = {
      withTransaction: async (work: any) => work({
        execute: async (sql: string, values: unknown[]) => { calls.push({ sql, values }); return [[]]; },
      }),
      query: async () => [{
        game_id: calls[0].values[0], game_title: spec.title, current_version_id: calls[0].values[2],
        version_number: 1, game_spec: JSON.stringify(spec), created_at: now, updated_at: now,
      }],
    };
    const saved = await new StudioService(database as any).create(spec);
    expect(saved.title).toBe('星星小猫');
    expect(saved.versionNumber).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain('INSERT INTO game_record');
    expect(calls[1].sql).toContain('INSERT INTO game_version');
  });
});

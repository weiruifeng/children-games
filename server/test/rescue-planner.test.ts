import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RESCUE_SPEC } from '../../shared/src/rescue';
import { RescuePlanner } from '../src/modules/rescue/rescue-planner';

describe('RescuePlanner', () => {
  it('enables double jump using a validated model response', async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify({ ...DEFAULT_RESCUE_SPEC, doubleJump: true }));
    const result = await new RescuePlanner({ chat }).modify('恐龙能跳两次', DEFAULT_RESCUE_SPEC);
    expect(result.status).toBe('generated'); expect(result.spec.doubleJump).toBe(true);
    expect(result.checks).toContain('检查点安全');
  });
  it('feeds an unsafe checkpoint back to the model before accepting a repair', async () => {
    const bad = JSON.parse(JSON.stringify(DEFAULT_RESCUE_SPEC)); bad.levels[0].checkpoints = [14];
    const good = { ...DEFAULT_RESCUE_SPEC, friend: 'cat' };
    const chat = vi.fn().mockResolvedValueOnce(JSON.stringify(bad)).mockResolvedValueOnce(JSON.stringify(good));
    const result = await new RescuePlanner({ chat }).modify('换小猫', DEFAULT_RESCUE_SPEC);
    expect(chat).toHaveBeenCalledTimes(2); expect(result.spec.friend).toBe('cat');
  });
  it('keeps the current game on invalid output or API failure and reports it', async () => {
    for (const chat of [vi.fn().mockResolvedValue('bad'), vi.fn().mockRejectedValue(new Error('offline'))]) {
      const result = await new RescuePlanner({ chat }).modify('我要飞', DEFAULT_RESCUE_SPEC);
      expect(result.status).toBe('kept'); expect(result.spec).toEqual(DEFAULT_RESCUE_SPEC);
      expect(result.checks).toHaveLength(0);
    }
  });
  it('rejects changing the friend when only a cave was requested', async () => {
    const drift = { ...DEFAULT_RESCUE_SPEC, friend: 'cat' };
    const chat = vi.fn().mockResolvedValueOnce(JSON.stringify(drift)).mockResolvedValueOnce(JSON.stringify(DEFAULT_RESCUE_SPEC));
    const result = await new RescuePlanner({ chat }).modify('朋友藏在山洞里', DEFAULT_RESCUE_SPEC);
    expect(chat).toHaveBeenCalledTimes(2); expect(result.status).toBe('kept'); expect(result.spec.friend).toBe('rabbit');
  });
  it('does not call a title-only change a new gameplay version', async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify({ ...DEFAULT_RESCUE_SPEC, title: '新标题' }));
    const result = await new RescuePlanner({ chat }).modify('朋友藏在山洞里', DEFAULT_RESCUE_SPEC);
    expect(result.status).toBe('kept');
  });
});

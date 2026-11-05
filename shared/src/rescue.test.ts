import { describe, expect, it } from 'vitest';
import { DEFAULT_RESCUE_SPEC, validateRescueSpec } from './rescue';

const copy = () => JSON.parse(JSON.stringify(DEFAULT_RESCUE_SPEC));
describe('rescue playability contract', () => {
  it('accepts the three authored levels and single-jump paths', () => {
    expect(validateRescueSpec(DEFAULT_RESCUE_SPEC).levels).toHaveLength(3);
  });
  it('rejects an unreachable gap and model-generated physics', () => {
    const spec = copy(); spec.levels[0].gaps[0].width = 5;
    expect(() => validateRescueSpec(spec)).toThrow();
    expect(() => validateRescueSpec({ ...DEFAULT_RESCUE_SPEC, gravity: 100 })).toThrow();
  });
  it('rejects consecutive gaps with no landing space', () => {
    const spec = copy(); spec.levels[0].gaps[1].start = 17;
    expect(() => validateRescueSpec(spec)).toThrow('落脚');
  });
  it('rejects a checkpoint that would respawn the child into a pit', () => {
    const spec = copy(); spec.levels[0].checkpoints[0] = 14;
    expect(() => validateRescueSpec(spec)).toThrow('安全地面');
  });
});

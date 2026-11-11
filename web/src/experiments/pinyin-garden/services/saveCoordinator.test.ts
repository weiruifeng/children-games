import { expect, it } from 'vitest';
import { newProfile } from '@children-games/shared';
import { SaveCoordinator } from './saveCoordinator';
it('captures slots and snapshots and drains queued writes on finish', async () => {
  const written: { slot: number; name: string }[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const saves = new SaveCoordinator({
    writeProfileRecovery: () => {},
    saveProfile: async (slot, p) => {
      await gate;
      written.push({ slot, name: p.name });
    },
  });
  const profile = newProfile('A');
  saves.enqueue(0, profile);
  profile.name = 'mutated';
  saves.enqueue(1, newProfile('B'));
  const done = saves.finish();
  expect(() => saves.enqueue(2, profile)).toThrow(/关闭/);
  release();
  await done;
  expect(written).toEqual([
    { slot: 0, name: 'A' },
    { slot: 1, name: 'B' },
  ]);
});

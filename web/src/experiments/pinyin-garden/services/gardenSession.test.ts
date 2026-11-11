import { describe, expect, it } from 'vitest';
import { createCharacterGarden, newProfile, parseProfile } from '@children-games/shared';
import { GardenSession } from './gardenSession';

describe('garden session ownership', () => {
  it('records victory idempotently and cannot award its score to another garden', () => {
    const session = new GardenSession();
    session.select(0, newProfile('A'));
    const battle = createCharacterGarden('foundation-01');
    battle.stage = 'won';
    battle.score = 123;
    session.begin(battle, null);
    const won = session.progress()!;
    expect(won.checkpoint).toBeNull();
    expect(Object.values(won.best)).toContain(123);
    session.currentProfile.current = won;
    expect(session.progress()).toEqual(won);
    session.select(1, newProfile('B'));
    expect(session.progress()).toBeNull();
    expect(session.currentProfile.current?.best).toEqual({});
  });
  it('never commits the previous garden battle into a newly selected garden', () => {
    const session = new GardenSession();
    session.select(0, newProfile('A'));
    const battle = createCharacterGarden('foundation-01');
    battle.attempts.push({
      taskId: 'a',
      entryId: 'symbol-a',
      syllable: 0,
      at: 1,
      correct: true,
      assisted: false,
      repeated: false,
    });
    session.begin(battle, null);
    expect(session.progress()?.attempts).toHaveLength(1);
    session.select(1, newProfile('B'));
    expect(session.progress()).toBeNull();
    expect(session.currentProfile.current?.attempts).toHaveLength(0);
  });
  it('does not manufacture a checkpoint before a battle is started', () => {
    const session = new GardenSession();
    session.select(0, newProfile('new'));
    expect(session.progress()).toBeNull();
  });
  it('invalidates callbacks on selection and keeps valid checkpoints compatible', () => {
    const session = new GardenSession();
    session.select(0, newProfile('A'));
    session.begin(createCharacterGarden('foundation-01'), null);
    const token = session.capture();
    expect(session.isCurrent(token)).toBe(true);
    expect(() => parseProfile(session.progress())).not.toThrow();
    session.select(0, newProfile('A reopened'));
    expect(session.isCurrent(token)).toBe(false);
  });
});

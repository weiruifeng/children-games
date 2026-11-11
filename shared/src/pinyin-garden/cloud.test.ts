import { describe, it, expect } from 'vitest';
import { newProfile } from './snapshot';
import { parseCloudProfile, toCloudProfile, eventForAttempt, canonical } from './cloud';
describe('cloud contract', () => {
  it('separates history and nested archives from hot snapshots', () => {
    const p = newProfile('花园');
    p.previousArchive = { large: 'archive' };
    expect(toCloudProfile(p)).not.toHaveProperty('attempts');
    expect(toCloudProfile(p)).not.toHaveProperty('previousArchive');
    expect(parseCloudProfile(toCloudProfile(p)).name).toBe('花园');
  });
  it('rejects unknown achievement keys and arbitrary archives', () => {
    const p = toCloudProfile(newProfile('花园'));
    expect(() => parseCloudProfile({ ...p, previousArchive: {} })).toThrow();
    expect(() => parseCloudProfile({ ...p, levelStars: { fake: [true, true, true] } })).toThrow();
  });
  it('assigns deterministic identities for repeated imports', async () => {
    const a = {
      taskId: 't',
      entryId: 'symbol-a',
      syllable: 0,
      correct: true,
      assisted: false,
      repeated: false,
      at: 1,
    };
    expect(await eventForAttempt(a)).toEqual(await eventForAttempt({ ...a }));
    expect((await eventForAttempt({ ...a, at: 2 })).eventId).not.toBe(
      (await eventForAttempt(a)).eventId,
    );
  });
  it('canonicalizes property order', () =>
    expect(canonical({ z: 1, a: 2 })).toBe(canonical({ a: 2, z: 1 })));
});

import { recentEvidence, historySummary } from './cloud-history';
import { readingFacts } from './lessonPlanner';
it('keeps eligible runs even after many assisted attempts and orders facts by time', () => {
  const attempts = Array.from({ length: 20 }, (_, i) => ({
    taskId: 't' + i,
    runId: 'r' + i,
    readingId: 'old-reading',
    levelId: 'old-level',
    entryId: 'old-entry',
    syllable: 0,
    at: 86400000 * i,
    correct: true,
    assisted: i >= 3,
    repeated: false,
    firstTryCorrect: true,
    optionCount: 3,
  }));
  const evidence = recentEvidence(attempts);
  expect(readingFacts(evidence, 'old-reading').repeatedIndependent).toBe(true);
  expect(historySummary([...attempts].reverse())).toEqual(historySummary(attempts));
});
it('preserves explicit new event IDs and keeps cloud metadata out of local Profile', async () => {
  const a = {
    eventId: 'fixed-event',
    taskId: 't',
    entryId: 'symbol-a',
    syllable: 0,
    at: 1,
    correct: true,
    assisted: false,
    repeated: false,
  };
  expect((await eventForAttempt(a)).eventId).toBe('fixed-event');
  expect(parseCloudProfile(toCloudProfile(newProfile('test'))).cloudVersion).toBe(1);
});

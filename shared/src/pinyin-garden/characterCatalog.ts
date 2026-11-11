import { candidateLedger } from './data/candidate-ledger';
import { levelLedger } from './data/level-ledger';
import { adventureLevels } from './data/adventure-levels';
import { adventureMigration } from './data/adventure-migration';
export { adventureMigration };
export const LEGACY_CHARACTER_LEVEL_MAP = Object.fromEntries(levelLedger.map((l) => [l.id, l]));
export const lessonTrack = (track: string | undefined) => (track === 'supplement' ? 'main' : track);
export const CHARACTER_PACK = 'garden-adventure-4' as const;
export type Track = 'foundation' | 'main' | 'supplement' | 'challenge';
export const READING_LEDGER = candidateLedger;
export const READING_MAP = Object.fromEntries(READING_LEDGER.map((r) => [r.id, r]));
export function entryVerified(e: (typeof candidateLedger)[number]['entries'][number]): boolean {
  return (
    e.verification?.status === 'source-verified' ||
    (e.review.status === 'reviewed' && !!e.review.by && !!e.review.date)
  );
}
/** Optional audio has its own release gate; its absence never changes a written answer. */
export function readingReleased(r: (typeof candidateLedger)[number]): boolean {
  return (
    r.textValidation.status !== 'excluded' &&
    (r.textValidation.status === 'source-verified' || r.review.status === 'reviewed') &&
    r.entries.some(
      (e) =>
        entryVerified(e) &&
        (r.track === 'challenge' || e.common) &&
        (!e.contextRequired || !!e.context),
    )
  );
}
export const CHARACTER_LEVELS = adventureLevels.map((l) => {
  const releasedTargets =
    l.track === 'foundation'
      ? l.targets
      : l.targets.filter((id) => readingReleased(READING_MAP[id]));
  return {
    ...l,
    track: l.track as Track,
    releasedTargets,
    published: releasedTargets.length > 0,
    excluded: l.targets.filter((id) => READING_MAP[id]?.textValidation.status === 'excluded')
      .length,
    pending: l.targets.filter(
      (id) =>
        READING_MAP[id]?.textValidation.status !== 'excluded' && !releasedTargets.includes(id),
    ).length,
  };
});
export const CHARACTER_LEVEL_MAP = Object.fromEntries(CHARACTER_LEVELS.map((l) => [l.id, l]));
export const OLD_LESSON_RECOMMENDATION: Record<number, string> = {
  1: 'foundation-01',
  2: 'foundation-04',
  3: 'main-ba1',
  4: 'main-da1',
  5: 'main-duo1',
  6: 'main-ji1',
  7: 'main-ca1',
  8: 'main-cha1',
  9: 'main-wa1',
  10: 'main-ai1',
  11: 'main-ao1',
  12: 'main-bie1',
  13: 'main-an1',
  14: 'main-ang2',
};
export function recommendedLevel(chapter = 1): string {
  const preferred = CHARACTER_LEVEL_MAP[OLD_LESSON_RECOMMENDATION[chapter]];
  if (preferred?.published) return preferred.id;
  const migrated = adventureMigration[OLD_LESSON_RECOMMENDATION[chapter]]?.[0];
  if (migrated) return migrated;
  return (
    CHARACTER_LEVELS.find((l) => l.chapter === chapter && l.published)?.id ??
    CHARACTER_LEVELS.filter((l) => l.chapter < chapter && l.published).slice(-1)[0]?.id ??
    'foundation-01'
  );
}
export function coverageSummary() {
  return {
    total: READING_LEDGER.length,
    published: READING_LEDGER.filter(readingReleased).length,
    excluded: READING_LEDGER.filter((r) => r.textValidation.status === 'excluded').length,
    pending: READING_LEDGER.filter(
      (r) => !readingReleased(r) && r.textValidation.status !== 'excluded',
    ).length,
    tracks: Object.fromEntries(
      ['main', 'supplement', 'challenge'].map((track) => [
        track,
        {
          total: READING_LEDGER.filter((r) => r.track === track).length,
          published: READING_LEDGER.filter((r) => r.track === track && readingReleased(r)).length,
        },
      ]),
    ),
  };
}

export function resolveAdventure(id: string): string | undefined {
  return CHARACTER_LEVEL_MAP[id]?.published ? id : adventureMigration[id]?.[0];
}

export function nextAdventure(id: string): string | undefined {
  const level = CHARACTER_LEVEL_MAP[id];
  if (!level) return;
  const route = CHARACTER_LEVELS.filter((l) => l.track === level.track);
  const next = route[route.findIndex((l) => l.id === id) + 1];
  return (
    next?.id ??
    (level.track === 'foundation'
      ? CHARACTER_LEVELS.find((l) => l.track === 'main')?.id
      : undefined)
  );
}

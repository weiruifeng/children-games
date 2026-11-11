import type { LearningAttempt } from './model';
import { readingFacts } from './lessonPlanner';
import { learningFacts } from './review';
/** Bounded planner evidence preserves latest entry/syllable and three eligible runs per reading. */
export function recentEvidence(attempts: LearningAttempt[], activeRun?: string): LearningAttempt[] {
  const latest = new Map<string, LearningAttempt>(),
    eligible = new Map<string, Map<string, LearningAttempt>>(),
    result = new Set<LearningAttempt>();
  for (const a of attempts) {
    for (const key of [
      `entry:${a.entryId}`,
      `part:${a.entryId}:${a.syllable}`,
      `reading:${a.readingId}`,
    ]) {
      const old = latest.get(key);
      if (!old || old.at <= a.at) latest.set(key, a);
    }
    if (a.runId === activeRun && activeRun) result.add(a);
    if (
      a.readingId &&
      a.levelId &&
      !a.assisted &&
      !a.referenceVisible &&
      !a.repeated &&
      !a.retry &&
      (a.optionCount ?? 0) > 1
    ) {
      const runs = eligible.get(a.readingId) ?? new Map<string, LearningAttempt>();
      const key = a.runId ?? '';
      const old = runs.get(key);
      if (!old || old.at <= a.at) runs.set(key, a);
      eligible.set(a.readingId, runs);
    }
  }
  for (const a of latest.values()) result.add(a);
  for (const runs of eligible.values())
    for (const a of [...runs.values()].sort((a, b) => b.at - a.at).slice(0, 3)) result.add(a);
  return [...result].sort((a, b) => a.at - b.at);
}
export function historySummary(attempts: LearningAttempt[]) {
  attempts = [...attempts].sort((a, b) => a.at - b.at);
  const readingGroups = new Map<string, LearningAttempt[]>(),
    entryGroups = new Map<string, LearningAttempt[]>();
  for (const a of attempts) {
    const e = entryGroups.get(a.entryId) ?? [];
    e.push(a);
    entryGroups.set(a.entryId, e);
    if (a.readingId) {
      const r = readingGroups.get(a.readingId) ?? [];
      r.push(a);
      readingGroups.set(a.readingId, r);
    }
  }
  return {
    total: attempts.length,
    reviewed: attempts.filter((a) => a.mode === 'review').length,
    retried: attempts.filter((a) => a.retry).length,
    independent: attempts.filter(
      (a) =>
        a.correct &&
        !!a.levelId &&
        !a.assisted &&
        !a.repeated &&
        a.firstTryCorrect &&
        !a.referenceVisible &&
        !a.retry &&
        (a.optionCount ?? 0) > 1,
    ).length,
    assisted: attempts.filter((a) => a.assisted).length,
    readings: Object.fromEntries(
      [...readingGroups].map(([id, rows]) => [id, readingFacts(rows, id)]),
    ),
    entries: Object.fromEntries(
      [...entryGroups].map(([id, rows]) => [id, learningFacts(rows, id)]),
    ),
  };
}

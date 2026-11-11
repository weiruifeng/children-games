import {
  CHARACTER_PACK,
  createLessonGarden,
  resumeSnapshot,
  starsFor,
  type GardenState,
  type Profile,
} from '@children-games/shared';

/** Owns the selected garden and the battle that is allowed to write into it. */
export class GardenSession {
  readonly state = { current: createLessonGarden() };
  readonly currentProfile: { current: Profile | null } = { current: null };
  readonly checkpoint: { current: GardenState | null } = { current: null };
  readonly slot = { current: 0 };
  private version = 0;
  private battle?: { version: number; runId: string | undefined };

  select(slot: number, profile: Profile) {
    this.version++;
    this.slot.current = slot;
    this.currentProfile.current = profile;
    this.battle = undefined;
    this.checkpoint.current = null;
  }

  begin(state: GardenState, checkpoint: GardenState | null) {
    this.version++;
    this.state.current = state;
    this.checkpoint.current = checkpoint;
    this.battle = { version: this.version, runId: state.runId };
  }

  capture() {
    return this.version;
  }
  isCurrent(version: number) {
    return this.version === version;
  }
  invalidate() {
    this.version++;
    this.battle = undefined;
  }

  progress(): Profile | null {
    const p = this.currentProfile.current,
      s = this.state.current;
    if (!p || !this.battle || this.battle.version !== this.version || this.battle.runId !== s.runId)
      return null;
    const attempts = new Map(
      [...p.attempts, ...s.attempts].map((a) => [
        a.eventId ?? `${a.taskId}:${a.entryId}:${a.at}:${a.correct}:${a.repeated}:${a.assisted}`,
        a,
      ]),
    );
    let next: Profile = {
      ...p,
      selectedLevel: s.levelId ?? p.selectedLevel,
      attempts: [...attempts.values()].slice(-45000),
      checkpoint: resumeSnapshot(s),
      waveStart: this.checkpoint.current,
    };
    if (s.stage === 'won') {
      const earned = starsFor(s),
        old = p.stars[String(s.level)] ?? [false, false, false];
      const key = `${s.levelId ?? (s.reviewPool ? 'review' : s.lessonId)}:battle-${s.level}:${CHARACTER_PACK}:${s.slow ? 'slow' : 'normal'}:shared-2`;
      const lesson = s.lessonId ?? 1,
        oldLesson = p.lessonStars[String(lesson)] ?? [false, false, false];
      next = {
        ...next,
        unlocked: Math.min(5, Math.max(p.unlocked, s.level + 1)),
        best: { ...p.best, [key]: Math.max(p.best[key] ?? 0, s.score) },
        checkpoint: null,
        waveStart: null,
      };
      if (s.levelId)
        next = {
          ...next,
          levelStars: {
            ...p.levelStars,
            [s.levelId]: (p.levelStars[s.levelId] ?? [false, false, false]).map(
              (v, i) => v || earned[i],
            ),
          },
          stars: { ...p.stars, [s.level]: old.map((v, i) => v || earned[i]) },
        };
      else if (!s.reviewPool)
        next = {
          ...next,
          lessonUnlocked: Math.min(14, Math.max(p.lessonUnlocked, lesson + 1)),
          selectedLesson: Math.min(lesson + 1, p.lessonLimit, 14),
          stars: { ...p.stars, [s.level]: old.map((v, i) => v || earned[i]) },
          lessonStars: { ...p.lessonStars, [lesson]: oldLesson.map((v, i) => v || earned[i]) },
        };
    }
    return next;
  }
}

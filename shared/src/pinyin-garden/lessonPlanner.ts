import {
  CHARACTER_LEVEL_MAP,
  CHARACTER_PACK,
  READING_MAP,
  entryVerified,
  lessonTrack,
} from './characterCatalog';
import { ENTRIES, ENTRY_MAP, INITIALS, FINALS, MEDIALS, type Parts } from './content';
import { introducedKnowledge, entryRequirements, targetId } from './curriculum';
import { WHOLE_SYLLABLES } from './curriculumCatalog';
import type { LearningAttempt, LearningPlan, GardenState } from './model';
export function planLesson(
  levelId: string,
  runId: string,
  attempts: LearningAttempt[] = [],
): LearningPlan {
  const level = CHARACTER_LEVEL_MAP[levelId];
  if (!level?.published) throw Error('这一关内容待完善，尚未发布');
  let seed = [...runId].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 173);
  const initialSeed = seed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rank = new Map<string, number>();
  for (const r of level.releasedTargets) rank.set(r, random());
  const last = (id: string) =>
    attempts
      .filter((a) => a.readingId === id)
      .sort((a, b) => a.at - b.at)
      .slice(-1)[0];
  const targets = [...level.releasedTargets].sort(
    (a, b) =>
      Number(!!last(a)) - Number(!!last(b)) ||
      Number(!!last(a)?.firstTryCorrect) - Number(!!last(b)?.firstTryCorrect) ||
      rank.get(a)! - rank.get(b)!,
  );
  const choose = (readingId: string) => {
    const choices = ENTRIES.filter(
      (e) => e.readingId === readingId && lessonTrack(e.track) === level.track,
    );
    const previous = last(readingId)?.entryId;
    const pool = choices.filter((e) => e.id !== previous);
    return (pool.length ? pool : choices)[Math.floor(random() * (pool.length || choices.length))]
      .id;
  };
  const chosen = level.track === 'foundation' ? targets.map(targetId) : targets.map(choose);
  const waves = Array.from({ length: 3 }, (_, wave) => {
    const scope =
      level.track === 'foundation' || level.chapter === 1
        ? new Set<string>()
        : introducedKnowledge(Math.min(level.chapter - 1, 14));
    for (const id of chosen.slice(0, wave * 2 + 2))
      for (const key of entryRequirements(ENTRY_MAP[id])) scope.add(key);
    if (level.chapter >= 15) scope.add('tone:5');
    const fresh = chosen.slice(wave * 2, wave * 2 + 2);
    const current = fresh.length ? fresh : chosen.slice(0, 2);
    const practiced = new Map<string, LearningAttempt>();
    for (const a of attempts) {
      const e = ENTRY_MAP[a.entryId];
      if (
        !a.levelId ||
        lessonTrack(a.track) !== level.track ||
        !e ||
        !entryRequirements(e).every((k) => scope.has(k))
      )
        continue;
      const old = practiced.get(a.entryId);
      if (!old || old.at < a.at) practiced.set(a.entryId, a);
    }
    const weak = (a: LearningAttempt) => !a.correct || a.assisted || !a.firstTryCorrect;
    const reviews = [...practiced.values()]
      .sort((a, b) => Number(weak(b)) - Number(weak(a)) || a.at - b.at)
      .map((a) => a.entryId)
      .filter(
        (id) =>
          !current.some(
            (other) => (ENTRY_MAP[other].readingId ?? other) === (ENTRY_MAP[id].readingId ?? id),
          ),
      )
      .slice(0, 2);
    const entries = [
      ...new Map(
        [...current, ...reviews].map((id) => [ENTRY_MAP[id].readingId ?? id, id]),
      ).values(),
    ].slice(0, 6);
    const options: Record<string, Record<string, Array<string | number>>> = {};
    for (const id of entries) {
      const e = ENTRY_MAP[id];
      options[id] = {};
      for (const [key, correct] of Object.entries(e.parts[0]) as [
        keyof Parts,
        string | number | null,
      ][]) {
        if (correct === null || correct === '' || correct === 0) continue;
        const pool =
          key === 'tone'
            ? [1, 2, 3, 4, 5].filter((t) => scope.has(`tone:${t}`))
            : (e.type === 'symbol'
                ? FINALS
                : key === 'initial'
                  ? [...INITIALS, 'y', 'w']
                  : key === 'medial'
                    ? MEDIALS
                    : key === 'final'
                      ? FINALS
                      : [...WHOLE_SYLLABLES, 'm', 'n']
              ).filter(
                (v) =>
                  scope.has(
                    `${key === 'initial' ? 'initial' : key === 'whole' && e.type !== 'symbol' ? 'whole' : 'final'}:${v}`,
                  ) &&
                  (key !== 'medial' || scope.has(`rule:three-${v}`)),
              );
        if (!pool.includes(correct as never)) throw Error(`目标前置不完整: ${id}/${key}`);
        const others = pool
          .filter((v) => v !== correct)
          .map((v) => ({ v, r: random() }))
          .sort((a, b) => a.r - b.r)
          .map((x) => x.v);
        options[id][key] = (key === 'tone' ? pool : [correct, ...others.slice(0, 2)])
          .map((v) => ({ v, r: random() }))
          .sort((a, b) => a.r - b.r)
          .map((x) => x.v);
      }
    }
    return {
      answers: Object.fromEntries(
        entries.map((id) => [
          id,
          JSON.stringify([
            ENTRY_MAP[id].text,
            ENTRY_MAP[id].context,
            ENTRY_MAP[id].pinyin,
            ENTRY_MAP[id].parts,
            !!ENTRY_MAP[id].guided,
          ]),
        ]),
      ),
      entries,
      newEntries: fresh,
      scope: [...scope],
      options,
    };
  });
  return { seed: initialSeed, waves };
}
export function revealWave(s: GardenState): void {
  if (!s.learningPlan) return;
  const wave = s.stage === 'between' ? s.wave + 1 : s.wave;
  s.revealed = [
    ...new Set([
      ...(s.revealed ?? []),
      ...s.learningPlan.waves[wave].entries.map((id) => `${wave}:${id}`),
    ]),
  ];
}
export function recordAudio(s: GardenState): void {
  if (s.task) s.audioUsed = [...new Set([...(s.audioUsed ?? []), `${s.wave}:${s.task.entryId}`])];
}
export function validateLearningPlan(s: GardenState): void {
  const level = s.levelId ? CHARACTER_LEVEL_MAP[s.levelId] : undefined;
  if (
    !level?.published ||
    s.packVersion !== CHARACTER_PACK ||
    !s.runId ||
    !s.learningPlan ||
    s.learningPlan.waves.length !== 3
  )
    throw Error('内容包或关卡不可恢复');
  const allowedScope =
    level.track === 'foundation'
      ? new Set(level.targets.map(targetId).flatMap((id) => entryRequirements(ENTRY_MAP[id])))
      : introducedKnowledge(Math.min(level.chapter, 14));
  if (level.chapter >= 15) allowedScope.add('tone:5');
  allowedScope.add('rule:three-ü');
  if (level.chapter === 16) {
    allowedScope.add('whole:m');
    allowedScope.add('whole:n');
  }
  const newTargets = new Set<string>();
  const introducedEntries: string[] = [];
  for (const wave of s.learningPlan.waves) {
    introducedEntries.push(...wave.newEntries);
    const exactScope =
      level.track === 'foundation' || level.chapter === 1
        ? new Set<string>()
        : introducedKnowledge(Math.min(level.chapter - 1, 14));
    for (const id of introducedEntries) {
      if (!ENTRY_MAP[id]) throw Error('目标不存在');
      for (const key of entryRequirements(ENTRY_MAP[id])) exactScope.add(key);
    }
    if (level.chapter >= 15) exactScope.add('tone:5');
    if (wave.scope.length !== exactScope.size || wave.scope.some((k) => !exactScope.has(k)))
      throw Error('波次技能范围不匹配');
    if (
      !wave.entries.length ||
      wave.entries.length > 6 ||
      wave.newEntries.length > 2 ||
      new Set(wave.entries).size !== wave.entries.length ||
      wave.scope.some((k) => !allowedScope.has(k))
    )
      throw Error('无效学习计划');
    const readings = new Set<string>();
    for (const id of wave.entries) {
      const e = ENTRY_MAP[id];
      if (
        !e ||
        wave.answers[id] !== JSON.stringify([e.text, e.context, e.pinyin, e.parts, !!e.guided]) ||
        (level.track === 'foundation'
          ? !level.targets.map(targetId).includes(id)
          : !e.readingId || lessonTrack(e.track) !== level.track || !READING_MAP[e.readingId]) ||
        !entryRequirements(e).every((k) => wave.scope.includes(k))
      )
        throw Error('题目范围损坏');
      if (readings.has(e.readingId ?? id)) throw Error('同波重复读音');
      readings.add(e.readingId ?? id);
      for (const [key, value] of Object.entries(e.parts[0]))
        if (value) {
          const opts = wave.options[id]?.[key];
          if (
            !opts?.includes(value) ||
            new Set(opts).size !== opts.length ||
            opts.length > (key === 'tone' ? 5 : 3)
          )
            throw Error('选项缺少答案');
          for (const option of opts) {
            const category =
              key === 'tone'
                ? 'tone'
                : key === 'initial'
                  ? 'initial'
                  : key === 'whole' && e.type !== 'symbol'
                    ? 'whole'
                    : 'final';
            if (
              !wave.scope.includes(`${category}:${option}`) ||
              (key === 'medial' && !wave.scope.includes(`rule:three-${option}`))
            )
              throw Error('选项越界');
          }
        }
    }
    if (
      wave.newEntries.some(
        (id) =>
          !wave.entries.includes(id) ||
          !level.releasedTargets.includes(
            level.track === 'foundation' ? ENTRY_MAP[id].pinyin[0] : ENTRY_MAP[id].readingId!,
          ),
      )
    )
      throw Error('新目标未出场');
    for (const id of wave.newEntries)
      newTargets.add(level.track === 'foundation' ? id : ENTRY_MAP[id].readingId!);
  }
  if (
    level.releasedTargets.some(
      (id) => !newTargets.has(level.track === 'foundation' ? targetId(id) : id),
    )
  )
    throw Error('教学目标缺失');
}
export function readingFacts(attempts: LearningAttempt[], readingId: string) {
  const rows = attempts.filter((a) => a.readingId === readingId && a.levelId);
  const eligible = rows.filter(
    (a) =>
      !a.assisted && !a.referenceVisible && !a.repeated && !a.retry && (a.optionCount ?? 0) > 1,
  );
  const independent = eligible.filter((a) => a.correct && a.firstTryCorrect);
  const runs = [...new Map(eligible.map((a) => [a.runId, a])).values()]
    .sort((a, b) => a.at - b.at)
    .slice(-3);
  const days = new Set(
    runs.map((a) => new Date(a.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })),
  );
  const entries = new Set(runs.map((a) => a.entryId));
  return {
    attempts: rows.length,
    independent: independent.length,
    assisted: rows.filter((a) => a.correct && a.assisted).length,
    repeatedIndependent:
      runs.length === 3 &&
      runs.every((a) => a.correct && a.firstTryCorrect) &&
      days.size >= 2 &&
      ((READING_MAP[readingId]?.entries.filter(entryVerified).length ?? 0) < 2 ||
        entries.size >= 2),
  };
}

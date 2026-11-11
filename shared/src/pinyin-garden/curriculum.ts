import { CHARACTER_LEVEL_MAP } from './characterCatalog';
import {
  ENTRY_MAP,
  ENTRIES,
  INITIALS,
  FINALS,
  MEDIALS,
  stripTone,
  type Entry,
  type Parts,
} from './content';
import { LESSON_SPECS, WHOLE_SYLLABLES } from './curriculumCatalog';
import type { GardenState } from './model';
export const LESSONS = LESSON_SPECS;
export const CURRICULUM_VERSION = 'garden-curriculum-2' as const;
export function introducedKnowledge(lesson: number, wave = 2): Set<string> {
  if (!LESSONS[lesson - 1] || !Number.isInteger(wave) || wave < 0 || wave > 2)
    throw Error('课程或波次无效');
  return new Set(
    LESSONS.slice(0, lesson).flatMap((l) =>
      l.waves.slice(0, l.id === lesson ? wave + 1 : 3).flatMap((w) => w.introduce),
    ),
  );
}
export function entryRequirements(e: Entry): string[] {
  if (e.type === 'symbol')
    return [
      `${INITIALS.includes(e.text) || ['y', 'w'].includes(e.text) ? 'initial' : 'final'}:${e.text}`,
    ];
  const keys: string[] = [];
  for (const p of e.parts) {
    if (p.tone) keys.push(`tone:${p.tone}`);
    if (p.whole) {
      keys.push(`whole:${p.whole}`);
      continue;
    }
    if (p.initial) keys.push(`initial:${p.initial}`, 'rule:two');
    if (p.final) keys.push(`final:${p.final}`);
    if (p.medial) keys.push(`final:${p.medial}`, `rule:three-${p.medial}`);
    if (['j', 'q', 'x'].includes(p.initial) && (p.medial + p.final).startsWith('ü'))
      keys.push('rule:jqx-umlaut');
    if (['n', 'l'].includes(p.initial) && (p.medial + p.final).startsWith('ü'))
      keys.push('rule:nl-umlaut');
    if (p.final === 'üe' && ['j', 'q', 'x'].includes(p.initial)) keys.push('rule:jqx-ue');
    if (p.final === 'ün') keys.push('rule:jqx-un');
    if (['y', 'w'].includes(p.initial)) keys.push('rule:yw');
    if (p.medial === 'i' && p.final === 'ong') keys.push('rule:iong');
    if (['ui', 'iu', 'un'].includes(p.final)) keys.push(`rule:${p.final}`);
    if (['ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe'].includes(p.final))
      keys.push('rule:compound-tone');
  }
  return [...new Set(keys)];
}
export function entryAllowed(id: string, lesson: number, wave = 2): boolean {
  const e = ENTRY_MAP[id];
  if (!e) return false;
  const scope = introducedKnowledge(lesson, wave);
  return entryRequirements(e).every((k) => scope.has(k));
}
export function targetId(text: string): string {
  if (/^[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]$/.test(text) && ENTRY_MAP[`syllable-${text}`])
    return `syllable-${text}`;
  return ENTRY_MAP[`symbol-${text}`]
    ? `symbol-${text}`
    : (ENTRIES.find((e) => e.type === 'character' && e.pinyin[0] === text)?.id ??
        `syllable-${text}`);
}
export function lessonPool(lesson: number, wave: number, battleStage = 1): string[] {
  const spec = LESSONS[lesson - 1]?.waves[wave];
  if (!spec) throw Error('课程不存在');
  const ids = spec.targets.map(targetId);
  // Explicit application placement preserves every original word, without introducing unseen parts.
  const applications: Record<string, string[]> = {
    '3:2': ['word-1'],
    '4:1': ['word-3'],
    '4:2': ['word-4'],
    '5:2': ['word-5'],
    '6:2': ['word-6'],
    '10:2': ['word-7'],
    '11:0': ['word-2'],
    '11:1': ['word-11'],
    '11:2': ['word-10'],
    '12:2': ['word-12'],
    '13:1': ['word-8'],
    '13:2': ['word-9'],
  };
  if (battleStage >= 3)
    for (const id of applications[`${lesson}:${wave}`] ?? []) {
      if (!entryAllowed(id, lesson, wave)) throw Error(`词语前置缺失 ${id}`);
      // Replace only the last review/sample card if the rack is full; never an introductory symbol.
      if (ids.length >= 6) ids.pop();
      ids.push(id);
    }
  return ids;
}
export function lessonTitle(
  s: Pick<GardenState, 'lessonId' | 'level' | 'reviewPool' | 'levelId'>,
): string {
  return 'levelId' in s && s.levelId
    ? CHARACTER_LEVEL_MAP[s.levelId as string].name
    : s.reviewPool
      ? '已学内容复习'
      : s.lessonId
        ? `第 ${s.lessonId} 课 · ${LESSONS[s.lessonId - 1].name}`
        : `战场 ${s.level}`;
}
export function lessonPreview(s: GardenState): { note: string; cards: string[] } {
  if (s.learningPlan)
    return {
      note:
        s.levelId && CHARACTER_LEVEL_MAP[s.levelId].track === 'foundation'
          ? '先认清字母和声调，再给伙伴准备弹药。'
          : '看汉字和语境拼出音节。需要时点“教我拼”，只帮助当前这张卡。',
      cards: s.learningPlan.waves[s.stage === 'between' ? s.wave + 1 : s.wave].entries,
    };
  if (s.reviewPool)
    return {
      note: '都是你练过的卡片。战斗中照样板装弹，伙伴自动攻击。',
      cards: s.reviewPool.slice(0, 6),
    };
  const wave = s.stage === 'between' ? s.wave + 1 : s.wave;
  if (!s.lessonId) return { note: '拼好一次，全队共享弹药。', cards: [] };
  const spec = LESSONS[s.lessonId - 1].waves[wave];
  return { note: spec.note, cards: lessonPool(s.lessonId, wave, s.level) };
}
export function optionsFor(s: GardenState, entry: Entry, key: keyof Parts): Array<string | number> {
  if (s.learningPlan) return s.learningPlan.waves[s.wave].options[entry.id]?.[key] ?? [];
  const scope = s.lessonId ? introducedKnowledge(s.lessonId, s.reviewPool ? 2 : s.wave) : null;
  if (key === 'tone') return [1, 2, 3, 4].filter((t) => !scope || scope.has(`tone:${t}`));
  if (entry.type === 'symbol') {
    const group = entryRequirements(entry)[0].split(':')[0];
    return (group === 'initial' ? [...INITIALS, 'y', 'w'] : FINALS).filter(
      (v) => !scope || scope.has(`${group}:${v}`),
    );
  }
  const pool =
    key === 'initial'
      ? [...INITIALS, 'y', 'w']
      : key === 'medial'
        ? MEDIALS
        : key === 'final'
          ? FINALS
          : WHOLE_SYLLABLES;
  const category = key === 'initial' ? 'initial' : key === 'whole' ? 'whole' : 'final';
  return pool.filter(
    (v) =>
      !scope ||
      (scope.has(`${category}:${v}`) && (key !== 'medial' || scope.has(`rule:three-${v}`))),
  );
}
export function taskOptions(
  s: GardenState,
  e: Entry,
  index: number,
  key: keyof Parts,
): Array<string | number> {
  if (s.learningPlan) return s.learningPlan.waves[s.wave].options[e.id]?.[key] ?? [];
  const correct = e.parts[index][key];
  if (correct === null) return [];
  const pool = optionsFor(s, e, key);
  if (!pool.includes(correct)) return [];
  if (key === 'tone') return pool;
  const fixedSeed = [
    ...`${s.runId ?? 'legacy'}:${s.lessonId ?? s.level}:${s.wave}:${e.id}:${index}`,
  ].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 19);
  const hash = (v: string | number) =>
    [...String(v)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, fixedSeed);
  const others = pool
    .filter((v) => v !== correct)
    .sort((a, b) => hash(a) - hash(b))
    .slice(0, 2);
  return [correct, ...others].sort((a, b) => hash(String(a) + 'x') - hash(String(b) + 'x'));
}
export function curriculumEntryLabel(e: Entry): string {
  return e.pinyin.join(' ');
}
export function pronunciationKey(value: string): string {
  const { raw, tone } = stripTone(value);
  return raw.replace(/ü/g, 'v') + (tone || '');
}
export function validateCurriculum(): void {
  for (const lesson of LESSONS)
    lesson.waves.forEach((wave, i) => {
      if (wave.targets.length < 2 || wave.targets.length > 6)
        throw Error(`目标数量 ${lesson.id}/${i}`);
      for (const text of wave.targets) {
        const id = targetId(text);
        if (!entryAllowed(id, lesson.id, i))
          throw Error(
            `课程越界 ${lesson.id}/${i}: ${text} (${ENTRY_MAP[id] ? entryRequirements(ENTRY_MAP[id]).filter((k) => !introducedKnowledge(lesson.id, i).has(k)) : '缺少条目'})`,
          );
      }
    });
}
validateCurriculum();

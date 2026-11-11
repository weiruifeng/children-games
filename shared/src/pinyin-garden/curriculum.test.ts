import { describe, it, expect } from 'vitest';
import {
  LESSONS,
  entryAllowed,
  entryRequirements,
  introducedKnowledge,
  lessonPool,
  taskOptions,
  validateCurriculum,
  targetId,
} from './curriculum';
import { ENTRY_MAP, ENTRIES, LEVELS, composeParts } from './content';
import {
  createLessonGarden,
  createGarden,
  startWave,
  placePlant,
  selectKnowledge,
  choosePart,
  submitTask,
  tickGarden,
  hasSharedAmmo,
  resumeSnapshot,
  snapshot,
} from './simulation';
import { knowledgePool, createReview, learningFacts } from './review';
import { newProfile, legacyProfile, parseProfile, parseState } from './snapshot';

function answer(s: ReturnType<typeof createLessonGarden>, id: string) {
  expect(selectKnowledge(s, id)).toBe(true);
  while (s.task && !s.task.finished) {
    s.task.parts = { ...ENTRY_MAP[id].parts[s.task.index] };
    expect(submitTask(s)).toBe(true);
  }
}
describe('complete curriculum scope', () => {
  it('covers fourteen lessons with only introduced answers and candidates in all 42 waves', () => {
    expect(LESSONS).toHaveLength(14);
    validateCurriculum();
    for (const lesson of LESSONS)
      for (let wave = 0; wave < 3; wave++)
        for (const battle of [1, 3, 5]) {
          const s = createLessonGarden(lesson.id, battle);
          s.wave = wave;
          const scope = introducedKnowledge(lesson.id, wave);
          const pool = lessonPool(lesson.id, wave, battle);
          expect(pool.length).toBeLessThanOrEqual(6);
          for (const id of pool) {
            const e = ENTRY_MAP[id];
            expect(entryAllowed(id, lesson.id, wave), id).toBe(true);
            for (const [index, p] of e.parts.entries())
              for (const key of ['initial', 'medial', 'final', 'whole', 'tone'] as const) {
                if (!p[key]) continue;
                const options = taskOptions(s, e, index, key);
                expect(options).toContain(p[key]);
                for (const v of options) {
                  const category =
                    e.type === 'symbol'
                      ? entryRequirements(e)[0].split(':')[0]
                      : key === 'tone'
                        ? 'tone'
                        : key === 'whole'
                          ? 'whole'
                          : key === 'initial'
                            ? 'initial'
                            : 'final';
                  expect(scope.has(`${category}:${v}`), `${lesson.id}/${wave} ${key}:${v}`).toBe(
                    true,
                  );
                }
              }
          }
        }
  });
  it('does not expose m in vowels, m/f in b/p wave, nasal finals before their lessons', () => {
    expect(entryAllowed('char-1', 1)).toBe(false);
    expect(entryAllowed('char-1', 3, 0)).toBe(false);
    expect(entryAllowed('char-1', 3, 1)).toBe(true);
    expect(entryAllowed('char-14', 13)).toBe(false);
    expect(entryAllowed('char-14', 14)).toBe(true);
    expect(entryAllowed('char-13', 9)).toBe(false);
    expect(entryAllowed('char-13', 10)).toBe(true);
  });
  it('keeps all 30 legacy characters and 12 words reachable without bypassing prerequisites', () => {
    const pool = new Set(LESSONS.flatMap((l) => l.waves.flatMap((_, i) => lessonPool(l.id, i, 5))));
    expect(
      ENTRIES.filter(
        (e) => !e.readingId && (e.type === 'character' || e.type === 'word') && !pool.has(e.id),
      ).map((e) => e.text),
    ).toEqual([]);
  });
  it('enforces scope in commands too, not just buttons', () => {
    const s = createLessonGarden(1);
    startWave(s);
    selectKnowledge(s, 'symbol-a');
    choosePart(s, 'whole', 'm');
    expect(s.task!.parts.whole).toBe('');
    expect(selectKnowledge(s, 'char-1')).toBe(false);
  });
  it('supports letters without inventing a tone and validates special spellings', () => {
    const s = createLessonGarden(1);
    startWave(s);
    answer(s, 'symbol-a');
    expect(hasSharedAmmo(s, 'symbol-a')).toBe(true);
    expect(s.task!.parts.tone).toBe(0);
    for (const pinyin of ['jū', 'nǚ', 'jué', 'nüè', 'niú', 'shuǐ']) {
      const e = ENTRY_MAP[targetId(pinyin)];
      expect(composeParts(e.parts[0])).toBe(pinyin);
    }
  });
});

describe('original realtime combat with all course/battle combinations', () => {
  for (const lesson of LESSONS)
    for (const battle of [1, 2, 3, 4, 5])
      it(`lesson ${lesson.id}, original battlefield ${battle} completes three waves`, () => {
        const s = createLessonGarden(lesson.id, battle, 173 + lesson.id * 71);
        startWave(s);
        const attack = battle >= 3 ? 'plant_cone_launcher' : 'plant_pod_slinger';
        placePlant(s, 'plant_dew_collector', LEVELS[battle - 1].rows[0], 1);
        for (let step = 0; step < 30000 && s.stage !== 'won' && s.stage !== 'lost'; step++) {
          if (s.stage === 'between') startWave(s);
          for (const row of LEVELS[battle - 1].rows)
            if (!s.plants.some((p) => p.row === row && p.kind === attack))
              placePlant(s, attack, row, 0);
          for (const e of s.enemies) if (!hasSharedAmmo(s, e.entryId)) answer(s, e.entryId);
          tickGarden(s, 0.1);
        }
        expect(s.stage, `hearts ${s.hearts}, wave ${s.wave}`).toBe('won');
        expect(s.wave).toBe(2);
        expect(s.attempts.every((a) => a.lessonId === lesson.id)).toBe(true);
      });
  it('continues enemy movement and resource clocks while a task is open', () => {
    const s = createLessonGarden(1);
    startWave(s);
    for (let i = 0; i < 130; i++) tickGarden(s, 0.1);
    selectKnowledge(s, 'symbol-a');
    const x = s.enemies[0].x,
      time = s.time;
    tickGarden(s, 0.1);
    expect(s.enemies[0].x).toBeLessThan(x);
    expect(s.time).toBeGreaterThan(time);
    expect(s.task?.finished).toBe(false);
  });
  it('keeps original combat numbers and twelve second deployment unchanged', () => {
    const legacy = createGarden(1),
      s = createLessonGarden(1);
    startWave(s);
    startWave(legacy);
    expect(s.nextSpawn).toBe(12);
    for (let i = 0; i < 130; i++) {
      tickGarden(s, 0.1);
      tickGarden(legacy, 0.1);
    }
    expect(s.enemies[0].hp).toBe(legacy.enemies[0].hp);
    expect(s.enemies[0].x).toBe(legacy.enemies[0].x);
    expect(s.dew).toBe(legacy.dew);
  });
});

describe('v2 saves and honest learning facts', () => {
  it('archives v1 without pretending the five battles are fourteen learned lessons', () => {
    const old = legacyProfile('old');
    old.unlocked = 5;
    old.stars['5'] = [true, true, true];
    old.checkpoint = snapshot(createGarden(5));
    const p = parseProfile(old);
    expect(p.unlocked).toBe(5);
    expect(p.lessonUnlocked).toBe(1);
    expect(p.checkpoint).toBeNull();
    expect(p.legacyArchive).toEqual(old);
    expect(parseProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('restores a corrected task with the original error and identical options', () => {
    const s = createLessonGarden(3);
    s.wave = 1;
    startWave(s);
    selectKnowledge(s, targetId('mā'));
    s.task!.parts = { ...ENTRY_MAP[targetId('mā')].parts[0], tone: 3 };
    submitTask(s, 1);
    const p = newProfile('new');
    p.lessonUnlocked = 3;
    p.selectedLesson = 3;
    p.checkpoint = resumeSnapshot(s);
    p.waveStart = snapshot(s);
    const r = parseState(resumeSnapshot(s));
    expect(r.task!.errors).toBe(1);
    expect(taskOptions(r, ENTRY_MAP[r.task!.entryId], 0, 'initial')).toEqual(
      taskOptions(s, ENTRY_MAP[s.task!.entryId], 0, 'initial'),
    );
    r.task!.parts = { ...ENTRY_MAP[r.task!.entryId].parts[0] };
    submitTask(r, 2);
    expect(learningFacts(r.attempts, r.task!.entryId).independent).toBe(0);
  });
  it('opens review before the final battle and never adds unseen or out-of-range items', () => {
    const s = createLessonGarden(1);
    startWave(s);
    answer(s, 'symbol-a');
    const r = createReview(s.attempts, Date.now(), 1, 1);
    startWave(r);
    expect(knowledgePool(r)).toEqual(['symbol-a']);
    const p = newProfile('new');
    p.attempts = s.attempts;
    p.checkpoint = resumeSnapshot(r);
    const { selectedLevel: _selectedLevel, levelStars: _levelStars, ...v2 } = p;
    const migrated = parseProfile({ ...v2, version: 2, packVersion: 'garden-curriculum-2' });
    expect(migrated.checkpoint).toBeNull();
    expect(migrated.previousArchive).toMatchObject({ checkpoint: { reviewPool: ['symbol-a'] } });
  });
  it('rejects a tampered checkpoint with out-of-scope targets', () => {
    const s = createLessonGarden(1);
    s.sharedAmmo = ['char-1'];
    const p = newProfile('new');
    p.checkpoint = resumeSnapshot(s);
    expect(() => parseProfile(p)).toThrow();
  });
});

it('never reshuffles options as the combat random seed advances', () => {
  const s = createLessonGarden(3);
  startWave(s);
  const e = ENTRY_MAP[targetId('bā')];
  selectKnowledge(s, e.id);
  const before = taskOptions(s, e, 0, 'initial');
  for (let i = 0; i < 150; i++) tickGarden(s, 0.1);
  expect(taskOptions(s, e, 0, 'initial')).toEqual(before);
});
it('a first-lesson review does not force an unseen tutorial a target', () => {
  const s = createLessonGarden(1);
  startWave(s);
  answer(s, 'symbol-o');
  const r = createReview(s.attempts, Date.now(), 1, 1);
  startWave(r);
  for (let i = 0; i < 130; i++) tickGarden(r, 0.1);
  expect(r.enemies.map((e) => e.entryId)).toEqual(['symbol-o']);
});

it('does not introduce an unlearned medial role through a distractor', () => {
  const s = createLessonGarden(5);
  s.wave = 1;
  const e = ENTRY_MAP[targetId('guā')];
  expect(taskOptions(s, e, 0, 'medial')).toEqual(['u']);
});

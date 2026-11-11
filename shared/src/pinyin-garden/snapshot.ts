import {
  CHARACTER_PACK,
  recommendedLevel,
  CHARACTER_LEVEL_MAP,
  LEGACY_CHARACTER_LEVEL_MAP,
  lessonTrack,
  resolveAdventure,
} from './characterCatalog';
import { validateLearningPlan } from './lessonPlanner';
import { z } from 'zod';
import { ENTRY_MAP, PLANT_IDS, ENEMY_IDS } from './content';
import { entryAllowed, CURRICULUM_VERSION } from './curriculum';
import { knowledgePool } from './review';
import type { GardenState, LearningAttempt } from './model';
const n = z.number().finite();
const positive = n.nonnegative();
const id = n.int().positive();
const row = n.int().min(0).max(2);
const col = n.int().min(0).max(5);
const taskSchema = z
  .object({
    key: z.string().max(150),
    plantId: positive.int(),
    enemyId: positive.int(),
    entryId: z.string().refine((v) => !!ENTRY_MAP[v]),
    index: positive.int().max(1),
    parts: z
      .object({
        initial: z.string().max(8),
        medial: z.string().max(8),
        final: z.string().max(8),
        whole: z.string().max(8),
        tone: n.int().min(0).max(5).nullable(),
      })
      .strict(),
    help: positive.int().max(3),
    errors: positive.int(),
    finished: z.boolean(),
    mode: z.enum(['compose', 'choose']),
    choice: z.string().max(20),
  })
  .strict()
  .refine((t) => t.index < ENTRY_MAP[t.entryId].parts.length);
const stateSchema = z
  .object({
    levelId: z.string().optional(),
    packVersion: z.string().optional(),
    learningPlan: z
      .object({
        seed: positive.int(),
        waves: z
          .array(
            z
              .object({
                answers: z.record(z.string(), z.string().max(1000)),
                entries: z.array(z.string()).max(6),
                newEntries: z.array(z.string()).max(2),
                scope: z.array(z.string()).max(150),
                options: z.record(
                  z.string(),
                  z.record(z.string(), z.array(z.union([z.string(), n]))),
                ),
              })
              .strict(),
          )
          .length(3),
      })
      .strict()
      .optional(),
    revealed: z.array(z.string()).max(100).optional(),
    audioUsed: z.array(z.string()).max(100).optional(),
    lessonId: n.int().min(1).max(14).optional(),
    runId: z.string().min(1).max(80).optional(),
    retryCount: positive.int().optional(),
    reviewPool: z
      .array(z.string().refine((v) => !!ENTRY_MAP[v]))
      .min(1)
      .max(10)
      .optional(),
    version: z.literal(1),
    level: n.int().min(1).max(5),
    seed: positive.int(),
    stage: z.enum(['ready', 'playing', 'between', 'won', 'lost']),
    wave: n.int().min(0).max(2),
    time: positive,
    waveTime: positive,
    betweenTime: positive,
    spawned: positive.int().max(7),
    nextSpawn: positive,
    dew: positive.max(1e6),
    hearts: n.int().min(0).max(3),
    rescues: z.array(z.boolean()).length(3),
    plants: z
      .array(
        z
          .object({
            id,
            kind: z.enum(PLANT_IDS),
            row,
            col,
            hp: positive.max(500),
            timer: n,
            ammo: n.int().min(0).max(3),
            signature: z.string().max(60),
            target: id.nullable(),
            firing: z.boolean(),
          })
          .strict(),
      )
      .max(18),
    enemies: z
      .array(
        z
          .object({
            id,
            kind: z.enum(ENEMY_IDS),
            row,
            x: n.min(0).max(1300),
            hp: positive.max(240),
            armor: positive.max(80),
            entryId: z.string().refine((v) => !!ENTRY_MAP[v]),
            attackTimer: positive,
          })
          .strict(),
      )
      .max(6),
    projectiles: z
      .array(
        z
          .object({
            id,
            row,
            x: n,
            y: n,
            target: id,
            signature: z.string().max(60),
            heavy: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    drops: z
      .array(z.object({ id, x: n, y: n, age: positive, value: positive.max(100) }).strict())
      .max(100),
    cooldowns: z
      .object({
        plant_pod_slinger: positive,
        plant_dew_collector: positive,
        plant_vine_guard: positive,
        plant_cone_launcher: positive,
      })
      .strict(),
    sharedAmmo: z
      .array(z.string().refine((v) => !!ENTRY_MAP[v]))
      .max(500)
      .default([]),
    drafts: z.record(z.string(), taskSchema).default({}),
    selectedPlant: id.nullable(),
    task: taskSchema.nullable(),
    paused: z.boolean(),
    helpOpen: z.literal(false),
    slow: z.boolean(),
    dropTimer: positive,
    score: positive.int().max(1e9),
    earned: z.array(z.string().max(100)).max(10000),
    results: z.record(z.string(), z.object({ independent: z.boolean() }).strict()),
    attempts: z
      .array(
        z
          .object({
            eventId: z.string().max(80).optional(),
            runId: z.string().optional(),
            levelId: z.string().optional(),
            track: z.string().optional(),
            readingId: z.string().optional(),
            wave: n.int().min(0).max(2).optional(),
            audioUsed: z.boolean().optional(),
            optionCount: positive.int().optional(),
            lessonId: n.int().min(1).max(14).optional(),
            referenceVisible: z.boolean().optional(),
            firstTryCorrect: z.boolean().optional(),
            level: n.int().min(1).max(5).optional(),
            mode: z.enum(['battle', 'review']).optional(),
            retry: z.boolean().optional(),
            taskId: z.string(),
            entryId: z.string().refine((v) => !!ENTRY_MAP[v]),
            syllable: n.int().min(0).max(1),
            correct: z.boolean(),
            assisted: z.boolean(),
            repeated: z.boolean(),
            at: positive,
          })
          .strict(),
      )
      .max(50000),
    attackedRows: z.array(row).max(3),
    strategy: z.boolean(),
    nextId: id,
    eventId: positive.int(),
    events: z.array(z.never()).length(0),
    message: z.string().max(500),
  })
  .strict();
export interface LegacyProfile {
  version: 1;
  packVersion: 'garden-1';
  name: string;
  unlocked: number;
  stars: Record<string, boolean[]>;
  best: Record<string, number>;
  checkpoint: GardenState | null;
  waveStart: GardenState | null;
  attempts: LearningAttempt[];
  settings: { music: number; sfx: number; slow: boolean; reducedMotion: boolean };
}
export function legacyProfile(name: string): LegacyProfile {
  return {
    version: 1,
    packVersion: 'garden-1',
    name,
    unlocked: 1,
    stars: {},
    best: {},
    checkpoint: null,
    waveStart: null,
    attempts: [],
    settings: { music: 0.35, sfx: 0.6, slow: false, reducedMotion: false },
  };
}
export function parseState(value: unknown): GardenState {
  const s = stateSchema.parse(value);
  if (s.levelId) validateLearningPlan(s as GardenState);
  const ids = [...s.plants, ...s.enemies, ...s.projectiles, ...s.drops].map((e) => e.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => id >= s.nextId))
    throw new Error('实体编号冲突');
  if (
    s.reviewPool &&
    ((!s.lessonId && s.level !== 5) || new Set(s.reviewPool).size !== s.reviewPool.length)
  )
    throw new Error('复习知识池无效');
  if (s.sharedAmmo.some((id) => !knowledgePool(s as GardenState).includes(id)))
    throw new Error('弹药超出当前关卡知识池');
  if (new Set(s.plants.map((p) => `${p.row}:${p.col}`)).size !== s.plants.length)
    throw new Error('植物格子冲突');
  const pool = knowledgePool(s as GardenState);
  if (s.lessonId && pool.some((id) => !entryAllowed(id, s.lessonId!, s.reviewPool ? 2 : s.wave)))
    throw Error('课程知识越界');
  if (s.enemies.some((e) => !pool.includes(e.entryId))) throw Error('敌人超出知识池');
  if (
    Object.entries(s.drafts).some(([key, t]) => key !== t.entryId || !pool.includes(key)) ||
    (s.task && !pool.includes(s.task.entryId))
  )
    throw new Error('拼音草稿超出知识池');
  if (s.task) s.drafts[s.task.entryId] = s.task;
  return s as GardenState;
}
export function parseLegacyProfile(input: unknown): LegacyProfile {
  const raw = z
    .object({
      version: z.literal(1),
      packVersion: z.literal('garden-1'),
      name: z.string().min(1).max(20),
      unlocked: n.int().min(1).max(5),
      stars: z.record(z.string(), z.array(z.boolean()).length(3)),
      best: z.record(z.string(), positive.int().max(1e9)),
      checkpoint: z.unknown(),
      waveStart: z.unknown().optional(),
      attempts: stateSchema.shape.attempts,
      settings: z
        .object({
          music: n.min(0).max(1),
          sfx: n.min(0).max(1),
          slow: z.boolean(),
          reducedMotion: z.boolean(),
        })
        .strict(),
    })
    .strict()
    .parse(input);
  if (Object.keys(raw.stars).some((k) => !['1', '2', '3', '4', '5'].includes(k)))
    throw new Error('未知关卡成就');
  const checkpoint = raw.checkpoint === null ? null : parseState(raw.checkpoint);
  const waveStart = raw.waveStart == null ? null : parseState(raw.waveStart);
  for (const state of [checkpoint, waveStart])
    if (state?.reviewPool) {
      if (!raw.stars['5']?.[0]) throw new Error('复习模式尚未解锁');
      if (state.reviewPool.some((id) => !raw.attempts.some((a) => a.entryId === id)))
        throw new Error('复习包含未学习内容');
    }
  if (checkpoint && checkpoint.level > raw.unlocked) throw new Error('检查点超出解锁范围');
  if (
    waveStart &&
    (waveStart.level > raw.unlocked ||
      (checkpoint && (waveStart.level !== checkpoint.level || waveStart.wave > checkpoint.wave)))
  )
    throw new Error('重试检查点与进度不一致');
  return { ...raw, checkpoint, waveStart } as LegacyProfile;
}

export interface Profile {
  version: 3;
  packVersion: typeof CHARACTER_PACK;
  selectedLevel: string;
  levelStars: Record<string, boolean[]>;
  previousArchive?: unknown;
  name: string;
  /** Original battle unlocks and achievements are preserved independently. */
  unlocked: number;
  battleStage: number;
  lessonUnlocked: number;
  lessonLimit: number;
  selectedLesson: number;
  stars: Record<string, boolean[]>;
  lessonStars: Record<string, boolean[]>;
  best: Record<string, number>;
  checkpoint: GardenState | null;
  waveStart: GardenState | null;
  attempts: LearningAttempt[];
  settings: {
    music: number;
    sfx: number;
    slow: boolean;
    reducedMotion: boolean;
    speech: boolean;
    speechVolume: number;
  };
  legacyArchive?: LegacyProfile;
}
export function newProfile(name: string): Profile {
  return {
    version: 3,
    packVersion: CHARACTER_PACK,
    selectedLevel: 'foundation-01',
    levelStars: {},
    name,
    unlocked: 5,
    battleStage: 1,
    lessonUnlocked: 1,
    lessonLimit: 14,
    selectedLesson: 1,
    stars: {},
    lessonStars: {},
    best: {},
    checkpoint: null,
    waveStart: null,
    attempts: [],
    settings: {
      music: 0.35,
      sfx: 0.6,
      slow: false,
      reducedMotion: false,
      speech: true,
      speechVolume: 0.8,
    },
  };
}
const stars = z.record(z.string(), z.array(z.boolean()).length(3));
const profileSchema = z
  .object({
    version: z.literal(2),
    packVersion: z.literal(CURRICULUM_VERSION),
    name: z.string().min(1).max(20),
    unlocked: n.int().min(1).max(5),
    battleStage: n.int().min(1).max(5),
    lessonUnlocked: n.int().min(1).max(14),
    lessonLimit: n.int().min(1).max(14),
    selectedLesson: n.int().min(1).max(14),
    stars,
    lessonStars: stars,
    best: z.record(z.string(), positive.int().max(1e9)),
    checkpoint: z.unknown(),
    waveStart: z.unknown(),
    attempts: stateSchema.shape.attempts,
    settings: z
      .object({
        music: n.min(0).max(1),
        sfx: n.min(0).max(1),
        slow: z.boolean(),
        reducedMotion: z.boolean(),
        speech: z.boolean(),
        speechVolume: n.min(0).max(1),
      })
      .strict(),
    legacyArchive: z.unknown().optional(),
  })
  .strict();
const profileV3Schema = profileSchema
  .extend({
    version: z.literal(3),
    packVersion: z.literal(CHARACTER_PACK),
    selectedLevel: z.string().refine((id) => !!CHARACTER_LEVEL_MAP[id]?.published),
    levelStars: stars,
    previousArchive: z.unknown().optional(),
  })
  .strict();
function validateAttempts(attempts: LearningAttempt[]): void {
  for (const a of attempts) {
    if (!a.levelId) continue;
    const level = CHARACTER_LEVEL_MAP[a.levelId] ?? LEGACY_CHARACTER_LEVEL_MAP[a.levelId],
      entry = ENTRY_MAP[a.entryId];
    if (
      !level ||
      !entry ||
      !a.runId ||
      lessonTrack(a.track) !== lessonTrack(level.track) ||
      a.readingId !== entry.readingId ||
      a.wave === undefined ||
      a.optionCount === undefined
    )
      throw Error('学习记录身份不一致');
  }
}
export function parseProfile(input: unknown): Profile {
  if (
    input &&
    typeof input === 'object' &&
    'version' in input &&
    input.version === 3 &&
    'packVersion' in input &&
    ['garden-character-3', 'garden-character-3.1'].includes(String(input.packVersion))
  ) {
    const old = profileV3Schema
      .extend({
        packVersion: z.enum(['garden-character-3', 'garden-character-3.1']),
        selectedLevel: z.string(),
      })
      .parse(input);
    return {
      ...old,
      legacyArchive:
        old.legacyArchive === undefined ? undefined : parseLegacyProfile(old.legacyArchive),
      packVersion: CHARACTER_PACK,
      unlocked: 5,
      selectedLevel: resolveAdventure(old.selectedLevel) ?? recommendedLevel(old.selectedLesson),
      levelStars: {},
      checkpoint: null,
      waveStart: null,
      previousArchive: old,
    };
  }
  if (input && typeof input === 'object' && 'version' in input && input.version === 1) {
    const old = parseLegacyProfile(input);
    return {
      ...newProfile(old.name),
      unlocked: 5,
      battleStage: old.unlocked,
      stars: old.stars,
      best: old.best,
      settings: { ...newProfile(old.name).settings, ...old.settings },
      attempts: old.attempts,
      legacyArchive: old,
    };
  }
  if (input && typeof input === 'object' && 'version' in input && input.version === 2) {
    const old = profileSchema.parse(input);
    if (old.battleStage > old.unlocked) throw Error('旧战场越界');
    for (const cp of [old.checkpoint, old.waveStart]) if (cp != null) parseState(cp);
    return {
      ...newProfile(old.name),
      unlocked: 5,
      battleStage: old.battleStage,
      stars: old.stars,
      best: old.best,
      lessonStars: old.lessonStars,
      lessonLimit: old.lessonLimit,
      lessonUnlocked: old.lessonUnlocked,
      selectedLesson: old.selectedLesson,
      selectedLevel: recommendedLevel(old.selectedLesson),
      settings: old.settings,
      attempts: old.attempts.map((a) => ({ ...a, referenceVisible: true })),
      previousArchive: old,
    };
  }
  const raw = profileV3Schema.parse(input);
  validateAttempts(raw.attempts);
  raw.unlocked = 5;
  if (
    Object.keys(raw.stars).some((k) => !['1', '2', '3', '4', '5'].includes(k)) ||
    Object.keys(raw.lessonStars).some((k) => !/^([1-9]|1[0-4])$/.test(k))
  )
    throw Error('未知成就');
  const checkpoint = raw.checkpoint == null ? null : parseState(raw.checkpoint),
    waveStart = raw.waveStart == null ? null : parseState(raw.waveStart);
  for (const state of [checkpoint, waveStart]) {
    if (!state) continue;
    validateAttempts(state.attempts);
    if (!state.levelId || !state.runId) throw Error('新版检查点缺少课程信息');
    if (state.level > raw.unlocked) throw Error('检查点超出解锁范围');
    if (state.reviewPool?.some((id) => !raw.attempts.some((a) => a.lessonId && a.entryId === id)))
      throw Error('复习包含未学习内容');
  }
  if (
    waveStart &&
    (!checkpoint ||
      JSON.stringify(waveStart.learningPlan) !== JSON.stringify(checkpoint.learningPlan) ||
      waveStart.runId !== checkpoint.runId ||
      waveStart.level !== checkpoint.level ||
      waveStart.levelId !== checkpoint.levelId ||
      waveStart.wave > checkpoint.wave)
  )
    throw Error('波初检查点不匹配');
  const legacyArchive =
    raw.legacyArchive === undefined ? undefined : parseLegacyProfile(raw.legacyArchive);
  return { ...raw, checkpoint, waveStart, legacyArchive } as Profile;
}

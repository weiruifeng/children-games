import { z } from 'zod';
import { parseProfile, type Profile } from './snapshot';
import { CHARACTER_LEVEL_MAP, CHARACTER_PACK } from './characterCatalog';
import type { LearningAttempt } from './model';
export const CLOUD_LIMITS = {
  snapshot: 1024 * 1024,
  eventBatch: 256 * 1024,
  events: 200,
  archive: 24 * 1024 * 1024,
  backup: 128 * 1024 * 1024,
} as const;
export const slotSchema = z.number().int().min(1).max(3);
export const uuidSchema = z.string().uuid();
export const revisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
export type CloudProfile = Omit<
  Profile,
  'attempts' | 'previousArchive' | 'legacyArchive' | 'checkpoint' | 'waveStart'
> & {
  cloudVersion: 1;
  checkpoint: Profile['checkpoint'];
  waveStart: Profile['waveStart'];
};
export function toCloudProfile(profile: Profile): CloudProfile {
  const { attempts: _a, previousArchive: _p, legacyArchive: _l, ...rest } = profile;
  return {
    ...rest,
    cloudVersion: 1,
    checkpoint: rest.checkpoint ? { ...rest.checkpoint, attempts: [] } : null,
    waveStart: rest.waveStart ? { ...rest.waveStart, attempts: [] } : null,
  };
}
export function parseCloudProfile(input: unknown): CloudProfile {
  if (!input || typeof input !== 'object') throw Error('无效存档');
  const raw = input as Record<string, unknown>;
  if (raw.cloudVersion !== 1) throw Error('未知云存档格式');
  if (['attempts', 'previousArchive', 'legacyArchive'].some((k) => k in raw))
    throw Error('历史事件与归档必须单独提交');
  if (Object.keys((raw.levelStars ?? {}) as object).some((id) => !CHARACTER_LEVEL_MAP[id]))
    throw Error('未知关卡成绩');
  for (const key of ['checkpoint', 'waveStart']) {
    const cp = raw[key] as { attempts?: unknown[] } | null;
    if (cp?.attempts?.length) throw Error('战斗快照不能内嵌历史事件');
  }
  if (new TextEncoder().encode(JSON.stringify(raw)).length > CLOUD_LIMITS.snapshot)
    throw Error('快照超过容量限制');
  const { cloudVersion: _v, ...local } = raw;
  return toCloudProfile(parseProfile({ ...local, attempts: [] }));
}
const short = z.string().max(160),
  bool = z.boolean();
export const attemptSchema = z
  .object({
    eventId: z.string().max(80).optional(),
    runId: short.optional(),
    levelId: short.optional(),
    track: short.optional(),
    readingId: short.optional(),
    wave: z.number().int().min(0).max(2).optional(),
    audioUsed: bool.optional(),
    optionCount: z.number().int().min(0).max(100).optional(),
    lessonId: z.number().int().min(1).max(14).optional(),
    referenceVisible: bool.optional(),
    firstTryCorrect: bool.optional(),
    level: z.number().int().min(1).max(5).optional(),
    mode: z.enum(['battle', 'review']).optional(),
    retry: bool.optional(),
    taskId: z.string().max(300),
    entryId: short,
    syllable: z.number().int().min(0).max(1),
    correct: bool,
    assisted: bool,
    repeated: bool,
    at: z.number().finite().nonnegative().max(8640000000000000),
  })
  .strict();
export const eventSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    eventId: z.string().regex(/^[a-zA-Z0-9:-]{1,160}$/),
    packVersion: z.string().min(1).max(80),
    attempt: attemptSchema,
  })
  .strict();
export type LearningEvent = z.infer<typeof eventSchema>;
export interface CloudSlot {
  slot: number;
  profileId: string;
  revision: number;
  generation: number;
  updatedAt: string;
  profile: CloudProfile | null;
}
export function hydrateProfile(profile: CloudProfile, events: LearningAttempt[]): Profile {
  const { cloudVersion: _v, ...local } = profile;
  return {
    ...local,
    attempts: events,
    checkpoint: profile.checkpoint
      ? {
          ...profile.checkpoint,
          attempts: events.filter((a) => a.runId === profile.checkpoint?.runId),
        }
      : null,
    waveStart: profile.waveStart ? { ...profile.waveStart, attempts: [] } : null,
  };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function eventForAttempt(
  attempt: LearningAttempt,
  packVersion: string = CHARACTER_PACK,
): Promise<LearningEvent> {
  const parsed = attemptSchema.parse(attempt);
  if (parsed.eventId)
    return { schemaVersion: 1, eventId: parsed.eventId, packVersion, attempt: parsed };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(parsed)));
  return {
    schemaVersion: 1,
    eventId: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(''),
    packVersion,
    attempt: parsed,
  };
}
/** Separate durable history from battle compatibility. Caller must archive and confirm before discarding an incompatible battle. */
export function prepareImport(input: unknown): { profile: Profile; recoveredBattle: boolean } {
  if (!input || typeof input !== 'object') throw Error('备份不是存档');
  const raw = input as Record<string, unknown>,
    pack = String(raw.packVersion);
  if (!(
    (raw.version === 1 && pack === 'garden-1') ||
    (raw.version === 2 && pack === 'garden-curriculum-2') ||
    (raw.version === 3 &&
      [CHARACTER_PACK, 'garden-character-3', 'garden-character-3.1'].includes(pack))
  ))
    throw Error('未知存档或内容包版本');
  if (!Array.isArray(raw.attempts) && raw.attempts !== undefined) throw Error('学习历史格式无效');
  const attempts = ((raw.attempts as unknown[]) ?? []).map((a) => attemptSchema.parse(a));
  const { cloudVersion: _v, ...local } = raw;
  const withoutHistory = { ...local, attempts: [] };
  try {
    return { profile: { ...parseProfile(withoutHistory), attempts }, recoveredBattle: false };
  } catch (original) {
    if (!raw.checkpoint && !raw.waveStart) throw original;
    const base = parseProfile({ ...withoutHistory, checkpoint: null, waveStart: null });
    return { profile: { ...base, attempts }, recoveredBattle: true };
  }
}

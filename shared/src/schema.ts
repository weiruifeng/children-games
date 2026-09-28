import { z } from 'zod';

const BaseSpec = z.object({
  schemaVersion: z.literal('0.2'),
  orientation: z.literal('landscape'),
  title: z.string().min(1),
});

export const HitPolicySchema = z.union([
  z.literal('bounce'),
  z.literal('lose-score'),
  z.literal('lose-life'),
  z.literal('drop-item'),
]);

const CollectibleObjectSchema = z.object({
  type: z.literal('collectible'),
  asset: z.string().min(1),
  score: z.number().positive(),
  count: z.number().int().positive(),
  effect: z.union([z.literal('grow'), z.literal('fly')]).optional(),
});

const ObstacleObjectSchema = z.object({
  type: z.literal('obstacle'),
  asset: z.string().min(1),
  count: z.number().int().positive(),
});

const HazardObjectSchema = z.object({
  type: z.literal('hazard'),
  asset: z.string().min(1),
  area: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

const EnemyObjectSchema = z.object({
  type: z.literal('enemy'),
  asset: z.string().min(1),
  speed: z.number().positive(),
  count: z.number().int().positive(),
});

export const GameObjectSchema = z.discriminatedUnion('type', [
  CollectibleObjectSchema,
  ObstacleObjectSchema,
  HazardObjectSchema,
  EnemyObjectSchema,
]);

export const CollectSpecSchema = BaseSpec.extend({
  gameType: z.literal('collect'),
  player: z.object({
    character: z.string().min(1),
    movement: z.literal('follow-finger'),
    speed: z.number().positive().optional().default(300),
  }),
  background: z.object({ asset: z.string().min(1) }),
  objects: z.array(GameObjectSchema).min(1),
  hitPolicy: HitPolicySchema.optional().default('lose-score'),
  hitScore: z.number().positive().optional().default(5),
  win: z.object({ type: z.literal('score'), value: z.number().positive() }),
}).strict();

export const DodgeSpecSchema = BaseSpec.extend({ gameType: z.literal('dodge') }).strict();
export const JumpSpecSchema = BaseSpec.extend({ gameType: z.literal('jump') }).strict();

export const GameSpecSchema = z.discriminatedUnion('gameType', [
  CollectSpecSchema,
  DodgeSpecSchema,
  JumpSpecSchema,
]);

export type GameSpec = z.infer<typeof GameSpecSchema>;
export type CollectSpec = z.infer<typeof CollectSpecSchema>;
export type GameObject = z.infer<typeof GameObjectSchema>;
export type HitPolicy = z.infer<typeof HitPolicySchema>;
export type CollectibleObject = z.infer<typeof CollectibleObjectSchema>;
export type ObstacleObject = z.infer<typeof ObstacleObjectSchema>;
export type HazardObject = z.infer<typeof HazardObjectSchema>;
export type EnemyObject = z.infer<typeof EnemyObjectSchema>;

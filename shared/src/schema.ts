import { z } from 'zod';

const BaseSpec = z.object({
  schemaVersion: z.literal('0.1'),
  orientation: z.literal('landscape'),
  title: z.string().min(1),
});

export const CollectSpecSchema = BaseSpec.extend({
  gameType: z.literal('collect'),
  player: z.object({
    character: z.string().min(1),
    movement: z.literal('follow-finger'),
    speed: z.number().positive().optional().default(300),
  }),
  background: z.object({
    asset: z.string().min(1),
  }),
  collectibles: z
    .array(
      z.object({
        asset: z.string().min(1),
        score: z.number().positive(),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
  win: z.object({
    type: z.literal('score'),
    value: z.number().positive(),
  }),
}).strict();

export const DodgeSpecSchema = BaseSpec.extend({
  gameType: z.literal('dodge'),
}).strict();

export const JumpSpecSchema = BaseSpec.extend({
  gameType: z.literal('jump'),
}).strict();

export const GameSpecSchema = z.discriminatedUnion('gameType', [
  CollectSpecSchema,
  DodgeSpecSchema,
  JumpSpecSchema,
]);

export type GameSpec = z.infer<typeof GameSpecSchema>;
export type CollectSpec = z.infer<typeof CollectSpecSchema>;

import { z } from 'zod';
import {
  cloudSlotEnvelopeSchema,
  eventSchema,
  revisionSchema,
  mutationResultSchema,
  type CloudProfile,
  type LearningEvent,
} from '@children-games/shared';

export interface ProfileRow {
  slot: number;
  profileId: string;
  revision: number;
  generation: number;
  profile: CloudProfile | null;
  sequence: number;
  acked: number;
  updatedAt: string;
  inFlight?: {
    baseRevision: number;
    generation: number;
    mutationId: string;
    profile: CloudProfile;
    sequence: number;
  };
}
export const eventRowSchema = z.object({
  event: eventSchema,
  generation: revisionSchema,
  acked: z.boolean(),
});
export interface EventRow {
  event: LearningEvent;
  generation: number;
  acked: boolean;
}
export const clearOperationSchema = z.object({
  baseRevision: revisionSchema,
  generation: revisionSchema,
  mutationId: z.string(),
  erase: z.boolean(),
});
export type ClearOperation = z.infer<typeof clearOperationSchema>;
export const receiptSchema = z.object({ complete: z.boolean(), revision: revisionSchema });
export const recoverySchema = z.object({
  token: z.string().optional(),
  generation: revisionSchema,
  profile: z.unknown(),
  attempts: z.array(eventSchema.shape.attempt),
});
export const localRowSchema = cloudSlotEnvelopeSchema.extend({
  slot: z.number().int().min(0).max(2),
  sequence: revisionSchema,
  acked: revisionSchema,
  inFlight: z
    .object({
      baseRevision: revisionSchema,
      generation: revisionSchema,
      mutationId: z.string(),
      profile: z.unknown(),
      sequence: revisionSchema,
    })
    .optional(),
});
export function parseLocalRow(input: unknown): ProfileRow {
  const row = localRowSchema.parse(input);
  return {
    ...row,
    // Validate the envelope first, retaining unsupported historical battle data
    // so it can still be archived/exported before recovery.
    profile: row.profile as CloudProfile | null,
    inFlight: row.inFlight
      ? { ...row.inFlight, profile: row.inFlight.profile as CloudProfile }
      : undefined,
  };
}
export const backupHeaderSchema = z.object({
  format: z.literal('garden-backup'),
  version: z.literal(1),
  slot: cloudSlotEnvelopeSchema.extend({ slot: z.number().int().min(0).max(2) }),
});
export interface BackupHeader {
  slot: { generation: number; profile: CloudProfile };
}
export const parseMutation = (input: unknown) => mutationResultSchema.parse(input);
export function objectRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw Error('记录不是对象');
  return input as Record<string, unknown>;
}

export const parseJson = (text: string): unknown => JSON.parse(text) as unknown;

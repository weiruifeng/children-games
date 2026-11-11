import { z } from 'zod';
import { eventSchema, revisionSchema } from './cloud';

export const userSchema = z.object({
  id: z.string().min(1),
  username: z.string(),
  role: z.enum(['user', 'admin']),
});
export const accountSchema = z.object({ user: userSchema, csrfToken: z.string().min(1) });
export const mutationResultSchema = z.object({
  revision: revisionSchema,
  generation: revisionSchema,
  updatedAt: z.string(),
});
export type MutationResult = z.infer<typeof mutationResultSchema>;
// Profile compatibility is deliberately checked by the repository after the shell
// has been read: unsupported old battles must remain exportable and recoverable.
export const cloudSlotEnvelopeSchema = z.object({
  slot: z.number().int().min(1).max(3),
  profileId: z.string(),
  revision: revisionSchema,
  generation: revisionSchema,
  updatedAt: z.string(),
  profile: z.record(z.string(), z.unknown()).nullable(),
});
export const eventPageSchema = z.object({
  items: z.array(
    eventSchema.extend({ generation: revisionSchema, sequence: z.number().optional() }),
  ),
  nextCursor: z.number().nullable(),
});
export type EventPage = z.infer<typeof eventPageSchema>;
export const archivePageSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), createdAt: z.unknown().optional(), data: z.unknown().optional() }),
  ),
});
export type ArchivePage = z.infer<typeof archivePageSchema>;
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  }),
  requestId: z.string().optional(),
});

/** Validates transport structure without discarding historical profile payloads. */
export function decodeResponse(path: string, method: string, input: unknown): unknown {
  const route = path.split('?')[0];
  if (route.endsWith('/auth/me')) return accountSchema.parse(input);
  if (/^\/garden\/profiles\/\d$/.test(route))
    return method === 'GET'
      ? cloudSlotEnvelopeSchema.parse(input)
      : mutationResultSchema.parse(input);
  if (/^\/garden\/profiles\/\d\/(clear|delete-history)$/.test(route))
    return mutationResultSchema.parse(input);
  if (route.endsWith('/events'))
    return method === 'GET'
      ? eventPageSchema.parse(input)
      : z.object({ accepted: z.array(z.string()) }).parse(input);
  if (route.startsWith('/garden/archives') && method === 'GET')
    return archivePageSchema.parse(input);
  return input;
}

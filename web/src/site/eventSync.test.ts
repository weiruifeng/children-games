import { describe, expect, it } from 'vitest';
import { eventSchema } from '@children-games/shared';
import { ApiError } from './api';
import { uploadEvents } from './eventSync';
const rows = Array.from({ length: 4 }, (_, i) => ({
  generation: 0,
  event: eventSchema.parse({
    eventId: `e:${i}`,
    packVersion: 'garden-adventure-4',
    attempt: {
      taskId: 't',
      entryId: 'symbol-a',
      syllable: 0,
      correct: true,
      assisted: false,
      repeated: false,
      at: i,
    },
  }),
}));
describe('event upload confirmation', () => {
  it('splits a 413 response and acknowledges each successful subset once', async () => {
    const confirmed: string[] = [];
    await uploadEvents(
      rows,
      async (body) => {
        if (body.events.length > 1) throw new ApiError(413, 'LIMIT', 'large');
        return { accepted: body.events.map((e) => e.eventId) };
      },
      async (group) => {
        confirmed.push(...group.map((r) => r.event.eventId));
      },
    );
    expect(confirmed).toEqual(rows.map((r) => r.event.eventId));
  });
  it('retains unconfirmed events after a partial server acknowledgment', async () => {
    const confirmed: string[] = [];
    await expect(
      uploadEvents(
        rows,
        async () => ({ accepted: ['e:0'] }),
        async (group) => {
          confirmed.push(...group.map((r) => r.event.eventId));
        },
      ),
    ).rejects.toThrow(/尚未确认/);
    expect(confirmed).toEqual(['e:0']);
  });
  it('stops splitting a single rejected event without deleting it', async () => {
    let calls = 0,
      acks = 0;
    await expect(
      uploadEvents(
        rows.slice(0, 1),
        async () => {
          calls++;
          throw new ApiError(413, 'LIMIT', 'large');
        },
        async () => {
          acks++;
        },
      ),
    ).rejects.toThrow(/本机记录已保留/);
    expect(calls).toBe(1);
    expect(acks).toBe(0);
  });
});

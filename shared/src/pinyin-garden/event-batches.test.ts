import { describe, expect, it } from 'vitest';
import { CLOUD_LIMITS, eventSchema } from './cloud';
import { eventBatches } from './event-batches';
const event = (i: number) =>
  eventSchema.parse({
    eventId: `event:${i}`,
    packVersion: 'garden-adventure-4',
    attempt: {
      taskId: '字'.repeat(300),
      entryId: '字'.repeat(160),
      runId: '字'.repeat(160),
      readingId: '字'.repeat(160),
      syllable: 0,
      correct: true,
      assisted: false,
      repeated: false,
      at: i,
    },
  });
describe('event wire batches', () => {
  it('also enforces the count limit when small events fit in the byte budget', () => {
    const rows = Array.from({ length: CLOUD_LIMITS.events + 1 }, (_, i) => ({
      generation: 0,
      event: {
        ...event(i),
        attempt: {
          taskId: 't',
          entryId: 'symbol-a',
          syllable: 0,
          correct: true,
          assisted: false,
          repeated: false,
          at: i,
        },
      },
    }));
    expect(eventBatches(rows).map((batch) => batch.rows.length)).toEqual([CLOUD_LIMITS.events, 1]);
    expect(eventBatches([])).toEqual([]);
  });
  it('counts the UTF-8 request envelope and preserves order, identity and generation', () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({
      generation: i < 200 ? 0 : 1,
      event: event(i),
    }));
    const batches = eventBatches(rows);
    expect(batches.length).toBeGreaterThan(2);
    expect(batches.flatMap((b) => b.rows)).toEqual(rows);
    for (const batch of batches) {
      expect(batch.rows.length).toBeLessThanOrEqual(CLOUD_LIMITS.events);
      expect(new TextEncoder().encode(JSON.stringify(batch.body)).length).toBeLessThanOrEqual(
        CLOUD_LIMITS.eventBatch,
      );
      expect(batch.rows.every((r) => r.generation === batch.body.generation)).toBe(true);
    }
  });
  it('accepts an exact byte limit and rejects a single event beyond it', () => {
    const rows = [{ generation: 0, event: event(0) }];
    const bytes = new TextEncoder().encode(
      JSON.stringify({ generation: 0, events: [rows[0].event] }),
    ).length;
    expect(eventBatches(rows, bytes)).toHaveLength(1);
    expect(() => eventBatches(rows, bytes - 1)).toThrow(/单条/);
  });
});

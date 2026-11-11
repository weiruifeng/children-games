import { CLOUD_LIMITS, type LearningEvent } from './cloud';

export interface PendingEvent {
  generation: number;
  event: LearningEvent;
}
export interface EventBatch<T extends PendingEvent> {
  rows: T[];
  body: { generation: number; events: LearningEvent[] };
}
export class EventSizeError extends Error {}
const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Bounds the actual wire envelope, including UTF-8 and commas, not just event count. */
export function eventBatches<T extends PendingEvent>(
  rows: T[],
  byteLimit: number = CLOUD_LIMITS.eventBatch,
): EventBatch<T>[] {
  const result: EventBatch<T>[] = [];
  let batch: EventBatch<T> | undefined,
    bytes = 0;
  for (const row of rows) {
    const eventBytes = byteLength(row.event);
    const emptyBytes = byteLength({ generation: row.generation, events: [] });
    if (emptyBytes + eventBytes > byteLimit)
      throw new EventSizeError('单条学习记录超过同步上限，请先导出备份；本机记录已保留');
    if (
      !batch ||
      batch.body.generation !== row.generation ||
      batch.rows.length >= CLOUD_LIMITS.events ||
      bytes + eventBytes + (batch.rows.length ? 1 : 0) > byteLimit
    ) {
      batch = { rows: [], body: { generation: row.generation, events: [] } };
      result.push(batch);
      bytes = emptyBytes;
    }
    bytes += eventBytes + (batch.rows.length ? 1 : 0);
    batch.rows.push(row);
    batch.body.events.push(row.event);
  }
  return result;
}

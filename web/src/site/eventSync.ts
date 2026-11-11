import { eventBatches, type PendingEvent } from '@children-games/shared';
import { ApiError } from './api';

/** Retry only oversized batches; acknowledge only IDs explicitly accepted by the server. */
export async function uploadEvents<T extends PendingEvent>(
  rows: T[],
  send: (body: { generation: number; events: T['event'][] }) => Promise<{ accepted: string[] }>,
  acknowledge: (rows: T[]) => Promise<void>,
): Promise<void> {
  for (const batch of eventBatches(rows)) {
    let result: { accepted: string[] };
    try {
      result = await send(batch.body);
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        if (batch.rows.length === 1)
          throw new ApiError(
            413,
            'EVENT_TOO_LARGE',
            '单条学习记录超过同步上限，请先导出备份；本机记录已保留',
          );
        const middle = Math.ceil(batch.rows.length / 2);
        await uploadEvents(batch.rows.slice(0, middle), send, acknowledge);
        await uploadEvents(batch.rows.slice(middle), send, acknowledge);
        continue;
      }
      throw error;
    }
    const accepted = new Set(result.accepted);
    await acknowledge(batch.rows.filter((row) => accepted.has(row.event.eventId)));
    if (batch.rows.some((row) => !accepted.has(row.event.eventId)))
      throw new ApiError(502, 'INCOMPLETE_EVENT_ACK', '部分学习记录尚未确认，稍后会重新同步');
  }
}

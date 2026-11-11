import { eventSchema, parseCloudProfile, revisionSchema } from '@children-games/shared';
import {
  objectRecord,
  backupHeaderSchema,
  type BackupHeader,
  type EventRow,
} from './repositoryModels';
export interface StagedChunk {
  staged: true;
  events: EventRow[];
  archived: unknown[];
}
/** Only stages validated records. Promotion into a garden happens after the whole file validates. */
export async function stageBackup(
  file: File,
  generation: number,
  stage: (part: number, chunk: StagedChunk) => Promise<void>,
  clear: () => Promise<void>,
) {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let pending = '',
    header: BackupHeader | null = null,
    events: EventRow[] = [],
    archived: unknown[] = [],
    chunkNumber = 0;
  const flush = async () => {
    if (!events.length && !archived.length) return;
    await stage(chunkNumber++, { staged: true, events, archived });
    events = [];
    archived = [];
  };
  const line = async (text: string) => {
    if (!text.trim()) return;
    const record = objectRecord(JSON.parse(text));
    if (!header) {
      const parsed = backupHeaderSchema.parse(record);
      if (!parsed.slot.profile) throw Error('不支持的备份格式或空花园');
      header = {
        slot: {
          generation: parsed.slot.generation,
          profile: parseCloudProfile(parsed.slot.profile),
        },
      };
      return;
    }
    if (record.event) {
      const rawEvent = objectRecord(record.event);
      const e = {
        ...eventSchema.parse({
          eventId: rawEvent.eventId,
          packVersion: rawEvent.packVersion,
          attempt: rawEvent.attempt,
        }),
        generation: revisionSchema.parse(rawEvent.generation),
      };
      if (e.generation === header.slot.generation)
        events.push({
          event: {
            schemaVersion: 1,
            eventId: e.eventId,
            packVersion: e.packVersion,
            attempt: e.attempt,
          },
          generation,
          acked: false,
        });
      else archived.push(record);
    } else if (record.archive) archived.push(record);
    else throw Error('未知备份记录类型');
    if (events.length + archived.length >= 100) await flush();
  };
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      pending += part.value;
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        await line(pending.slice(0, end));
        pending = pending.slice(end + 1);
      }
    }
    if (pending) await line(pending);
    await flush();
  } catch (e) {
    await clear();
    throw e;
  } finally {
    reader.releaseLock();
  }
  const validatedHeader = header as BackupHeader | null;
  if (!validatedHeader?.slot?.profile) throw Error('备份没有可恢复的花园');
  return { header: validatedHeader, chunkNumber };
}

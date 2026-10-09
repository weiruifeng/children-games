import type { CollectSpec } from '@children-games/shared';

export type ConverseResult =
  | { type: 'spec'; spec: CollectSpec }
  | { type: 'question'; question: string; options: string[] };

export type ConverseStreamEvent =
  | { type: 'stage'; stage: 'received' | 'generating' | 'validating' }
  | { type: 'result'; sessionId: string; result: ConverseResult }
  | { type: 'error'; message: string };

export async function converse(
  sessionId: string | undefined,
  input: string,
): Promise<{ sessionId: string; result: ConverseResult }> {
  const res = await fetch('/api/game/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, input }),
  });
  if (!res.ok) throw new Error(`对话失败: ${res.status}`);
  return res.json();
}

export async function converseStream(
  sessionId: string | undefined,
  input: string,
  onEvent: (event: ConverseStreamEvent) => void,
) {
  const response = await fetch('/api/game/converse/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ sessionId, input }),
  });
  if (!response.ok || !response.body) throw new Error(`对话失败: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const rawEvent of events) {
      const data = rawEvent.split('\n').find((line) => line.startsWith('data: '));
      if (!data) continue;
      onEvent(JSON.parse(data.slice(6)) as ConverseStreamEvent);
    }
    if (done) break;
  }
}

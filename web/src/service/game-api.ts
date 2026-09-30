import type { CollectSpec } from '@children-games/shared';

export type ConverseResult =
  | { type: 'spec'; spec: CollectSpec }
  | { type: 'question'; question: string; options: string[] };

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

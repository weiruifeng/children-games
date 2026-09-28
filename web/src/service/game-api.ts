import type { CollectSpec } from '@children-games/shared';

export async function generateGame(idea: string): Promise<CollectSpec> {
  const res = await fetch('/api/game/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea }),
  });
  if (!res.ok) throw new Error(`生成失败: ${res.status}`);
  const data = await res.json();
  return data.spec as CollectSpec;
}

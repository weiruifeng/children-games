import type { CollectSpec } from '@children-games/shared';

export type ConverseResult =
  | { type: 'spec'; spec: CollectSpec }
  | { type: 'question'; question: string; options: string[] };

export type ConverseStreamEvent =
  | { type: 'stage'; stage: 'received' | 'generating' | 'validating' }
  | { type: 'result'; sessionId: string; result: ConverseResult }
  | { type: 'error'; message: string };

export type SavedGame = {
  gameId: string;
  title: string;
  currentVersionId: string;
  versionNumber: number;
  spec: CollectSpec;
  createdAt: string;
  updatedAt: string;
};
export type GameVersionSummary = { versionId: string; versionNumber: number; origin: string; createdAt: string };

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

async function studioRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/studio/games${path}`, options);
  if (!response.ok) throw new Error(`作品库暂时不可用: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listSavedGames(): Promise<SavedGame[]> {
  return studioRequest<SavedGame[]>('');
}

export async function createSavedGame(spec: CollectSpec): Promise<SavedGame> {
  return studioRequest<SavedGame>('', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec }),
  });
}

export async function saveGameVersion(gameId: string, spec: CollectSpec): Promise<SavedGame> {
  return studioRequest<SavedGame>(`/${gameId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec }),
  });
}

export async function listGameVersions(gameId: string): Promise<GameVersionSummary[]> {
  return studioRequest<GameVersionSummary[]>(`/${gameId}/versions`);
}

export async function restoreGameVersion(gameId: string, versionId: string): Promise<SavedGame> {
  return studioRequest<SavedGame>(`/${gameId}/versions/${versionId}/restore`, { method: 'POST' });
}

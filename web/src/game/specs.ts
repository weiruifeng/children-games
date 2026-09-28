import type { CollectSpec } from '@children-games/shared';
import { validateGameSpec } from '@children-games/shared';
import dinosaur from '@specs/dinosaur-strawberry.json';
import cat from '@specs/cat-stars.json';
import rabbit from '@specs/rabbit-carrot.json';

// 收紧到 collect 分支：手写 specs 均为 collect，若未来加入非 collect 会在此抛错
function asCollect(json: unknown): CollectSpec {
  const spec = validateGameSpec(json);
  if (spec.gameType !== 'collect') {
    throw new Error(`期望 collect spec，得到 ${spec.gameType}`);
  }
  return spec;
}

export const GAMES: { id: string; spec: CollectSpec }[] = [
  { id: 'dinosaur', spec: asCollect(dinosaur) },
  { id: 'cat', spec: asCollect(cat) },
  { id: 'rabbit', spec: asCollect(rabbit) },
];

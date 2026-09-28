export type AssetSpec = {
  kind: 'emoji' | 'color';
  emoji?: string;
  color?: number;
  radius?: number;
  tint?: number;
};

const FALLBACK: AssetSpec = { kind: 'emoji', emoji: '❓', color: 0xcccccc };

const REGISTRY: Record<string, AssetSpec> = {
  'yellow-dinosaur': { kind: 'emoji', emoji: '🦖' },
  strawberry: { kind: 'emoji', emoji: '🍓' },
  star: { kind: 'emoji', emoji: '⭐' },
  carrot: { kind: 'emoji', emoji: '🥕' },
  cat: { kind: 'emoji', emoji: '🐱' },
  rabbit: { kind: 'emoji', emoji: '🐰' },
  volcano: { kind: 'color', color: 0xb3541e, tint: 0x7a2e0e },
  meadow: { kind: 'color', color: 0x7ec850, tint: 0x4a9e2f },
  sky: { kind: 'color', color: 0x87ceeb, tint: 0x5bb3d8 },
  space: { kind: 'color', color: 0x1b1b3a, tint: 0x2a2a5a },
};

export function getAsset(id: string): AssetSpec {
  return REGISTRY[id] ?? FALLBACK;
}

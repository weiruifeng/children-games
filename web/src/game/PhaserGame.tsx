import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { createGame } from './runtime/createGame';

export default function PhaserGame({ spec }: { spec: CollectSpec }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    gameRef.current = createGame(parentRef.current, spec);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [spec]);

  return <div ref={parentRef} className="phaser-container" />;
}

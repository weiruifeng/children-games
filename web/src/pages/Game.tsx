import type { CollectSpec } from '@children-games/shared';
import PhaserGame from '../game/PhaserGame';

export default function Game({
  spec,
  onBack,
}: {
  spec: CollectSpec;
  onBack: () => void;
}) {
  return (
    <div className="game-page">
      <PhaserGame spec={spec} />
      <div className="game-overlay">
        <button className="overlay-btn" onClick={onBack}>🏠</button>
        <button className="overlay-btn big">🎤 我要改游戏</button>
      </div>
    </div>
  );
}

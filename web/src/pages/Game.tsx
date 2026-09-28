import { GAMES } from '../game/specs';
import PhaserGame from '../game/PhaserGame';

export default function Game({ id, onBack }: { id: string; onBack: () => void }) {
  const game = GAMES.find((g) => g.id === id);
  if (!game) return <div>找不到游戏</div>;
  return (
    <div className="game-page">
      <PhaserGame spec={game.spec} />
      <div className="game-overlay">
        <button className="overlay-btn" onClick={onBack}>🏠</button>
        <button className="overlay-btn big">🎤 我要改游戏</button>
      </div>
    </div>
  );
}

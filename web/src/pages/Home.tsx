import { GAMES } from '../game/specs';
import { getAsset } from '../game/runtime/assets/proceduralAssets';

export default function Home({
  onPlay,
  onCreate,
}: {
  onPlay: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="home">
      <h1>🎮 我的游戏</h1>
      <div className="game-grid">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPlay(g.id)}>
            <span className="game-emoji">{getAsset(g.spec.player.character).emoji}</span>
            <span className="game-title">{g.spec.title}</span>
          </button>
        ))}
        <button className="game-card create-card" onClick={onCreate}>
          <span className="game-emoji">✨</span>
          <span className="game-title">创造新游戏</span>
        </button>
      </div>
    </div>
  );
}

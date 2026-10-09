import { GAMES } from '../game/specs';
import { UiIcon } from '../ui/UiIcon';

const GAME_ART: Record<string, { image: string; kicker: string; color: string }> = {
  dinosaur: {
    image: '/assets/dinosaur-strawberry/hero-yellow-dinosaur.png',
    kicker: '草莓山谷大冒险',
    color: 'sunny',
  },
  cat: {
    image: '/assets/cat-stars/player-kitten.png',
    kicker: '星星宇宙漫游记',
    color: 'cosmic',
  },
  rabbit: {
    image: '/assets/rabbit-carrot/player-bunny.png',
    kicker: '胡萝卜花园冲刺',
    color: 'meadow',
  },
};

export default function Home({
  onPlay,
  onCreate,
}: {
  onPlay: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="home">
      <div className="home-orb home-orb-one" aria-hidden="true" />
      <div className="home-orb home-orb-two" aria-hidden="true" />
      <header className="home-header">
        <div className="home-brand"><UiIcon name="appGamepad" /> 小小冒险家</div>
        <div className="home-sparkles" aria-hidden="true">✦ ✧ ✦</div>
      </header>
      <main className="home-content">
        <section className="home-intro">
          <span className="home-eyebrow">今天想去哪儿玩？</span>
          <h1 className="home-heading">挑一个世界，<em>出发！</em></h1>
          <p>每一场冒险都藏着好多惊喜和宝贝。</p>
        </section>
        <section className="game-grid" aria-label="游戏列表">
          {GAMES.map((g, index) => {
            const art = GAME_ART[g.id];
            return (
              <button key={g.id} className={`game-card game-card-${art.color}`} onClick={() => onPlay(g.id)}>
                <span className="game-card-count">0{index + 1}</span>
                <span className="game-card-art" aria-hidden="true"><img src={art.image} alt="" /></span>
                <span className="game-card-copy">
                  <span className="game-card-kicker">{art.kicker}</span>
                  <span className="game-title">{g.spec.title}</span>
                </span>
                <span className="game-card-play">开始玩 <b>●</b></span>
              </button>
            );
          })}
          <button className="game-card create-card" onClick={onCreate}>
            <span className="create-stars" aria-hidden="true">✦</span>
            <UiIcon name="magicCreate" className="game-card-icon" />
            <span className="game-card-copy">
              <span className="game-card-kicker">把想象变成游戏</span>
              <span className="game-title">创造新世界</span>
            </span>
            <span className="game-card-play">去创造 <b>●</b></span>
          </button>
        </section>
      </main>
      <footer className="home-footer"><span>收集</span><i /> <span>奔跑</span><i /> <span>发现</span></footer>
    </div>
  );
}

import { SHARED_VERSION } from '@children-games/shared';

export default function App() {
  return (
    <div className="app">
      <h1>🦖 儿童游戏创造</h1>
      <p>骨架已就绪，GameSpec + Phaser Runtime 即将接入。</p>
      <p className="hint">shared 契约版本：{SHARED_VERSION}</p>
    </div>
  );
}

import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import { generateGame } from '../service/game-api';

export default function Create({
  onCreated,
  onBack,
}: {
  onCreated: (spec: CollectSpec) => void;
  onBack: () => void;
}) {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const spec = await generateGame(idea.trim());
      onCreated(spec);
    } catch {
      setError('魔法师走神了，再试一次吧');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="create-page">
        <div className="loading">✨ 魔法师正在变魔术…… 🦖</div>
      </div>
    );
  }

  return (
    <div className="create-page">
      <h1>想玩什么游戏？说给魔法师听</h1>
      <input
        className="idea-input"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="比如：一只黄恐龙在火山吃草莓"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <button className="big-btn" onClick={submit}>✨ 变出来！</button>
      {error && <div className="error">{error}</div>}
      <button className="back-btn" onClick={onBack}>🏠 返回</button>
    </div>
  );
}

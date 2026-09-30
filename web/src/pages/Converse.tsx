import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import { converse } from '../service/game-api';

export default function Converse({
  sessionId: initialSessionId,
  onSpec,
  onBack,
}: {
  sessionId?: string;
  onSpec: (spec: CollectSpec, sessionId: string) => void;
  onBack: () => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');
    try {
      const res = await converse(sessionId, text.trim());
      setSessionId(res.sessionId);
      if (res.result.type === 'spec') {
        onSpec(res.result.spec, res.sessionId);
      } else {
        setQuestion(res.result.question);
        setOptions(res.result.options);
      }
    } catch {
      setError('魔法师走神了，再试一次吧');
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    send(input);
    setInput('');
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
      <h1>{question ? question : '想玩什么游戏？说给魔法师听'}</h1>
      {question && (
        <div className="option-grid">
          {options.map((o) => (
            <button key={o} className="option-btn" onClick={() => send(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      <input
        className="idea-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={question ? '或者自己说' : '比如：一只黄恐龙在火山吃草莓'}
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

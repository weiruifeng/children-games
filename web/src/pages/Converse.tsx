import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import { converseStream } from '../service/game-api';
import { UiIcon } from '../ui/UiIcon';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const IDEA_SPARKS = [
  { emoji: '🦖', text: '恐龙去火山找草莓' },
  { emoji: '🐱', text: '小猫在太空收集星星' },
  { emoji: '🐰', text: '小兔子在花园拔胡萝卜' },
];

export default function Converse({
  sessionId: initialSessionId,
  mode = 'create',
  onSpec,
  onBack,
}: {
  sessionId?: string;
  mode?: 'create' | 'modify';
  onSpec: (spec: CollectSpec, sessionId: string) => void;
  onBack: () => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'received' | 'generating' | 'validating'>('received');
  const [error, setError] = useState('');
  const speech = useSpeechRecognition((text) => setInput(text));

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setLoadingStage('received');
    setError('');
    setQuestion('');
    try {
      let completed = false;
      await converseStream(sessionId, text.trim(), (event) => {
        if (event.type === 'stage') {
          setLoadingStage(event.stage);
        } else if (event.type === 'result') {
          completed = true;
          setSessionId(event.sessionId);
          if (event.result.type === 'spec') onSpec(event.result.spec, event.sessionId);
          else {
            setQuestion(event.result.question);
            setOptions(event.result.options);
          }
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      });
      if (!completed) throw new Error('未收到游戏结果');
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
      <div className="create-page create-loading-page">
        <div className="loading-cloud cloud-one" aria-hidden="true">✦</div>
        <div className="loading-cloud cloud-two" aria-hidden="true">✧</div>
        <main className="loading-story" aria-live="polite">
          <div className="loading-character"><UiIcon name="magicCreate" /><span>✦</span><span>✦</span></div>
          <h1>正在做你的游戏！</h1>
          <p>小魔法师正在努力帮忙</p>
          <div className="loading-steps" aria-label="游戏正在制作中">
            <div className={`loading-step ${loadingStage !== 'received' ? 'done' : 'active'}`}><b>1</b><span>听想法</span></div><i aria-hidden="true" />
            <div className={`loading-step ${loadingStage === 'validating' ? 'done' : loadingStage === 'generating' ? 'active' : ''}`}><b>2</b><span>做游戏</span></div><i aria-hidden="true" />
            <div className={`loading-step ${loadingStage === 'validating' ? 'active' : ''}`}><b>3</b><span>检查好</span></div>
          </div>
          <div className="loading-message"><span>✨</span> 再等一小会儿哦</div>
        </main>
      </div>
    );
  }

  return (
    <div className="create-page">
      <button className="create-back" onClick={onBack} aria-label="回到游戏屋"><UiIcon name="home" /></button>
      <main className="create-workbench">
        <section className="create-hero">
          <h1>
            {question ? '选一个吧！' : mode === 'modify' ? '还想加什么？' : <>你想玩什么？<em>说一说！</em></>}
          </h1>
          {question && <p>{question}</p>}
        </section>

        <section className="create-console" aria-label="游戏创作输入">
          {question ? (
            <div className="option-grid">
              {options.map((o) => (
                <button key={o} className="option-btn" onClick={() => send(o)}>{o}</button>
              ))}
            </div>
          ) : (
            <div className="idea-sparks" aria-label="创意示例">
              {IDEA_SPARKS.map((idea) => (
                <button key={idea.text} className="idea-spark" onClick={() => setInput(idea.text)}><span>{idea.emoji}</span><small>{idea.text}</small></button>
              ))}
            </div>
          )}
          <div className="voice-input">
            <input
              className="idea-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={question ? '也可以自己说' : '点一下上面，或自己说'}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <button
              className={`voice-btn${speech.isListening ? ' listening' : ''}`}
              type="button"
              onClick={speech.isListening ? speech.stop : speech.start}
              disabled={!speech.isSupported}
              aria-label={speech.isListening ? '停止语音输入' : '开始语音输入'}
              aria-pressed={speech.isListening}
            ><UiIcon name="microphone" /><span>说话</span></button>
          </div>
          {speech.isListening && <div className="voice-status">我在听哦！{speech.interimText && ` ${speech.interimText}`}</div>}
          <button className="big-btn" onClick={submit}><UiIcon name="magicCreate" /> 变成游戏！</button>
          {!speech.isSupported && <div className="voice-hint">当前浏览器不支持语音输入，可以直接打字。</div>}
          {speech.error && <div className="voice-hint">{speech.error}</div>}
          {error && <div className="error">{error}</div>}
        </section>
      </main>
    </div>
  );
}

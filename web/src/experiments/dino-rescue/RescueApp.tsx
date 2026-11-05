import { useEffect, useRef, useState } from 'react';
import { DEFAULT_RESCUE_SPEC, RESCUE_EXAMPLE_REQUESTS, validateRescueSpec, type RescueSpec } from '@children-games/shared';
import { createRescueGame, type RescueControls, type RescueProgress } from './game';

const STORAGE_KEY = 'children-games:rescue-pilot:v1';
const INITIAL: RescueProgress = { stage: 'loading', level: 0, berries: 0, availableBerries: 0, retries: 0, checkpoint: 0, message: '' };
type PlayEvent = { at: string; stage: string; level: number; berries: number; retries: number };
type Revision = { spec: RescueSpec; label: string };
type GenerationTrial = { at: string; input: string; status: string; durationMs: number; checks: string[] };

function readSaved(): RescueSpec {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? validateRescueSpec(JSON.parse(raw)) : DEFAULT_RESCUE_SPEC; }
  catch { return DEFAULT_RESCUE_SPEC; }
}

export function RescueApp() {
  const [spec, setSpec] = useState<RescueSpec>(readSaved);
  const [progress, setProgress] = useState<RescueProgress>(INITIAL);
  const [muted, setMuted] = useState(false);
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const parent = useRef<HTMLDivElement>(null);
  const controls = useRef<RescueControls | null>(null);
  const events = useRef<PlayEvent[]>([]);
  const trials = useRef<GenerationTrial[]>([]);
  const abort = useRef<AbortController | null>(null);
  const runId = useRef(0);
  const mutedRef = useRef(muted); mutedRef.current = muted;

  useEffect(() => {
    if (!parent.current) return;
    setProgress(INITIAL);
    const runtime = createRescueGame(parent.current, spec, next => {
      setProgress(next);
      events.current = [...events.current.slice(-199), { at: new Date().toISOString(), stage: next.stage,
        level: next.level + 1, berries: next.berries, retries: next.retries }];
    });
    controls.current = runtime.controls; runtime.controls.mute(mutedRef.current);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(spec)); } catch { /* Playing still works without storage. */ }
    return () => { runtime.destroy(); controls.current = null; };
  }, [spec]);
  useEffect(() => { controls.current?.mute(muted); }, [muted]);
  useEffect(() => () => { abort.current?.abort(); }, []);

  const applyRevision = (next: RescueSpec, label: string) => {
    setRevisions(previous => [...previous.slice(-9), { spec, label }]);
    setSpec(validateRescueSpec(next));
  };
  const modify = async (input = idea) => {
    const request = input.trim(); if (!request || busy) return;
    if (progress.stage === 'playing') controls.current?.pause();
    setIdea(request); setBusy(true); setGenerationMessage('正在准备你的新冒险…');
    const controller = new AbortController(); abort.current = controller;
    const id = ++runId.current; const start = performance.now();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/rescue/modify', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: request, spec }), signal: controller.signal });
      if (!response.ok) throw new Error('request failed');
      const result: { status: string; spec: unknown; message: string; checks?: string[] } = await response.json();
      if (id !== runId.current) return;
      if (result.status === 'generated') {
        applyRevision(validateRescueSpec(result.spec), request);
        setGenerationMessage(`新冒险准备好了！用了 ${Math.round((performance.now() - start) / 1000)} 秒。`);
      } else setGenerationMessage(result.message || '原来的冒险还在，试试换个想法。');
      trials.current = [...trials.current.slice(-49), { at: new Date().toISOString(), input: request, status: result.status,
        durationMs: Math.round(performance.now() - start), checks: result.checks ?? [] }];
    } catch {
      if (id === runId.current) {
        setGenerationMessage('暂时没能准备好新冒险。原来的游戏还在，可以继续玩。');
        trials.current = [...trials.current.slice(-49), { at: new Date().toISOString(), input: request, status: 'error',
          durationMs: Math.round(performance.now() - start), checks: [] }];
      }
    } finally {
      window.clearTimeout(timeout);
      if (id === runId.current) setBusy(false);
    }
  };

  const previewDoubleJump = () => {
    applyRevision({ ...spec, doubleJump: !spec.doubleJump }, '试玩二段跳');
    setGenerationMessage(spec.doubleJump ? '恢复普通跳跃。这是预设试玩变化。' : '二段跳已开启。这是预设试玩变化。');
  };
  const reset = () => {
    applyRevision(DEFAULT_RESCUE_SPEC, '恢复样板'); setGenerationMessage('已回到最初的三关冒险。');
  };
  const undo = () => {
    const previous = revisions[revisions.length - 1]; if (!previous) return;
    setSpec(previous.spec); setRevisions(revisions.slice(0, -1)); setGenerationMessage('已回到上一个冒险。');
  };
  const exportSession = () => {
    const data = { exportedAt: new Date().toISOString(), spec, events: events.current, generationTrials: trials.current,
      note: '自动检查不能证明儿童觉得好玩；请另外记录年龄、是否理解操作、是否主动重玩。' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'dino-rescue-play-session.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const overlay = ['ready', 'paused', 'level-complete', 'complete', 'error'].includes(progress.stage);
  const complete = progress.stage === 'complete';

  return (
    <div className="rescue-app">
      <header className="rescue-header">
        <a className="rescue-brand" href="/"><span className="brand-mark">✦</span> 小小冒险家 <span className="lab-label">冒险实验室</span></a>
        <div className="rescue-header-actions">
          <button onClick={() => setMuted(!muted)} aria-label={muted ? '开启声音' : '关闭声音'}>{muted ? '声音已关' : '声音已开'}</button>
          <a href="/">回到我的游戏 ↗</a>
        </div>
      </header>
      <main className="rescue-main">
        <section className="rescue-intro">
          <div><p className="rescue-eyebrow">一个小小勇敢的故事</p><h1>{spec.title}<span>一起出发吧。</span></h1>
          <p className="rescue-description">跨过小河，穿过山洞。你的朋友正在等你！</p></div>
          <div className="adventure-ticket"><span>今天的任务</span><strong>找到你的{spec.friend === 'rabbit' ? '兔子' : '小猫'}朋友</strong><small>3 个小关卡 · 点击就能跳</small></div>
        </section>
        <div className="rescue-layout">
          <section className="rescue-play-section" aria-label="小恐龙救朋友游戏">
            <div className="rescue-trail" aria-label="冒险进度">
              {spec.levels.map((level, index) => <div key={index} className={`trail-stop ${progress.level === index ? 'current' : ''} ${progress.level > index || complete ? 'done' : ''}`}><span>{progress.level > index || complete ? '✓' : `0${index + 1}`}</span><strong>{level.title}</strong></div>)}
            </div>
            <div className="rescue-game-frame">
              <div ref={parent} className="rescue-canvas" />
              <div className="rescue-hud"><span><img src="/assets/dinosaur-strawberry/collectible-strawberry.png" alt="草莓" />{progress.berries}<small>/ {progress.availableBerries}</small></span><span>小旗子 {progress.checkpoint} / {spec.levels[progress.level].checkpoints.length}</span></div>
              {progress.stage === 'retrying' && <div className="retry-toast" role="status">没关系！从小旗子继续。</div>}
              {overlay && <div className="rescue-overlay"><div className="rescue-overlay-card">
                <span className="overlay-kicker">{complete ? '任务完成' : progress.stage === 'level-complete' ? '又前进了一步' : progress.stage === 'paused' ? '慢慢来，不着急' : '准备好了吗？'}</span>
                <img src={complete ? ASSET_FRIEND(spec.friend) : '/assets/dinosaur-strawberry/hero-yellow-dinosaur.png'} alt="" />
                <h2>{complete ? '朋友，我们回家！' : progress.stage === 'level-complete' ? '你做到了！' : progress.stage === 'paused' ? '冒险暂停了' : progress.stage === 'error' ? '图片还没准备好' : spec.levels[progress.level].title}</h2>
                <p>{progress.message}</p>
                {progress.stage === 'ready' && <button className="primary-button" onClick={() => controls.current?.start()}>出发，去找朋友 →</button>}
                {progress.stage === 'paused' && <button className="primary-button" onClick={() => controls.current?.start()}>继续冒险 →</button>}
                {(complete || progress.stage === 'level-complete') && <button className="primary-button" onClick={() => controls.current?.next()}>{complete ? '再去冒险一次 ↻' : '去下一站 →'}</button>}
                {progress.stage === 'error' && <button className="primary-button" onClick={() => location.reload()}>重新准备</button>}
                {progress.stage === 'ready' && <small>{spec.doubleJump ? '空中再点一次，还能跳一次！' : '点屏幕或下方按钮跳跃；电脑也可按空格。'}</small>}
              </div></div>}
            </div>
            <div className="rescue-control-bar">
              <div><strong>{spec.doubleJump ? '点两次，跳得更远' : '点一下，跳起来'}</strong><span>草莓是奖励。小旗子会记住你的进度。</span></div>
              <button className="jump-button" disabled={progress.stage !== 'playing'} onPointerDown={event => { event.preventDefault(); controls.current?.jump(); }} onKeyDown={event => { if (event.key === 'Enter') controls.current?.jump(); }}>跳一下 ↑</button>
              <button className="quiet-button" disabled={!['playing', 'paused'].includes(progress.stage)} onClick={() => controls.current?.pause()}>{progress.stage === 'paused' ? '继续' : '暂停'}</button>
            </div>
            <div className="rescue-footnote"><span>不扣生命 · 失败后就近重试</span><button disabled={busy || progress.stage === 'loading'} onClick={() => controls.current?.restart()}>重玩这一关</button></div>
          </section>
          <aside className="rescue-imagination">
            <span className="imagination-icon">✧</span><p className="rescue-eyebrow">你的想象，下一场冒险</p>
            <h2>想给冒险<br />加一点什么？</h2><p>让恐龙跳两次，或给小河加一座桥。</p>
            <form onSubmit={event => { event.preventDefault(); void modify(); }}>
              <label htmlFor="rescue-idea">告诉我你的想法</label>
              <textarea id="rescue-idea" maxLength={500} value={idea} onChange={event => setIdea(event.target.value)} placeholder="我想让恐龙能跳两次…" disabled={busy} />
              <button className="primary-button" disabled={busy || !idea.trim()}>{busy ? '正在准备冒险…' : '把想法变成冒险 ✦'}</button>
            </form>
            <div className="rescue-suggestions">{RESCUE_EXAMPLE_REQUESTS.slice(0, 4).map(request => <button key={request} disabled={busy} onClick={() => void modify(request)}>{request} ↗</button>)}</div>
            <p className="generation-message" role="status">{generationMessage || '每次变化都可以回到上一版。'}</p>
            <button className="preview-button" disabled={busy} onClick={previewDoubleJump}>{spec.doubleJump ? '试玩普通跳跃' : '先试玩二段跳'}<small>预设变化 · 不需要等待</small></button>
            <div className="revision-actions"><button disabled={busy || !revisions.length} onClick={undo}>回到上一版</button><button disabled={busy} onClick={reset}>恢复样板</button></div>
          </aside>
        </div>
        <details className="rescue-parent-notes"><summary>给家长：一起观察这场冒险</summary><p>先让孩子自己尝试。记录是否理解操作、哪里容易卡住，以及是否主动想再玩。玩法变化需要启动后端并配置模型；预设二段跳可以直接试玩。</p><p>本关就近重试 {progress.retries} 次。记录仅保存在本次页面内，不上传。</p><button onClick={exportSession}>下载本次试玩记录</button></details>
      </main>
      <footer className="rescue-footer">一点勇气，一点想象，一场属于你的冒险。<span>小小冒险家 / 01</span></footer>
    </div>
  );
}
function ASSET_FRIEND(friend: RescueSpec['friend']) {
  return friend === 'rabbit' ? '/assets/rabbit-carrot/player-bunny.png' : '/assets/cat-stars/player-kitten.png';
}

import type { CollectSpec } from '@children-games/shared';
import { useState } from 'react';
import PhaserGame from '../game/PhaserGame';
import { UiIcon } from '../ui/UiIcon';
import { listGameVersions, type GameVersionSummary } from '../service/game-api';

export default function Game({
  spec,
  sessionId,
  gameId,
  onBack,
  onModify,
  onSave,
  onRestore,
}: {
  spec: CollectSpec;
  sessionId?: string;
  gameId?: string;
  onBack: () => void;
  onModify: (sessionId: string) => void;
  onSave: () => Promise<void>;
  onRestore: (versionId: string) => Promise<void>;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const save = async () => {
    setSaveState('saving');
    try { await onSave(); setSaveState('saved'); }
    catch { setSaveState('error'); }
  };
  const [versions, setVersions] = useState<GameVersionSummary[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const showVersions = async () => {
    if (!gameId) return;
    try { setHistoryError(false); setVersions(await listGameVersions(gameId)); } catch { setHistoryError(true); }
  };
  return (
    <div className="game-page">
      <PhaserGame spec={spec} />
      <div className="game-overlay">
        <button className="overlay-btn icon-btn" onClick={onBack} aria-label="返回我的游戏">
          <UiIcon name="home" />
        </button>
        {sessionId && (
          <button className="overlay-btn big" onClick={() => onModify(sessionId)}>
            <UiIcon name="microphone" />我要改游戏
          </button>
        )}
        <button className="overlay-btn save-btn" onClick={() => void save()} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : saveState === 'error' ? '保存失败，再试一次' : '保存我的游戏'}
        </button>
        {gameId && <button className="overlay-btn history-btn" onClick={() => void showVersions()}>版本</button>}
      </div>
      {versions && <div className="version-panel"><button className="version-close" onClick={() => setVersions(null)}>×</button><h2>我的版本</h2>{versions.map((version) => <button key={version.versionId} className="version-item" onClick={() => void onRestore(version.versionId).then(() => setVersions(null))}>第 {version.versionNumber} 版 <small>{new Date(version.createdAt).toLocaleString()}</small></button>)}</div>}
      {historyError && <div className="version-panel">版本记录暂时打不开</div>}
    </div>
  );
}

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { resources } from './manager';
import { activateAndReload } from './lifecycle';
import type { Progress } from './types';
import './resources.css';
export function ResourceSettings({
  inBattle = false,
  beforeUpdate,
}: {
  inBattle?: boolean;
  beforeUpdate?: () => Promise<void>;
}) {
  useSyncExternalStore(resources.subscribe, resources.snapshot);
  const state = resources.status();
  const [usage, setUsage] = useState({ bytes: 0, count: 0, total: 0 }),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const updateController = useRef<AbortController>();
  const [updateProgress, setUpdateProgress] = useState<Progress | null>(null);
  useEffect(() => () => updateController.current?.abort(), []);
  const inspect = () =>
    void resources
      .inspect()
      .then(setUsage)
      .catch(() => {});
  useEffect(inspect, [state.busy]);
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
      inspect();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '暂时未完成，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="resource-settings" aria-label="游戏素材与更新">
      <h3>游戏素材与更新</h3>
      <p>
        当前版本 {state.releaseId.slice(0, 8)} · 已缓存 {usage.count}/{usage.total} 份素材 ·{' '}
        {(usage.bytes / 1024 ** 2).toFixed(1)} MiB
      </p>
      <p>
        {state.persistence === 'stored'
          ? '图片与读音会保存在这个浏览器，下次优先复用。'
          : '本次可以玩，本地缓存暂不可用，下次可能需要重新下载。'}{' '}
        缓存素材不等于离线登录，刷新后仍需验证账号。
      </p>
      <div className="resource-actions">
        <button
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await resources.checkUpdate(true);
              setMessage(
                resources.status().newer
                  ? '发现新版本，准备好后可以重新打开。'
                  : '已检查，目前是最新版本。',
              );
            })
          }
        >
          检查更新
        </button>
        <button
          disabled={busy || inBattle}
          onClick={() =>
            state.busy ? resources.pausePrefetch() : void resources.prefetchAll(true)
          }
        >
          {state.busy ? '暂停下载' : '缓存全部游戏素材'}
        </button>
        <button
          disabled={busy || inBattle}
          onClick={() =>
            void act(async () => {
              const kept = await resources.clear();
              setMessage(
                kept
                  ? `已清理未使用素材，保留 ${kept} 份页面使用中的素材。存档未删除。`
                  : '素材缓存已清理，存档未删除。',
              );
            })
          }
        >
          清理素材缓存
        </button>
      </div>
      {inBattle && <p>请先回花园，再下载全部素材、清理缓存或更新。</p>}
      {state.prefetch.total > 0 && (
        <div>
          <p className={state.prefetch.phase === 'ready' ? 'resource-complete' : ''}>
            {state.prefetch.phase === 'ready'
              ? '✓ 素材已缓存'
              : state.busy
                ? '正在缓存'
                : '缓存已暂停'}{' '}
            · {state.prefetch.completed}/{state.prefetch.total}
          </p>
          <progress
            max={state.prefetch.total}
            value={state.prefetch.completed}
            aria-label="全部素材缓存进度"
          />
          {state.prefetch.error && <p>{state.prefetch.error}</p>}
        </div>
      )}
      {state.newer && (
        <div className="resource-update-note">
          <p>花园有更新，保存进度后重新打开即可使用。</p>
          <button
            disabled={busy || inBattle}
            onClick={() =>
              void act(async () => {
                if (!beforeUpdate) {
                  setMessage('请返回游戏设置，保存进度后更新。');
                  return;
                }
                const controller = new AbortController();
                updateController.current = controller;
                await resources.stageUpdate((p) => setUpdateProgress(p), controller.signal);
                if (controller.signal.aborted) return;
                await beforeUpdate();
                if (controller.signal.aborted) return;
                await activateAndReload();
              })
            }
          >
            保存并更新花园
          </button>
        </div>
      )}
      {updateProgress && (
        <div>
          <p role="status">
            正在准备更新 · {updateProgress.completed}/{updateProgress.total}
          </p>
          <progress
            max={Math.max(1, updateProgress.total)}
            value={updateProgress.completed}
            aria-label="更新素材进度"
          />
        </div>
      )}
      <button
        disabled={busy}
        onClick={() => {
          const url = URL.createObjectURL(
              new Blob([JSON.stringify(resources.diagnostics(), null, 2)], {
                type: 'application/json',
              }),
            ),
            a = document.createElement('a');
          a.href = url;
          a.download = 'garden-resource-diagnostics.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        导出素材诊断
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function ResourceUpdateHint({ onOpen }: { onOpen: () => void }) {
  useSyncExternalStore(resources.subscribe, resources.snapshot);
  if (!resources.status().newer) return null;
  return (
    <button className="resource-update-hint" onClick={onOpen}>
      花园有更新 · 查看
    </button>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Progress } from './types';
import './resources.css';

// A short cache read should not paint a loading card. Continue an already visible
// HTML boot screen immediately so a genuinely slow start has no blank interval.
function bootVisible() {
  if (typeof document === 'undefined') return false;
  const boot = document.getElementById('app-boot');
  return !!boot && getComputedStyle(boot).visibility === 'visible';
}
export function ResourceLoader({
  progress,
  onRetry,
  onBack,
  children,
  title = '正在准备小花园',
  message,
  overlay = false,
  delayMs = 200,
}: {
  progress: Progress;
  onRetry: () => void;
  onBack?: () => void;
  children?: ReactNode;
  title?: string;
  message?: string;
  overlay?: boolean;
  delayMs?: number;
}) {
  const [shown, setShown] = useState(bootVisible),
    [slow, setSlow] = useState(false);
  const failed = progress.phase === 'failed',
    scene = progress.phase === 'preparing-scene',
    visible = shown || failed;
  const ref = useRef<HTMLDivElement>(null),
    started = useRef(performance.now());
  useEffect(() => {
    const remaining = Math.max(0, delayMs - (performance.now() - started.current));
    const timer = setTimeout(() => setShown(true), remaining);
    return () => clearTimeout(timer);
  }, [delayMs]);
  useEffect(() => {
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [progress.completed, progress.phase]);
  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible]);
  useEffect(() => {
    const root = ref.current;
    const keyDown = (event: KeyboardEvent) => {
      if (!overlay) return;
      if (event.key === 'Escape' && onBack) {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [],
        ),
        first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root?.addEventListener('keydown', keyDown);
    return () => root?.removeEventListener('keydown', keyDown);
  }, [overlay, onBack]);
  const total = Math.max(1, progress.total),
    value = Math.min(total, Math.max(0, progress.completed));
  return (
    <div
      className={`resource-loading-screen ${overlay ? 'resource-overlay' : ''}`}
      data-presentation={visible ? 'shown' : 'pending'}
      aria-hidden={!visible}
    >
      <div
        className={`resource-loader ${failed ? 'resource-failed' : ''}`}
        tabIndex={-1}
        ref={ref}
        role="dialog"
        aria-modal={overlay ? true : undefined}
        aria-label={title}
        aria-busy={!failed}
      >
        <div className="resource-sprout" aria-hidden="true">
          <svg viewBox="0 0 64 56">
            <path
              d="M32 49V26"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M31 32C12 33 9 21 10 11c14 0 24 6 21 21Zm2-8C32 10 41 4 54 5c0 13-7 20-21 19Z"
              fill="#91b374"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h2>{failed ? '花园还没准备好' : title}</h2>
        <p role={failed ? 'alert' : 'status'}>
          {failed
            ? (progress.error ?? '有些素材暂时打不开')
            : (message ??
              (scene ? '正在铺好小路…' : `伙伴正在集合 · ${progress.completed}/${progress.total}`))}
        </p>
        <div
          className="resource-track"
          role="progressbar"
          aria-label="素材准备进度"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={value}
        >
          <span style={{ width: `${(value / total) * 100}%` }} />
        </div>
        <p className="resource-note">
          {failed
            ? '进度没有开始，可以重试或返回。'
            : slow
              ? '准备时间有些长，已完成的素材会保留，可以重试或返回。'
              : '准备好图片和小路后，再一起出发。'}
        </p>
        <div className="resource-actions">
          {(failed || slow) && (
            <button className="primary" onClick={onRetry}>
              重新准备
            </button>
          )}
          {onBack && <button onClick={onBack}>回花园</button>}
          {children}
        </div>
      </div>
    </div>
  );
}

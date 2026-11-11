import { useEffect, useState } from 'react';
import { resources } from './manager';
import type { Progress } from './types';
export function useResources(ids: string[], key: string, retry = 0) {
  const [value, setValue] = useState<{ key: string; retry: number; progress: Progress }>({
    key: '',
    retry: -1,
    progress: { completed: 0, total: ids.length, phase: 'loading' },
  });
  useEffect(() => {
    const started = performance.now(),
      controller = new AbortController();
    let release: (() => void) | undefined;
    let latest: Progress = { completed: 0, total: ids.length, phase: 'loading' };
    resources.pausePrefetch();
    resources.boot();
    setValue({ key, retry, progress: { completed: 0, total: ids.length, phase: 'loading' } });
    void resources
      .prepare(ids, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) {
            latest = progress;
            setValue({ key, retry, progress });
          }
        },
      })
      .then(
        (fn) => {
          if (controller.signal.aborted) {
            fn();
            return;
          }
          release = fn;
          resources.diagnostic('group-ready', { ms: Math.round(performance.now() - started) });
          setValue({
            key,
            retry,
            progress: { ...latest, completed: latest.total, phase: 'ready' },
          });
        },
        (e) => {
          if (!controller.signal.aborted) {
            resources.diagnostic('group-failed', {
              ms: Math.round(performance.now() - started),
              error: e instanceof Error ? e.message : '素材失败',
            });
            setValue({
              key,
              retry,
              progress: {
                ...latest,
                phase: 'failed',
                error: e instanceof Error ? e.message : '素材还没准备好',
              },
            });
          }
        },
      );
    return () => {
      controller.abort();
      release?.();
    };
    // key owns the immutable dependency snapshot; retries rebuild the same snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  return value.key === key && value.retry === retry
    ? value.progress
    : ({ completed: 0, total: ids.length, phase: 'loading' } as Progress);
}

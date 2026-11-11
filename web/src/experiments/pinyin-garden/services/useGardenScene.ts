import { useEffect, useRef, type RefObject } from 'react';
import { resources } from '../../../resources/manager';
import { createGardenGame, type GardenBridge } from '../game/createGame';
import type { GardenSession } from './gardenSession';

interface SceneOptions {
  enabled: boolean;
  identity: string;
  parent: RefObject<HTMLDivElement>;
  session: GardenSession;
  bridge: Omit<GardenBridge, 'state' | 'ready' | 'assetError'>;
  reduced: () => boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onStop: () => void;
}

/** One Phaser scene per resource/session identity, with stale completion fencing. */
export function useGardenScene(options: SceneOptions) {
  const { enabled, identity, parent, session } = options;
  const events = useRef(options);
  events.current = options;
  useEffect(() => {
    if (!enabled || !parent.current) return;
    const token = session.capture(),
      state = session.state.current,
      started = performance.now();
    let alive = true,
      ready = false,
      waitMs = 0;
    const current = () => alive && session.isCurrent(token);
    const timer = setInterval(() => {
      if (!current() || ready || document.hidden) return;
      waitMs += 250;
      if (waitMs >= 10000) {
        events.current.onError('画板还没准备好，请重新准备。');
        clearInterval(timer);
      }
    }, 250);
    const game = createGardenGame(
      parent.current,
      {
        ...events.current.bridge,
        state: () => (current() ? session.state.current : state),
        freeze: () => !current() || !!events.current.bridge.freeze?.(),
        inputBlocked: () => !current() || !!events.current.bridge.inputBlocked?.(),
        change: () => {
          if (current()) events.current.bridge.change();
        },
        ready: () => {
          if (!current()) return;
          ready = true;
          clearInterval(timer);
          resources.diagnostic('scene-first-render', {
            ms: Math.round(performance.now() - started),
          });
          events.current.onReady();
        },
        assetError: (message) => {
          if (current()) events.current.onError(message);
        },
      },
      () => events.current.reduced(),
    );
    return () => {
      alive = false;
      clearInterval(timer);
      events.current.onStop();
      game.destroy(true);
    };
  }, [enabled, identity, parent, session]);
}

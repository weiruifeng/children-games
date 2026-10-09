import type { CollectSpec } from '@children-games/shared';
import PhaserGame from '../game/PhaserGame';
import { UiIcon } from '../ui/UiIcon';

export default function Game({
  spec,
  sessionId,
  onBack,
  onModify,
}: {
  spec: CollectSpec;
  sessionId?: string;
  onBack: () => void;
  onModify: (sessionId: string) => void;
}) {
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
      </div>
    </div>
  );
}

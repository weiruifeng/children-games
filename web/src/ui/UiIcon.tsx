export const UI_ASSETS = {
  appGamepad: '/assets/ui-kit/icons/app-gamepad.png',
  home: '/assets/ui-kit/icons/home.png',
  microphone: '/assets/ui-kit/icons/microphone.png',
  magicCreate: '/assets/ui-kit/icons/magic-create.png',
  lifeHeart: '/assets/ui-kit/icons/life-heart.png',
  victoryMedal: '/assets/ui-kit/icons/victory-medal.png',
  restart: '/assets/ui-kit/icons/restart.png',
  scorePanel: '/assets/ui-kit/hud-score-panel.png',
  lifeBadge: '/assets/ui-kit/hud-life-badge.png',
  victoryPanel: '/assets/ui-kit/victory-modal-panel.png',
  victorySparkles: '/assets/ui-kit/victory-sparkles.png',
  restartButton: '/assets/ui-kit/restart-button-panel.png',
} as const;

export type UiAssetName = keyof typeof UI_ASSETS;

export function UiIcon({ name, alt = '', className = '' }: { name: UiAssetName; alt?: string; className?: string }) {
  return <img className={`ui-icon ${className}`.trim()} src={UI_ASSETS[name]} alt={alt} />;
}

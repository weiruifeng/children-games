import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { CollectScene } from './scenes/CollectScene';
import { WORLD } from './world';

export function createGame(parent: HTMLElement, spec: CollectSpec): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CollectScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('spec', spec);
      },
    },
  });
}

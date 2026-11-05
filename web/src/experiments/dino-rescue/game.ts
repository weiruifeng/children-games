/// <reference types="vite/client" />
import Phaser from 'phaser';
import { RESCUE_PHYSICS as P, type RescueSpec } from '@children-games/shared';
import { PlatformerMovement } from './opengame/PlatformerMovement';

export type RescueStage = 'loading' | 'ready' | 'playing' | 'paused' | 'retrying' | 'level-complete' | 'complete' | 'error';
export type RescueProgress = {
  stage: RescueStage; level: number; berries: number; availableBerries: number;
  retries: number; checkpoint: number; message: string;
};
export type RescueControls = {
  start: () => void; jump: () => void; pause: () => void;
  restart: () => void; next: () => void; mute: (muted: boolean) => void;
};

const ASSETS = {
  valley: '/assets/dinosaur-strawberry/background-valley.png',
  dinosaur: '/assets/dinosaur-strawberry/hero-yellow-dinosaur.png',
  berry: '/assets/dinosaur-strawberry/collectible-strawberry.png',
  rabbit: '/assets/rabbit-carrot/player-bunny.png',
  cat: '/assets/cat-stars/player-kitten.png',
};

// Useful for browser diagnostics; no controls bypass gameplay validation.
let currentGame: Phaser.Game | null = null;
export function getRunningRescueGame() { return currentGame; }

export function createRescueGame(parent: HTMLElement, spec: RescueSpec, onProgress: (progress: RescueProgress) => void) {
  let audio: AudioContext | undefined;
  let muted = false;
  function tone(frequency: number, duration = 0.12, delay = 0) {
    if (muted) return;
    try {
      audio ??= new AudioContext();
      void audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      const start = audio.currentTime + delay;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(start); oscillator.stop(start + duration);
    } catch { /* Silent fallback on browsers without Web Audio. */ }
  }

  class Preloader extends Phaser.Scene {
    constructor() { super('RescuePreloader'); }
    preload() {
      const label = this.add.text(P.width / 2, P.height / 2, '正在准备小恐龙的冒险…', { fontFamily: 'sans-serif', fontSize: '24px', color: '#466951' }).setOrigin(0.5);
      this.load.on('progress', (value: number) => label.setText(`准备冒险 ${Math.round(value * 100)}%`));
      const failures: string[] = [];
      this.load.on('loaderror', (file: Phaser.Loader.File) => failures.push(file.key));
      Object.entries(ASSETS).forEach(([key, url]) => this.load.image(key, url));
      this.load.once('complete', () => {
        if (failures.length) onProgress({ stage: 'error', level: 0, berries: 0, availableBerries: 0, retries: 0, checkpoint: 0, message: '冒险图片没有加载好，请刷新再试。' });
      });
      this.registry.set('assetFailures', failures);
    }
    create() {
      if ((this.registry.get('assetFailures') as string[]).length) return;
      this.scene.start('RescueScene', { level: 0, autoStart: false });
    }
  }

  class RescueScene extends Phaser.Scene {
    public stage: RescueStage = 'ready';
    public levelIndex = 0;
    public player!: Phaser.Physics.Arcade.Sprite;
    public movement!: PlatformerMovement;
    public retries = 0;
    private collected = new Set<number>();
    private checkpointX = 128;
    private checkpointCount = 0;
    private bridgeBodies: Phaser.Physics.Arcade.Image[] = [];
    private nextCheckpoint = 0;
    private lastTime = 0;
    private stepSoundAt = 0;
    private friendSprite!: Phaser.GameObjects.Image;
    constructor() { super('RescueScene'); }

    create(data: { level?: number; autoStart?: boolean }) {
      this.levelIndex = data.level ?? 0;
      this.stage = 'ready'; this.retries = 0; this.collected = new Set(); this.checkpointX = 128;
      this.checkpointCount = 0; this.nextCheckpoint = 0; this.bridgeBodies = []; this.lastTime = 0;
      const level = spec.levels[this.levelIndex];
      const worldWidth = P.columns * P.tile;
      this.physics.world.setBounds(0, -300, worldWidth, P.height + 300);
      this.cameras.main.setBounds(0, 0, worldWidth, P.height);
      this.add.image(P.width / 2, P.height / 2, 'valley').setDisplaySize(P.width, P.height).setScrollFactor(0).setAlpha(level.theme === 'cave' ? 0.35 : 0.72);
      this.add.rectangle(P.width / 2, P.height / 2, P.width, P.height, level.theme === 'cave' ? 0x243d56 : 0xe6f5d6, level.theme === 'cave' ? 0.38 : 0.12).setScrollFactor(0);
      // Soft distant hills add depth while keeping gameplay silhouettes clear.
      for (let x = 0; x < worldWidth; x += 340) {
        this.add.ellipse(x + 170, 435, 470, 190, level.theme === 'cave' ? 0x416174 : 0x7fba8a, 0.45).setScrollFactor(0.32);
      }
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xb88b5c).fillRect(0, 0, 64, 128);
      graphics.fillStyle(0x745f4c, 0.24).fillRoundedRect(6, 28, 22, 12, 5).fillRoundedRect(36, 58, 18, 10, 4);
      graphics.fillStyle(level.theme === 'cave' ? 0x779b94 : 0x66a56b).fillRoundedRect(0, 0, 64, 18, 5);
      graphics.generateTexture(`rescue-ground-${this.levelIndex}`, 64, 128); graphics.clear();
      graphics.fillStyle(0xbd8756).fillRoundedRect(0, 0, 148, 22, 5);
      graphics.lineStyle(2, 0x81532f); for (let x = 12; x < 148; x += 22) graphics.lineBetween(x, 2, x, 20);
      if (!this.textures.exists('rescue-bridge')) graphics.generateTexture('rescue-bridge', 148, 22);
      graphics.destroy();
      const ground = this.physics.add.staticGroup();
      for (let column = 0; column < P.columns; column++) {
        if (level.gaps.some(gap => column >= gap.start && column < gap.start + gap.width)) continue;
        ground.create(column * P.tile + 32, P.floorY + 64, `rescue-ground-${this.levelIndex}`);
      }
      this.add.rectangle(worldWidth / 2, 566, worldWidth, 18, level.theme === 'river' ? 0x74bfd1 : 0x426b85, 0.8);
      const bridges = this.physics.add.group({ allowGravity: false, immovable: true });
      level.gaps.filter(gap => gap.bridge).forEach(gap => {
        const bridge = bridges.create((gap.start + gap.width / 2) * P.tile, P.floorY + 8, 'rescue-bridge') as Phaser.Physics.Arcade.Image;
        bridge.setDisplaySize(gap.width * P.tile + 30, 22);
        const body = bridge.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false); body.setImmovable(true);
        this.bridgeBodies.push(bridge);
      });
      this.player = this.physics.add.sprite(128, P.floorY - 43, 'dinosaur').setDisplaySize(80, 80).setDepth(5);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setSize(this.player.width * 0.45, this.player.height * 0.64);
      body.setOffset(this.player.width * 0.275, this.player.height * 0.30);
      this.movement = new PlatformerMovement({ walkSpeed: P.speed, jumpPower: P.jumpPower, airControl: 1,
        coyoteTime: P.coyoteMs, jumpBufferTime: P.bufferMs, maxFallSpeed: 900, doubleJumpEnabled: spec.doubleJump });
      this.movement.attach(this.player);
      this.physics.add.collider(this.player, ground);
      this.physics.add.collider(this.player, bridges);
      const berries = this.physics.add.staticGroup();
      level.berries.forEach(column => {
        const overGap = level.gaps.some(gap => column >= gap.start - 1 && column <= gap.start + gap.width);
        const berry = berries.create(column * P.tile + 32, P.floorY - (overGap ? 110 : 58), 'berry') as Phaser.Physics.Arcade.Image;
        berry.setDisplaySize(34, 38).refreshBody().setData('column', column).setDepth(6);
        this.tweens.add({ targets: berry, angle: { from: -7, to: 7 }, duration: 700, yoyo: true, repeat: -1 });
      });
      this.physics.add.overlap(this.player, berries, (_player, object) => {
        if (this.stage !== 'playing') return;
        const berry = object as Phaser.Physics.Arcade.Image;
        const column = berry.getData('column') as number;
        if (this.collected.has(column)) return;
        this.collected.add(column); berry.disableBody(true, true); tone(740); tone(990, 0.10, 0.08);
        this.sparkle(berry.x, berry.y, 0xffd56d); this.publish('捡到草莓啦！');
      });
      [...level.checkpoints].sort((a, b) => a - b).forEach((column, index) => {
        const x = column * P.tile + 32;
        this.add.rectangle(x, P.floorY - 28, 4, 56, 0xf7f4db);
        this.add.triangle(x + 13, P.floorY - 49, 0, 0, 26, 10, 0, 20, 0xf5b968).setData('checkpoint', index);
      });
      const goalX = (P.columns - 3) * P.tile;
      this.add.ellipse(goalX + 15, P.floorY - 72, 190, 165, level.theme === 'cave' ? 0x526d7a : 0x85b885);
      this.add.ellipse(goalX + 15, P.floorY - 56, 119, 132, 0x344b4f);
      this.add.text(goalX + 15, P.floorY - 133, this.levelIndex === 2 ? '朋友在这里！' : '去下一站', { fontSize: '19px', color: '#fff6d8', fontFamily: 'sans-serif' }).setOrigin(0.5);
      this.friendSprite = this.add.image(goalX + 30, P.floorY - 37, spec.friend).setDisplaySize(66, 70).setDepth(4);
      this.friendSprite.setVisible(this.levelIndex === 2);
      this.tweens.add({ targets: this.friendSprite, y: '-=8', duration: 650, repeat: -1, yoyo: true });
      this.cameras.main.startFollow(this.player, true, 0.075, 0.075, -160, 0);
      this.cameras.main.setDeadzone(60, 120);
      const jump = () => this.jump();
      const keyJump = () => {
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
        this.jump();
      };
      this.input.on('pointerdown', jump);
      this.input.keyboard?.on('keydown-SPACE', keyJump);
      this.input.keyboard?.on('keydown-ARROWUP', keyJump);
      const onBlur = () => { if (this.stage === 'playing') this.pauseAdventure(); };
      window.addEventListener('blur', onBlur);
      const onVisibility = () => { if (document.hidden) onBlur(); };
      document.addEventListener('visibilitychange', onVisibility);
      this.events.once('shutdown', () => {
        this.input.off('pointerdown', jump); this.input.keyboard?.off('keydown-SPACE', keyJump);
        this.input.keyboard?.off('keydown-ARROWUP', keyJump); window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility); this.movement.detach();
        this.textures.remove(`rescue-ground-${this.levelIndex}`);
      });
      this.physics.world.pause();
      this.publish(this.levelIndex === 0 ? '点一下，就能跳起来。草莓是奖励，找到朋友才是目标。' : '新的一站！点屏幕跳跃，旗子会记住你的进度。');
      if (data.autoStart) this.startAdventure();
    }

    private publish(message = '') {
      onProgress({ stage: this.stage, level: this.levelIndex, berries: this.collected.size,
        availableBerries: spec.levels[this.levelIndex].berries.length, retries: this.retries,
        checkpoint: this.checkpointCount, message });
      this.registry.set('rescue-progress', { stage: this.stage, level: this.levelIndex, retries: this.retries, berries: this.collected.size });
    }
    startAdventure() {
      if (this.stage !== 'ready' && this.stage !== 'paused') return;
      this.stage = 'playing'; this.physics.world.resume(); tone(440, 0.08); this.publish();
    }
    jump() {
      if (this.stage !== 'playing') return;
      if (this.movement.jump()) {
        tone(420, 0.08); this.sparkle(this.player.x, this.player.y + 28, 0xffefb6);
      }
    }
    pauseAdventure() {
      if (this.stage === 'paused') return this.startAdventure();
      if (this.stage !== 'playing') return;
      this.stage = 'paused'; this.physics.world.pause(); this.publish('休息一下，准备好了再继续。');
    }
    restartAdventure() { this.scene.restart({ level: this.levelIndex, autoStart: false }); }
    nextLevel() {
      if (this.stage === 'complete') this.scene.restart({ level: 0, autoStart: false });
      else if (this.stage === 'level-complete') this.scene.restart({ level: this.levelIndex + 1, autoStart: false });
    }
    private sparkle(x: number, y: number, color: number) {
      for (let i = 0; i < 7; i++) {
        const dot = this.add.circle(x, y, 3 + Math.random() * 3, color).setDepth(10);
        this.tweens.add({ targets: dot, x: x + (Math.random() - 0.5) * 90, y: y - 25 - Math.random() * 60, alpha: 0, duration: 450, onComplete: () => dot.destroy() });
      }
    }
    private retry() {
      this.stage = 'retrying'; this.retries++; this.physics.world.pause();
      this.publish('没关系！从小旗子继续。'); tone(260, 0.10);
      this.time.delayedCall(650, () => {
        (this.player.body as Phaser.Physics.Arcade.Body).reset(this.checkpointX, P.floorY - 43);
        this.player.setAlpha(0.65).setAngle(0); this.movement.resetCoyoteTime();
        this.stage = 'playing'; this.physics.world.resume(); this.publish();
        this.tweens.add({ targets: this.player, alpha: 1, duration: 350 });
      });
    }
    update(time: number, delta: number) {
      if (this.stage !== 'playing') return;
      this.lastTime = time;
      this.movement.update(); this.movement.move(1);
      this.bridgeBodies.forEach((bridge, index) => {
        const body = bridge.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(Math.cos(time / 1100 + index) * 12, Math.cos(time / 1100 + index) * 12);
      });
      const level = spec.levels[this.levelIndex];
      const checkpoints = [...level.checkpoints].sort((a, b) => a - b);
      if (this.nextCheckpoint < checkpoints.length && this.player.x >= checkpoints[this.nextCheckpoint] * P.tile + 32) {
        this.checkpointX = checkpoints[this.nextCheckpoint] * P.tile + 32;
        this.checkpointCount++; this.nextCheckpoint++; this.sparkle(this.checkpointX, P.floorY - 50, 0xffd977);
        tone(520, 0.08); this.publish('小旗子记住你的进度了！');
      }
      if (this.player.y > P.height + 90) { this.retry(); return; }
      if (this.player.x > (P.columns - 3) * P.tile - 40) {
        this.stage = this.levelIndex === 2 ? 'complete' : 'level-complete';
        this.physics.world.pause(); this.player.setVelocity(0, 0);
        this.sparkle(this.friendSprite.x, this.friendSprite.y, 0xffd56d);
        [523, 659, 784, 1046].forEach((frequency, index) => tone(frequency, 0.18, index * 0.13));
        this.publish(this.levelIndex === 2 ? '你找到朋友啦！一起回家吧。' : '这一站完成啦！朋友就在前方。');
        return;
      }
      // Gentle running motion from existing static artwork, rather than fake sprite sheets.
      const grounded = this.movement.isGrounded();
      this.player.setAngle(grounded ? Math.sin(time / 95) * 3 : Phaser.Math.Clamp((this.player.body as Phaser.Physics.Arcade.Body).velocity.y / 70, -8, 10));
      if (grounded && time - this.stepSoundAt > 310) { this.stepSoundAt = time; tone(150, 0.035); }
      if (delta > 100) this.player.setVelocityX(P.speed);
    }
    public diagnostics() {
      return { stage: this.stage, level: this.levelIndex, x: this.player.x, y: this.player.y,
        velocityY: (this.player.body as Phaser.Physics.Arcade.Body).velocity.y,
        grounded: this.movement.isGrounded(), retries: this.retries, checkpointX: this.checkpointX,
        time: this.lastTime, gaps: spec.levels[this.levelIndex].gaps };
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: P.width, height: P.height, backgroundColor: '#e5f1de',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: P.gravity }, debug: false, fixedStep: true } },
    scene: [Preloader, RescueScene], input: { activePointers: 2 },
    render: { antialias: true },
  });
  currentGame = game;
  if (import.meta.env.DEV) (parent as HTMLElement & { rescueGame?: Phaser.Game }).rescueGame = game;
  const scene = () => game.scene.getScene('RescueScene') as RescueScene | undefined;
  const controls: RescueControls = {
    start: () => scene()?.startAdventure(), jump: () => scene()?.jump(), pause: () => scene()?.pauseAdventure(),
    restart: () => scene()?.restartAdventure(), next: () => scene()?.nextLevel(), mute: value => { muted = value; },
  };
  return { game, controls, destroy: () => {
    if (currentGame === game) currentGame = null;
    delete (parent as HTMLElement & { rescueGame?: Phaser.Game }).rescueGame;
    game.destroy(true); void audio?.close().catch(() => {});
  } };
}

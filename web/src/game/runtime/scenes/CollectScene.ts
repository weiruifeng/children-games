import Phaser from 'phaser';
import type { CollectSpec, GameObject } from '@children-games/shared';
import { getAsset } from '../assets/proceduralAssets';
import { movePlayerClamped } from '../movement';
import { resolveHit, type HitState, type CollectedItem } from '../hit';
import { enemyStep } from '../enemy';
import { nextGrowScale } from '../effects';
import { layoutObjects } from '../layout';
import { WORLD } from '../world';

export const COLLECT_SCENE_KEY = 'CollectScene';

const WIDTH = WORLD.width;
const HEIGHT = WORLD.height;

type CollectibleDef = { asset: string; score: number; effect?: 'grow' | 'fly' };

export class CollectScene extends Phaser.Scene {
  private spec!: CollectSpec;
  private player!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private target: { x: number; y: number } | null = null;
  private enemies: { sprite: Phaser.GameObjects.Text; speed: number }[] = [];
  private score = 0;
  private lives: number = WORLD.initialLives;
  private collected: CollectedItem[] = [];
  private won = false;
  private gameOver = false;
  private invulnerableUntil = 0;
  private playerScale = 1;

  constructor() {
    super({ key: COLLECT_SCENE_KEY });
  }

  init(): void {
    this.spec = this.registry.get('spec') as CollectSpec;
    this.score = 0;
    this.lives = WORLD.initialLives;
    this.collected = [];
    this.won = false;
    this.gameOver = false;
    this.invulnerableUntil = 0;
    this.playerScale = 1;
    this.target = null;
    this.enemies = [];
  }

  create(): void {
    this.drawBackground();
    this.spawnPlayer();
    this.spawnObjects();
    this.createHud();
    this.bindInput();
  }

  private drawBackground(): void {
    const bg = getAsset(this.spec.background.asset);
    this.cameras.main.setBackgroundColor(bg.color ?? 0x000000);
    if (bg.tint != null) {
      this.add.rectangle(WIDTH / 2, HEIGHT, WIDTH, 140, bg.tint).setOrigin(0.5, 1);
    }
  }

  private spawnPlayer(): void {
    const p = getAsset(this.spec.player.character);
    this.player = this.add
      .text(WIDTH / 2, HEIGHT / 2, p.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private spawnObjects(): void {
    const start = { x: WIDTH / 2, y: HEIGHT / 2 };
    const placed = layoutObjects(this.spec.objects, { width: WIDTH, height: HEIGHT }, WORLD.margin, start, WORLD.minDist);
    for (const { object, point } of placed) {
      this.addObject(object, point);
    }
    // hazard 用绝对坐标 area 渲染
    for (const object of this.spec.objects) {
      if (object.type === 'hazard') {
        this.addHazard(object);
      }
    }
  }

  private addObject(object: GameObject, point: { x: number; y: number }): void {
    const a = getAsset(object.asset);
    if (object.type === 'enemy') {
      const sprite = this.add
        .text(point.x, point.y, a.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
        .setOrigin(0.5)
        .setDepth(3);
      this.enemies.push({ sprite, speed: object.speed });
      return;
    }
    const kind = object.type === 'collectible' ? 'collectible' : 'obstacle';
    const def = object.type === 'collectible'
      ? { asset: object.asset, score: object.score, effect: object.effect }
      : null;
    this.add
      .text(point.x, point.y, a.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(1)
      .setData('kind', kind)
      .setData('asset', object.asset)
      .setData('def', def);
  }

  private addHazard(object: { area: { x: number; y: number; width: number; height: number }; asset: string }): void {
    const a = getAsset(object.asset);
    const { x, y, width, height } = object.area;
    this.add
      .rectangle(x + width / 2, y + height / 2, width, height, a.color ?? 0x000000)
      .setOrigin(0.5)
      .setDepth(0)
      .setData('kind', 'hazard');
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(32, 32, this.scoreLabel(), { fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0).setDepth(10).setStroke('#000000', 6);
    if (this.spec.hitPolicy === 'lose-life') {
      this.livesText = this.add
        .text(32, 100, this.livesLabel(), { fontSize: '40px', color: '#ff6b6b' })
        .setOrigin(0, 0).setDepth(10).setStroke('#000000', 4);
    }
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setTarget(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.setTarget(p);
    });
    this.input.on('pointerup', () => { this.target = null; });
    this.input.on('pointerupoutside', () => { this.target = null; });
  }

  private setTarget(p: Phaser.Input.Pointer): void {
    if (this.won || this.gameOver) return;
    this.target = { x: p.worldX, y: p.worldY };
  }

  update(_time: number, delta: number): void {
    if (this.won || this.gameOver) return;
    this.movePlayer(delta);
    this.moveEnemies(delta);
    this.handleInvulnerableFlicker();
    this.checkCollectibles();
    this.checkHazards();
    this.checkEnemies();
  }

  private movePlayer(delta: number): void {
    const speed = this.spec.player.speed ?? 300;
    if (this.target) {
      const r = movePlayerClamped(
        { x: this.player.x, y: this.player.y }, this.target, speed, delta / 1000,
        { minX: WORLD.playerSize / 2, minY: WORLD.playerSize / 2, maxX: WIDTH - WORLD.playerSize / 2, maxY: HEIGHT - WORLD.playerSize / 2 },
      );
      this.player.setPosition(r.x, r.y);
      if (r.arrived) this.target = null;
    }
  }

  private moveEnemies(delta: number): void {
    for (const e of this.enemies) {
      const next = enemyStep({ x: e.sprite.x, y: e.sprite.y }, { x: this.player.x, y: this.player.y }, e.speed, delta / 1000);
      e.sprite.setPosition(next.x, next.y);
    }
  }

  private handleInvulnerableFlicker(): void {
    if (this.now() < this.invulnerableUntil) {
      this.player.setAlpha(Math.floor(this.now() / 100) % 2 === 0 ? 0.3 : 1);
    } else {
      this.player.setAlpha(1);
    }
  }

  private checkCollectibles(): void {
    const items = [...this.children.list].filter(
      (c) => (c as Phaser.GameObjects.Text).getData?.('kind') === 'collectible',
    ) as Phaser.GameObjects.Text[];
    for (const item of items) {
      if (!item.active) continue;
      if (Math.hypot(item.x - this.player.x, item.y - this.player.y) < WORLD.playerSize) {
        const def = item.getData('def') as CollectibleDef;
        this.score += def.score;
        this.collected.push({ asset: def.asset, score: def.score });
        if (def.effect === 'grow') this.playerScale = nextGrowScale(this.playerScale, WORLD.growCap);
        this.player.setScale(this.playerScale);
        this.scoreText.setText(this.scoreLabel());
        item.destroy();
        if (this.score >= this.spec.win.value) { this.victory(); return; }
        this.respawnOne(def);
      }
    }
  }

  private checkHazards(): void {
    if (this.isInvulnerable()) return;
    const hazards = [...this.children.list].filter(
      (c) => (c as Phaser.GameObjects.Rectangle).getData?.('kind') === 'hazard',
    ) as Phaser.GameObjects.Rectangle[];
    for (const h of hazards) {
      const rect = h.getBounds();
      if (rect.contains(this.player.x, this.player.y)) {
        this.applyHit({ x: h.x, y: h.y });
        return;
      }
    }
  }

  private checkEnemies(): void {
    if (this.isInvulnerable()) return;
    for (const e of this.enemies) {
      if (Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) < WORLD.playerSize) {
        this.applyHit({ x: e.sprite.x, y: e.sprite.y });
        return;
      }
    }
  }

  private isInvulnerable(): boolean {
    return this.now() < this.invulnerableUntil;
  }

  private applyHit(source: { x: number; y: number }): void {
    const state: HitState = { score: this.score, lives: this.lives, collected: this.collected, gameOver: false };
    const r = resolveHit(
      { x: this.player.x, y: this.player.y }, source, this.spec.hitPolicy ?? 'lose-score', state,
      WORLD.knockback,
      { minX: WORLD.playerSize / 2, minY: WORLD.playerSize / 2, maxX: WIDTH - WORLD.playerSize / 2, maxY: HEIGHT - WORLD.playerSize / 2 },
      this.spec.hitScore ?? 5,
    );
    this.score = r.state.score;
    this.lives = r.state.lives;
    this.collected = r.state.collected;
    this.player.setPosition(r.position.x, r.position.y);
    this.invulnerableUntil = this.now() + WORLD.invulnerableMs;
    this.scoreText.setText(this.scoreLabel());
    if (this.spec.hitPolicy === 'lose-life' && this.livesText) this.livesText.setText(this.livesLabel());
    if (r.state.gameOver) this.gameOverScreen();
  }

  private respawnOne(def: CollectibleDef): void {
    const placed = layoutObjects(
      [{ type: 'collectible', asset: def.asset, score: def.score, count: 1 }],
      { width: WIDTH, height: HEIGHT }, WORLD.margin,
      { x: this.player.x, y: this.player.y }, WORLD.minDist,
    );
    this.addObject(placed[0].object, placed[0].point);
  }

  private scoreLabel(): string {
    return `${this.score} / ${this.spec.win.value}`;
  }

  private livesLabel(): string {
    return `❤️ × ${this.lives}`;
  }

  private now(): number {
    return this.time.now;
  }

  private victory(): void {
    this.won = true;
    this.target = null;
    this.tweens.add({ targets: this.player, scale: { from: this.playerScale, to: this.playerScale + 0.4 }, duration: 300, yoyo: true, repeat: 2 });
    this.add.text(WIDTH / 2, HEIGHT / 2 - 80, '🎉 你赢啦！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' }).setOrigin(0.5).setDepth(20).setStroke('#000000', 8);
    this.addRestartButton();
  }

  private gameOverScreen(): void {
    this.gameOver = true;
    this.target = null;
    this.add.text(WIDTH / 2, HEIGHT / 2 - 80, '😢 再试一次！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' }).setOrigin(0.5).setDepth(20).setStroke('#000000', 8);
    this.addRestartButton();
  }

  private addRestartButton(): void {
    const btn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, '🔄 再玩一次', { fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5).setDepth(20).setStroke('#000000', 6).setPadding(20).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
  }
}

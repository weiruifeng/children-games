import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { getAsset } from '../assets/proceduralAssets';
import { clamp, moveToward, randomPositions, type Vec2 } from '../../math';

export const COLLECT_SCENE_KEY = 'CollectScene';

const WIDTH = 1280;
const HEIGHT = 720;
const MARGIN = 60;      // 收集物/玩家安全边距
const PLAYER_SIZE = 48; // 角色与收集物的世界尺寸
const MIN_DIST = 60;    // 生成点最小间距

type CollectibleDef = { asset: string; score: number; count: number };

export class CollectScene extends Phaser.Scene {
  private spec!: CollectSpec;
  private player!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private target: Vec2 | null = null;
  private score = 0;
  private won = false;

  constructor() {
    super({ key: COLLECT_SCENE_KEY });
  }

  init(): void {
    this.spec = this.registry.get('spec') as CollectSpec;
    this.score = 0;
    this.won = false;
    this.target = null;
  }

  create(): void {
    this.drawBackground();

    // 玩家
    const p = getAsset(this.spec.player.character);
    this.player = this.add
      .text(WIDTH / 2, HEIGHT / 2, p.emoji ?? '?', { fontSize: `${PLAYER_SIZE}px` })
      .setOrigin(0.5)
      .setDepth(2);

    // 收集物（纯随机摆放，避开玩家起点）
    this.spawnCollectibles();

    // HUD 分数
    this.scoreText = this.add
      .text(32, 32, this.scoreLabel(), { fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0)
      .setDepth(10)
      .setStroke('#000000', 6);

    // 输入：跟随手指拖拽
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setTarget(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.setTarget(p);
    });
    this.input.on('pointerup', () => { this.target = null; });
    this.input.on('pointerupoutside', () => { this.target = null; });
  }

  private drawBackground(): void {
    const bg = getAsset(this.spec.background.asset);
    this.cameras.main.setBackgroundColor(bg.color ?? 0x000000);
    if (bg.tint != null) {
      this.add.rectangle(WIDTH / 2, HEIGHT, WIDTH, 140, bg.tint).setOrigin(0.5, 1);
    }
  }

  private spawnCollectibles(): void {
    const start: Vec2 = { x: WIDTH / 2, y: HEIGHT / 2 };
    for (const def of this.spec.collectibles) {
      const points = randomPositions(def.count, { width: WIDTH, height: HEIGHT }, MARGIN, [start], MIN_DIST);
      for (const pt of points) {
        this.addCollectible(def, pt);
      }
    }
  }

  private addCollectible(def: CollectibleDef, pt: Vec2): void {
    const a = getAsset(def.asset);
    this.add
      .text(pt.x, pt.y, a.emoji ?? '?', { fontSize: `${PLAYER_SIZE}px` })
      .setOrigin(0.5)
      .setDepth(1)
      .setData('score', def.score)
      .setData('kind', 'collectible');
  }

  private setTarget(p: Phaser.Input.Pointer): void {
    if (this.won) return;
    this.target = { x: p.worldX, y: p.worldY };
  }

  update(_time: number, delta: number): void {
    if (this.won) return;
    const speed = this.spec.player.speed ?? 300;
    if (this.target) {
      const next = moveToward(
        { x: this.player.x, y: this.player.y },
        this.target,
        speed,
        delta / 1000,
      );
      this.player.setPosition(
        clamp(next.x, PLAYER_SIZE / 2, WIDTH - PLAYER_SIZE / 2),
        clamp(next.y, PLAYER_SIZE / 2, HEIGHT - PLAYER_SIZE / 2),
      );
      // 到达目标附近即停下
      if (Math.hypot(this.target.x - this.player.x, this.target.y - this.player.y) < 4) {
        this.target = null;
      }
    }
    this.checkCollect();
  }

  private checkCollect(): void {
    const children = this.children.list;
    for (const child of children) {
      const item = child as Phaser.GameObjects.Text;
      if (item.getData('kind') !== 'collectible' || !item.active) continue;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < PLAYER_SIZE) {
        const score = item.getData('score') as number;
        this.score += score;
        this.scoreText.setText(this.scoreLabel());
        item.destroy();
        if (this.score >= this.spec.win.value) {
          this.victory();
          return;
        }
        this.respawnOne();
      }
    }
  }

  // 捡到后随机重生一个，保证场上永远有东西可捡（只赢不输）
  private respawnOne(): void {
    const def = this.spec.collectibles[0];
    const points = randomPositions(1, { width: WIDTH, height: HEIGHT }, MARGIN, [{ x: this.player.x, y: this.player.y }], MIN_DIST);
    this.addCollectible(def, points[0]);
  }

  private scoreLabel(): string {
    return `${this.score} / ${this.spec.win.value}`;
  }

  private victory(): void {
    this.won = true;
    this.target = null;
    // 胜利动画：角色弹跳
    this.tweens.add({
      targets: this.player,
      scale: { from: 1, to: 1.4 },
      duration: 300,
      yoyo: true,
      repeat: 2,
    });
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 80, '🎉 你赢啦！', { fontSize: '96px', fontStyle: 'bold', color: '#ffd54a' })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', 8);
    const btn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, '🔄 再玩一次', { fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', 6)
      .setPadding(20)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
  }
}

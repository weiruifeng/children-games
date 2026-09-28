import Phaser from 'phaser';
import type { CollectSpec } from '@children-games/shared';
import { getAsset } from '../assets/proceduralAssets';
import { movePlayerClamped } from '../movement';
import { layoutCollectibles, type CollectibleDef } from '../layout';
import { WORLD } from '../world';

export const COLLECT_SCENE_KEY = 'CollectScene';

const WIDTH = WORLD.width;
const HEIGHT = WORLD.height;

export class CollectScene extends Phaser.Scene {
  private spec!: CollectSpec;
  private player!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private target: { x: number; y: number } | null = null;
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
      .text(WIDTH / 2, HEIGHT / 2, p.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(2);

    // 收集物（多类型共享摆放、互不重叠，避开玩家起点）
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
    const start = { x: WIDTH / 2, y: HEIGHT / 2 };
    const placed = layoutCollectibles(
      this.spec.collectibles,
      { width: WIDTH, height: HEIGHT },
      WORLD.margin,
      start,
      WORLD.minDist,
    );
    for (const { def, point } of placed) {
      this.addCollectible(def, point);
    }
  }

  private addCollectible(def: CollectibleDef, point: { x: number; y: number }): void {
    const a = getAsset(def.asset);
    this.add
      .text(point.x, point.y, a.emoji ?? '?', { fontSize: `${WORLD.playerSize}px` })
      .setOrigin(0.5)
      .setDepth(1)
      .setData('score', def.score)
      .setData('asset', def.asset)
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
      const r = movePlayerClamped(
        { x: this.player.x, y: this.player.y },
        this.target,
        speed,
        delta / 1000,
        {
          minX: WORLD.playerSize / 2,
          minY: WORLD.playerSize / 2,
          maxX: WIDTH - WORLD.playerSize / 2,
          maxY: HEIGHT - WORLD.playerSize / 2,
        },
      );
      this.player.setPosition(r.x, r.y);
      if (r.arrived) this.target = null;
    }
    this.checkCollect();
  }

  private checkCollect(): void {
    // 快照后再销毁：避免遍历中改 children.list 导致相邻项被跳过
    const items = [...this.children.list].filter(
      (c) => (c as Phaser.GameObjects.Text).getData?.('kind') === 'collectible',
    ) as Phaser.GameObjects.Text[];

    for (const item of items) {
      if (!item.active) continue;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < WORLD.playerSize) {
        const score = item.getData('score') as number;
        const asset = item.getData('asset') as string;
        this.score += score;
        this.scoreText.setText(this.scoreLabel());
        item.destroy();
        if (this.score >= this.spec.win.value) {
          this.victory();
          return;
        }
        this.respawnOne(asset);
      }
    }
  }

  // 捡到后随机重生一个同类，保证场上永远有东西可捡（只赢不输）
  private respawnOne(asset: string): void {
    const def = this.spec.collectibles.find((d) => d.asset === asset) ?? this.spec.collectibles[0];
    const placed = layoutCollectibles(
      [def],
      { width: WIDTH, height: HEIGHT },
      WORLD.margin,
      { x: this.player.x, y: this.player.y },
      WORLD.minDist,
    );
    this.addCollectible(def, placed[0].point);
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

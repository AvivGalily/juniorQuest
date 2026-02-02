import Phaser from "phaser";
import { BASE_HEIGHT } from "../utils/resolution";
import { scaleSpriteToHeight } from "../utils/spriteScale";

export class BossAISpider extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  private readonly targetHeight = BASE_HEIGHT * 0.12;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    super(scene, x, y, "boss");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setImmovable(true);
    this.body.allowGravity = false;
    this.hp = hp;
    this.applyDisplaySize();
  }

  damage(amount = 1): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

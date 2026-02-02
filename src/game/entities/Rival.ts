import Phaser from "phaser";
import { scale } from "../utils/layout";
import { BASE_HEIGHT } from "../utils/resolution";
import { scaleSpriteToHeight } from "../utils/spriteScale";

export class Rival extends Phaser.Physics.Arcade.Sprite {
  private speed = scale(80);
  private readonly targetHeight = BASE_HEIGHT * 0.1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "rival");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setBounce(0.1, 0.1);
    this.applyDisplaySize();
  }

  updateAI(targetX: number): void {
    const dir = targetX - this.x;
    this.setVelocityX(Math.sign(dir) * this.speed);
    if (this.body.blocked.down) {
      this.setVelocityY(-scale(220));
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

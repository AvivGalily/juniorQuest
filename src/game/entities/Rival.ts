import Phaser from "phaser";
import { ENTITIES } from "../../config/physics";
import { scale } from "../utils/layout";
import { BASE_HEIGHT } from "../utils/resolution";
import { scaleSpriteToHeight } from "../utils/spriteScale";

export class Rival extends Phaser.Physics.Arcade.Sprite {
  private speed = scale(ENTITIES.RIVAL_SPEED);
  private readonly targetHeight = BASE_HEIGHT * ENTITIES.SPRITE_HEIGHT_RATIO;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "rival");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setBounce(ENTITIES.RIVAL_BOUNCE, ENTITIES.RIVAL_BOUNCE);
    this.applyDisplaySize();
  }

  updateAI(targetX: number): void {
    const dir = targetX - this.x;
    this.setVelocityX(Math.sign(dir) * this.speed);
    if (this.body.blocked.down) {
      this.setVelocityY(-scale(ENTITIES.RIVAL_JUMP_VELOCITY));
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

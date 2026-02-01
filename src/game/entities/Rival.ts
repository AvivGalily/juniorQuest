import Phaser from "phaser";

export class Rival extends Phaser.Physics.Arcade.Sprite {
  private speed = 80;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "rival");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setBounce(0.1, 0.1);
  }

  updateAI(targetX: number): void {
    const dir = targetX - this.x;
    this.setVelocityX(Math.sign(dir) * this.speed);
    if (this.body.blocked.down) {
      this.setVelocityY(-220);
    }
  }
}

import Phaser from "phaser";

export class BossAISpider extends Phaser.Physics.Arcade.Sprite {
  hp: number;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    super(scene, x, y, "boss");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setImmovable(true);
    this.body.allowGravity = false;
    this.hp = hp;
  }

  damage(amount = 1): void {
    this.hp = Math.max(0, this.hp - amount);
  }
}

import Phaser from "phaser";
import { rngInt } from "../utils/rng";

export class Recruiter extends Phaser.Physics.Arcade.Sprite {
  companyTag: string;
  private wanderTimer = 0;
  private speed = 40;

  constructor(scene: Phaser.Scene, x: number, y: number, companyTag: string) {
    super(scene, x, y, "recruiter");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.companyTag = companyTag;
    this.pickNewDirection();
  }

  update(delta: number): void {
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.pickNewDirection();
    }
  }

  private pickNewDirection(): void {
    const angle = Phaser.Math.DegToRad(rngInt(0, 360));
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.wanderTimer = rngInt(900, 1600);
  }
}

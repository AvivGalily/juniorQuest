import Phaser from "phaser";
import { rngInt } from "../../utils/rng";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scale } from "../../utils/layout";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Recruiter extends Phaser.Physics.Arcade.Sprite {
  companyTag: string;
  private wanderTimer = 0;
  private speed = scale(40);
  private facing: "left" | "right" = "right";
  private moving = false;
  private readonly walkToggleMs = 160;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly targetHeight = BASE_HEIGHT * 0.1;

  constructor(scene: Phaser.Scene, x: number, y: number, companyTag: string) {
    super(scene, x, y, "hr-stand");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.companyTag = companyTag;
    this.applyDisplaySize();
    this.pickNewDirection();
    this.updateTexture(true);
  }

  update(delta: number): void {
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.pickNewDirection();
    }
    const vx = this.body?.velocity.x ?? 0;
    const vy = this.body?.velocity.y ?? 0;
    const prevFacing = this.facing;
    if (Math.abs(vx) > 0.01) {
      this.facing = vx < 0 ? "left" : "right";
    }
    this.moving = Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  private pickNewDirection(): void {
    const angle = Phaser.Math.DegToRad(rngInt(0, 360));
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.wanderTimer = rngInt(900, 1600);
  }

  private updateWalkPhase(directionChanged: boolean): void {
    if (!this.moving) {
      this.walkPhase = 0;
      this.lastWalkSwitchAt = this.scene.time.now;
      return;
    }
    if (directionChanged) {
      this.walkPhase = 0;
      this.lastWalkSwitchAt = this.scene.time.now;
      return;
    }
    const now = this.scene.time.now;
    if (now - this.lastWalkSwitchAt >= this.walkToggleMs) {
      this.walkPhase = this.walkPhase === 0 ? 1 : 0;
      this.lastWalkSwitchAt = now;
    }
  }

  private updateTexture(force = false): void {
    if (!this.moving) {
      if (force || this.texture.key !== "hr-stand") {
        this.setTexture("hr-stand");
        this.applyDisplaySize();
      }
      return;
    }
    const speedKey = this.walkPhase === 0 ? "slow" : "fast";
    const key = `hr-walk-${speedKey}-${this.facing}`;
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

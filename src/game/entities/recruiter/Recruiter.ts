import Phaser from "phaser";
import { ANIMATION, ENTITIES, INPUT, WANDER } from "../../../config/physics";
import { rngInt } from "../../utils/rng";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scale } from "../../utils/layout";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Recruiter extends Phaser.Physics.Arcade.Sprite {
  companyTag: string;
  private wanderTimer = 0;
  private speed = scale(ENTITIES.RECRUITER_WANDER_SPEED);
  private facing: "left" | "right" = "right";
  private moving = false;
  private readonly walkToggleMs = ANIMATION.WALK_TOGGLE_MS;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly targetHeight = BASE_HEIGHT * ENTITIES.SPRITE_HEIGHT_RATIO;

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
    if (Math.abs(vx) > INPUT.AXIS_EPSILON) {
      this.facing = vx < 0 ? "left" : "right";
    }
    this.moving = Math.abs(vx) > INPUT.AXIS_EPSILON || Math.abs(vy) > INPUT.AXIS_EPSILON;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  private pickNewDirection(): void {
    const angle = Phaser.Math.DegToRad(rngInt(WANDER.ANGLE_MIN_DEG, WANDER.ANGLE_MAX_DEG));
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.wanderTimer = rngInt(WANDER.MIN_MS, WANDER.MAX_MS);
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

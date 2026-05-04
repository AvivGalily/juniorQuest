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
  private desiredVelocity = new Phaser.Math.Vector2();
  private readonly variant: number;

  constructor(scene: Phaser.Scene, x: number, y: number, companyTag: string, variant = 1) {
    const safeVariant = Phaser.Math.Clamp(Math.round(variant), 1, 5);
    super(scene, x, y, `hr-v${safeVariant}-stand`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.companyTag = companyTag;
    this.variant = safeVariant;
    this.applyDisplaySize();
    this.pickNewDirection();
    this.updateTexture(true);
  }

  update(delta: number): void {
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.pickNewDirection();
    }
    this.applySteering();
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
    if (rngInt(0, 99) < WANDER.IDLE_CHANCE * 100) {
      this.desiredVelocity.set(0, 0);
      this.wanderTimer = rngInt(WANDER.IDLE_MIN_MS, WANDER.IDLE_MAX_MS);
      return;
    }
    const angle = Phaser.Math.DegToRad(rngInt(WANDER.ANGLE_MIN_DEG, WANDER.ANGLE_MAX_DEG));
    this.desiredVelocity.set(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.wanderTimer = rngInt(WANDER.MIN_MS, WANDER.MAX_MS);
  }

  private applySteering(): void {
    const vx = Phaser.Math.Linear(this.body.velocity.x, this.desiredVelocity.x, WANDER.TURN_RATE);
    const vy = Phaser.Math.Linear(this.body.velocity.y, this.desiredVelocity.y, WANDER.TURN_RATE);
    this.setVelocity(vx, vy);
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
    const prefix = `hr-v${this.variant}`;
    if (!this.moving) {
      const key = `${prefix}-stand`;
      if (force || this.texture.key !== key) {
        this.setTexture(key);
        this.applyDisplaySize();
      }
      return;
    }
    const speedKey = this.walkPhase === 0 ? "slow" : "fast";
    const key = `${prefix}-walk-${speedKey}-${this.facing}`;
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

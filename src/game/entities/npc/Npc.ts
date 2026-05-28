import Phaser from "phaser";
import { ANIMATION, ENTITIES, INPUT, WANDER } from "../../../config/physics";
import { rngInt } from "../../utils/rng";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scale } from "../../utils/layout";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Npc extends Phaser.Physics.Arcade.Sprite {
  private wanderTimer = 0;
  private speed = scale(ENTITIES.NPC_WANDER_SPEED);
  private facing: "left" | "right" | "front" | "back" = "front";
  private moving = false;
  private readonly walkToggleMs = ANIMATION.WALK_TOGGLE_MS;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly targetHeight = BASE_HEIGHT * ENTITIES.SPRITE_HEIGHT_RATIO;
  private readonly variant: 1 | 2 | 3;
  private moveTarget?: Phaser.Math.Vector2;
  private desiredVelocity = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, variant: 1 | 2 | 3) {
    super(scene, x, y, `npc${variant}-walk-front`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.variant = variant;
    this.applyDisplaySize();
    this.pickNewDirection();
    this.updateTexture(true);
  }

  setMoveTarget(x: number, y: number): void {
    if (!this.moveTarget) {
      this.moveTarget = new Phaser.Math.Vector2(x, y);
      return;
    }
    this.moveTarget.set(x, y);
  }

  clearMoveTarget(): void {
    this.moveTarget = undefined;
  }

  update(delta: number): void {
    if (this.moveTarget) {
      this.moveTowardsTarget();
    } else {
      this.wanderTimer -= delta;
      if (this.wanderTimer <= 0) {
        this.pickNewDirection();
      }
      this.applySteering();
    }

    const vx = this.body?.velocity.x ?? 0;
    const vy = this.body?.velocity.y ?? 0;
    const prevFacing = this.facing;
    this.facing = this.resolveFacing(vx, vy);
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

  private moveTowardsTarget(): void {
    if (!this.moveTarget) {
      return;
    }
    const dx = this.moveTarget.x - this.x;
    const dy = this.moveTarget.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= scale(ENTITIES.NPC_TARGET_ARRIVAL_RANGE)) {
      this.desiredVelocity.set(0, 0);
      this.applySteering(WANDER.TARGET_TURN_RATE);
      return;
    }
    const vx = (dx / distance) * this.speed;
    const vy = (dy / distance) * this.speed;
    this.desiredVelocity.set(vx, vy);
    this.applySteering(WANDER.TARGET_TURN_RATE);
  }

  private applySteering(turnRate = WANDER.TURN_RATE): void {
    const vx = Phaser.Math.Linear(this.body.velocity.x, this.desiredVelocity.x, turnRate);
    const vy = Phaser.Math.Linear(this.body.velocity.y, this.desiredVelocity.y, turnRate);
    this.setVelocity(vx, vy);
  }

  private resolveFacing(vx: number, vy: number): "left" | "right" | "front" | "back" {
    if (Math.abs(vy) > Math.abs(vx)) {
      if (vy < -INPUT.AXIS_EPSILON) {
        return "back";
      }
      if (vy > INPUT.AXIS_EPSILON) {
        return "front";
      }
    }
    if (Math.abs(vx) > INPUT.AXIS_EPSILON) {
      return vx < 0 ? "left" : "right";
    }
    return this.facing;
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

  private getSideKey(speed: "slow" | "fast", facing: "left" | "right"): string {
    return `npc${this.variant}-walk-${speed}-${facing}`;
  }

  private updateTexture(force = false): void {
    let key = "";
    if (this.facing === "front" || this.facing === "back") {
      if (this.moving) {
        const stepKey = this.walkPhase === 0 ? "step" : "step-alt";
        key = `npc${this.variant}-walk-${this.facing}-${stepKey}`;
      } else {
        key = `npc${this.variant}-walk-${this.facing}`;
      }
    } else {
      const speedKey = this.moving ? (this.walkPhase === 0 ? "slow" : "fast") : "slow";
      key = this.getSideKey(speedKey, this.facing);
    }

    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private scaleMultiplier = 1;

  setScaleMultiplier(mult: number): void {
    this.scaleMultiplier = mult;
    this.applyDisplaySize();
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight * this.scaleMultiplier);
  }
}

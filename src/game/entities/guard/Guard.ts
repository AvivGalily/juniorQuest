import Phaser from "phaser";
import { ANIMATION, ENTITIES, GUARD, INPUT } from "../../../config/physics";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Guard extends Phaser.Physics.Arcade.Sprite {
  private waypoints: Phaser.Math.Vector2[];
  private currentIndex = 0;
  private speed: number;
  private facing: "left" | "right" = "right";
  private moving = false;
  private facingAngle = 0;
  private readonly walkToggleMs = ANIMATION.WALK_TOGGLE_MS;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private lastAnimFacing: "left" | "right" | "front" = "right";
  private readonly targetHeight = BASE_HEIGHT * ENTITIES.SPRITE_HEIGHT_RATIO;
  private lastX = 0;
  private lastY = 0;
  private lastMoveCheckAt = 0;
  private stuckMs = 0;
  private readonly stuckThresholdMs = GUARD.STUCK_THRESHOLD_MS;

  constructor(scene: Phaser.Scene, x: number, y: number, waypoints: Phaser.Math.Vector2[], speed: number) {
    super(scene, x, y, "guard-stand");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.waypoints = waypoints;
    this.speed = speed;
    this.lastX = x;
    this.lastY = y;
    this.lastMoveCheckAt = scene.time.now;
    this.applyDisplaySize();
    this.updateTexture(true, "right");
  }

  update(): void {
    if (this.waypoints.length === 0) {
      this.setVelocity(0, 0);
      this.moving = false;
      this.updateTexture();
      return;
    }
    const target = this.waypoints[this.currentIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < GUARD.CLOSE_ENOUGH_DIST) {
      this.currentIndex = (this.currentIndex + 1) % this.waypoints.length;
      this.setVelocity(0, 0);
      this.moving = false;
      this.updateTexture();
      return;
    }
    const vx = (dx / dist) * this.speed;
    const vy = (dy / dist) * this.speed;
    this.setVelocity(vx, vy);
    this.facingAngle = Phaser.Math.Angle.Between(0, 0, vx, vy);
    const prevFacing = this.facing;
    if (Math.abs(vx) > INPUT.AXIS_EPSILON) {
      this.facing = vx < 0 ? "left" : "right";
    }
    this.moving = Math.abs(vx) > INPUT.AXIS_EPSILON || Math.abs(vy) > INPUT.AXIS_EPSILON;
    const animFacing = this.resolveAnimFacing(vx, vy);
    this.updateWalkPhase(prevFacing !== this.facing || animFacing !== this.lastAnimFacing);
    this.updateTexture(false, animFacing);
    this.handleStuck();
  }

  private resolveAnimFacing(vx: number, vy: number): "left" | "right" | "front" {
    if (Math.abs(vy) > Math.abs(vx) && vy > INPUT.AXIS_EPSILON) {
      return "front";
    }
    if (Math.abs(vx) > INPUT.AXIS_EPSILON) {
      return vx < 0 ? "left" : "right";
    }
    return this.lastAnimFacing;
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

  private updateTexture(force = false, animFacing: "left" | "right" | "front" = this.lastAnimFacing): void {
    this.lastAnimFacing = animFacing;
    if (!this.moving) {
      if (force || this.texture.key !== "guard-stand") {
        this.setTexture("guard-stand");
        this.applyDisplaySize();
      }
      return;
    }

    if (animFacing === "front") {
      if (force || this.texture.key !== "guard-walk-front") {
        this.setTexture("guard-walk-front");
        this.applyDisplaySize();
      }
      return;
    }

    const speedKey = this.walkPhase === 0 ? "slow" : "fast";
    const key = `guard-walk-${speedKey}-${animFacing}`;
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }

  private handleStuck(): void {
    if (!this.moving) {
      this.stuckMs = 0;
      this.lastX = this.x;
      this.lastY = this.y;
      this.lastMoveCheckAt = this.scene.time.now;
      return;
    }
    const now = this.scene.time.now;
    const dt = now - this.lastMoveCheckAt;
    if (dt <= 0) {
      return;
    }
    const movedDist = Phaser.Math.Distance.Between(this.x, this.y, this.lastX, this.lastY);
    if (movedDist < GUARD.STUCK_MOVE_EPS) {
      this.stuckMs += dt;
      if (this.stuckMs >= this.stuckThresholdMs && this.waypoints.length > 1) {
        this.currentIndex = (this.currentIndex + 1) % this.waypoints.length;
        this.stuckMs = 0;
      }
    } else {
      this.stuckMs = 0;
    }
    this.lastX = this.x;
    this.lastY = this.y;
    this.lastMoveCheckAt = now;
  }

  getFacingAngle(): number {
    // Used for FOV calculations in Level 1. Keep decoupled from Sprite rotation (we don't rotate the guard art).
    return this.facingAngle;
  }
}

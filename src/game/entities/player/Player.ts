import Phaser from "phaser";
import { ANIMATION, INPUT, PLAYER } from "../../../config/physics";
import { InputManager } from "../../systems/InputManager";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Player extends Phaser.Physics.Arcade.Sprite {
  speed = PLAYER.TOPDOWN_SPEED;
  jumpSpeed = PLAYER.JUMP_BASE;
  private facing: "left" | "right" | "front" | "back" = "right";
  private carrying = false;
  private carryStyle: "generic" | "cv" = "generic";
  private moving = false;
  private readonly walkToggleMs = ANIMATION.WALK_TOGGLE_MS;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly targetHeight = BASE_HEIGHT * PLAYER.SPRITE_HEIGHT_RATIO;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player-walk-slow-right");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.applyDisplaySize();
    this.updateTexture(true);
  }

  updateTopDown(input: InputManager, speed = this.speed): void {
    const vec = input.getMoveVector();
    this.setVelocity(vec.x * speed, vec.y * speed);
    const prevFacing = this.facing;
    this.facing = this.resolveFacing(vec.x, vec.y);
    this.moving = vec.lengthSq() > INPUT.VECTOR_EPSILON_SQ;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  updatePlatformer(input: InputManager, speed = this.speed, jumpSpeed = this.jumpSpeed): void {
    const axisX = input.getAxisX();
    this.setVelocityX(axisX * speed);
    if (input.justPressedJump() && this.body.blocked.down) {
      this.setVelocityY(-jumpSpeed);
    }
    const prevFacing = this.facing;
    if (Math.abs(axisX) > INPUT.AXIS_EPSILON) {
      this.facing = axisX < 0 ? "left" : "right";
    }
    this.moving = Math.abs(axisX) > INPUT.AXIS_EPSILON_TINY;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  setCarrying(carrying: boolean): void {
    if (this.carrying === carrying) {
      return;
    }
    this.carrying = carrying;
    this.updateTexture(true);
  }

  setCarryStyle(style: "generic" | "cv"): void {
    if (this.carryStyle === style) {
      return;
    }
    this.carryStyle = style;
    this.updateTexture(true);
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

  private updateTexture(force = false): void {
    if (this.carrying && this.carryStyle === "cv") {
      this.setFlipX(false);
      const key = this.getDirectionalKey("player-cv-walk");
      if (force || this.texture.key !== key) {
        this.setTexture(key);
        this.applyDisplaySize();
      }
      return;
    }

    if (this.carrying && this.carryStyle === "generic") {
      const key = "player-carry-left";
      if (force || this.texture.key !== key) {
        this.setTexture(key);
        this.applyDisplaySize();
      }
      this.setFlipX(this.facing === "right");
      return;
    }

    this.setFlipX(false);
    const key = this.getDirectionalKey("player-walk");
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private getDirectionalKey(prefix: "player-walk" | "player-cv-walk"): string {
    if (this.facing === "front" || this.facing === "back") {
      return `${prefix}-${this.facing}`;
    }
    const speedKey = this.moving ? (this.walkPhase === 0 ? "slow" : "fast") : "slow";
    return `${prefix}-${speedKey}-${this.facing}`;
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

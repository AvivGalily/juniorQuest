import Phaser from "phaser";
import { InputManager } from "../../systems/InputManager";
import { BASE_HEIGHT } from "../../utils/resolution";
import { scaleSpriteToHeight } from "../../utils/spriteScale";

export class Player extends Phaser.Physics.Arcade.Sprite {
  speed = 120;
  jumpSpeed = 260;
  private facing: "left" | "right" = "right";
  private carrying = false;
  private moving = false;
  private moveY = 0;
  private readonly walkToggleMs = 160;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly targetHeight = BASE_HEIGHT * 0.1;

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
    this.moveY = vec.y;
    const prevFacing = this.facing;
    if (Math.abs(vec.x) > 0.01) {
      this.facing = vec.x < 0 ? "left" : "right";
    }
    this.moving = vec.lengthSq() > 0.01;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  updatePlatformer(input: InputManager, speed = this.speed, jumpSpeed = this.jumpSpeed): void {
    const axisX = input.getAxisX();
    this.setVelocityX(axisX * speed);
    this.moveY = 0;
    if (input.justPressedJump() && this.body.blocked.down) {
      this.setVelocityY(-jumpSpeed);
    }
    const prevFacing = this.facing;
    if (Math.abs(axisX) > 0.01) {
      this.facing = axisX < 0 ? "left" : "right";
    }
    this.moving = Math.abs(axisX) > 0.001;
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
    const showCarry = this.carrying && !(this.moving && this.moveY > 0.01);
    if (showCarry) {
      const key = "player-carry-left";
      if (force || this.texture.key !== key) {
        this.setTexture(key);
      }
      this.setFlipX(this.facing === "right");
      this.applyDisplaySize();
      return;
    }

    this.setFlipX(false);
    const speedKey = this.moving ? (this.walkPhase === 0 ? "slow" : "fast") : "slow";
    const key = `player-walk-${speedKey}-${this.facing}`;
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

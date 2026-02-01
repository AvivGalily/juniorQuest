import Phaser from "phaser";
import { InputManager } from "../../systems/InputManager";

export class Player extends Phaser.Physics.Arcade.Sprite {
  speed = 120;
  jumpSpeed = 260;
  private facing: "left" | "right" = "right";
  private carrying = false;
  private moving = false;
  // Bumped size for readability. Keep body size in sync via applyDisplaySize().
  private readonly displayW = 28;
  private readonly displayH = 35;
  private readonly walkToggleMs = 160;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player-right-stand");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.applyDisplaySize();
    this.updateTexture();
  }

  updateTopDown(input: InputManager, speed = this.speed): void {
    const vec = input.getMoveVector();
    this.setVelocity(vec.x * speed, vec.y * speed);
    if (Math.abs(vec.x) > 0.01) {
      this.facing = vec.x < 0 ? "left" : "right";
    }
    this.moving = vec.lengthSq() > 0.01;
    this.updateTexture();
  }

  updatePlatformer(input: InputManager, speed = this.speed, jumpSpeed = this.jumpSpeed): void {
    const axisX = input.getAxisX();
    this.setVelocityX(axisX * speed);
    if (input.justPressedJump() && this.body.blocked.down) {
      this.setVelocityY(-jumpSpeed);
    }
    if (Math.abs(axisX) > 0.01) {
      this.facing = axisX < 0 ? "left" : "right";
    }
    this.moving = Math.abs(axisX) > 0.01;
    this.updateTexture();
  }

  setCarrying(carrying: boolean): void {
    if (this.carrying === carrying) {
      return;
    }
    this.carrying = carrying;
    this.updateTexture();
  }

  private getWalkSuffix(): "stand" | "walk" {
    // Simple 2-frame walk: alternate between stand and walk while moving.
    const phase = Math.floor(this.scene.time.now / this.walkToggleMs) % 2;
    return phase === 0 ? "stand" : "walk";
  }

  private updateTexture(): void {
    const suffix = this.carrying ? "up" : this.moving ? this.getWalkSuffix() : "stand";
    const key = `player-${this.facing}-${suffix}`;
    if (this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    this.setDisplaySize(this.displayW, this.displayH);
    this.body?.setSize(this.displayW, this.displayH, true);
  }
}

import Phaser from "phaser";

export class Guard extends Phaser.Physics.Arcade.Sprite {
  private waypoints: Phaser.Math.Vector2[];
  private currentIndex = 0;
  private speed: number;
  private facing: "left" | "right" = "right";
  private moving = false;
  private facingAngle = 0;
  private readonly walkToggleMs = 160;
  private readonly displayW = 28;
  private readonly displayH = 35;

  constructor(scene: Phaser.Scene, x: number, y: number, waypoints: Phaser.Math.Vector2[], speed: number) {
    super(scene, x, y, "guard-right-stand");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.waypoints = waypoints;
    this.speed = speed;
    this.setDisplaySize(this.displayW, this.displayH);
    this.body?.setSize(this.displayW, this.displayH, true);
    this.updateTexture();
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
    if (dist < 4) {
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
    if (Math.abs(vx) > 0.01) {
      this.facing = vx < 0 ? "left" : "right";
    }
    this.moving = true;
    this.updateTexture();
  }

  private getWalkSuffix(): "stand" | "walk" {
    const phase = Math.floor(this.scene.time.now / this.walkToggleMs) % 2;
    return phase === 0 ? "stand" : "walk";
  }

  private updateTexture(): void {
    const suffix = this.moving ? this.getWalkSuffix() : "stand";
    const key = `guard-${this.facing}-${suffix}`;
    if (this.texture.key !== key) {
      this.setTexture(key);
    }
  }

  getFacingAngle(): number {
    // Used for FOV calculations in Level 1. Keep decoupled from Sprite rotation (we don't rotate the guard art).
    return this.facingAngle;
  }
}

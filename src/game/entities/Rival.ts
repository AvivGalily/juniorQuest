import Phaser from "phaser";
import { ANIMATION, ENTITIES, INPUT } from "../../config/physics";
import { scale } from "../utils/layout";
import { BASE_HEIGHT } from "../utils/resolution";
import { scaleSpriteToHeight } from "../utils/spriteScale";

export class Rival extends Phaser.Physics.Arcade.Sprite {
  private speed = scale(ENTITIES.RIVAL_SPEED);
  private readonly targetHeight = BASE_HEIGHT * ENTITIES.SPRITE_HEIGHT_RATIO;
  private readonly variant: 1 | 2 | 3;
  private facing: "left" | "right" = "right";
  private moving = false;
  private walkPhase: 0 | 1 = 0;
  private lastWalkSwitchAt = 0;
  private readonly walkToggleMs = ANIMATION.WALK_TOGGLE_MS;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: 1 | 2 | 3 = 1) {
    super(scene, x, y, `npc${variant}-walk-slow-right`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setBounce(ENTITIES.RIVAL_BOUNCE, ENTITIES.RIVAL_BOUNCE);
    this.variant = variant;
    this.applyDisplaySize();
    this.updateTexture(true);
  }

  updateAI(targetX: number): void {
    const dir = targetX - this.x;
    this.setVelocityX(Math.sign(dir) * this.speed);
    if (this.body.blocked.down) {
      this.setVelocityY(-scale(ENTITIES.RIVAL_JUMP_VELOCITY));
    }
    const prevFacing = this.facing;
    if (Math.abs(this.body.velocity.x) > INPUT.AXIS_EPSILON) {
      this.facing = this.body.velocity.x < 0 ? "left" : "right";
    }
    this.moving = Math.abs(this.body.velocity.x) > INPUT.AXIS_EPSILON || Math.abs(this.body.velocity.y) > INPUT.AXIS_EPSILON;
    this.updateWalkPhase(prevFacing !== this.facing);
    this.updateTexture();
  }

  private updateWalkPhase(directionChanged: boolean): void {
    if (!this.moving || directionChanged) {
      this.walkPhase = 0;
      this.lastWalkSwitchAt = this.scene.time.now;
      return;
    }
    if (this.scene.time.now - this.lastWalkSwitchAt >= this.walkToggleMs) {
      this.walkPhase = this.walkPhase === 0 ? 1 : 0;
      this.lastWalkSwitchAt = this.scene.time.now;
    }
  }

  private updateTexture(force = false): void {
    const speedKey = this.moving ? (this.walkPhase === 0 ? "slow" : "fast") : "slow";
    const key = `npc${this.variant}-walk-${speedKey}-${this.facing}`;
    if (force || this.texture.key !== key) {
      this.setTexture(key);
      this.applyDisplaySize();
    }
  }

  private applyDisplaySize(): void {
    scaleSpriteToHeight(this, this.targetHeight);
  }
}

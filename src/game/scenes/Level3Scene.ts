import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { SnakeNode } from "../entities/SnakeNode";
import { difficultyPresets } from "../../config/difficulty";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";
import { scale, scaleX, scaleY } from "../utils/layout";

export class Level3Scene extends BaseLevelScene {
  private player!: Player;
  private nodes: SnakeNode[] = [];
  private activeNodeIndex = -1;
  private comboActive = false;
  private comboStep = 0;
  private comboStartMs = 0;
  private comboWindowMs = 2000;
  private attackTimer?: Phaser.Time.TimerEvent;
  private attackZone?: Phaser.GameObjects.Rectangle;
  private projectileTimer?: Phaser.Time.TimerEvent;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private snakeHead = new Phaser.Math.Vector2(scaleX(200), scaleY(220));
  private snakeDir = 1;
  private snakeSpeed = scale(40);
  private snakeWavePhase = 0;
  private snakeWaveSpeed = 0.004;
  private snakeWaveAmplitude = scale(14);
  private snakePath: Phaser.Math.Vector2[] = [];
  private pathSpacing = scale(6);
  private snakeMinX = scaleX(140);
  private snakeMaxX = scaleX(500);

  constructor() {
    super("Level3Scene");
  }

  create(): void {
    this.initLevel(3);
    this.audio.playMusic("music-gameplay", 0.2);
    this.physics.world.gravity.y = 700;
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x14141f);
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    const ground = this.physics.add.staticImage(scaleX(320), scaleY(330), "platform").setScale(10 * scaleX(1), 1 * scaleY(1)).refreshBody();

    this.player = new Player(this, scaleX(80), scaleY(280));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, ground);

    const diff = difficultyPresets[runState.difficulty];
    this.comboWindowMs = diff.l3.comboWindowMs;

    for (let i = 0; i < diff.l3.nodesCount; i += 1) {
      const node = new SnakeNode(this, scaleX(200 + i * 50), scaleY(240), String(i + 1));
      this.nodes.push(node);
    }
    this.initSnakePath();

    createDialogText(this, scaleX(320), scaleY(30), "Reverse Linked List Snake", {
      maxWidth: 360,
      fontSize: 16,
      color: "#e8eef2"
    });

    createDialogText(this, scaleX(320), scaleY(52), "Target a node, then Q -> E -> Shift", {
      maxWidth: 360,
      fontSize: 14,
      color: "#9aa7b1"
    });

    this.attackTimer = this.time.addEvent({
      delay: diff.l3.snakeAttackIntervalMs,
      loop: true,
      callback: () => this.triggerSnakeAttack()
    });

    this.projectileGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.projectileGroup, (_, proj) => {
      (proj as Phaser.GameObjects.GameObject).destroy();
      this.applyDamage();
      FloatingText.spawn(this, this.player.x, this.player.y - scale(20), "HIT", "#ff6b6b");
    });

    this.projectileTimer = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => this.fireSideShots()
    });
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updatePlatformer(this.inputManager, scale(140), scale(280));

    if (!this.comboActive && this.inputManager.justPressedConfirm()) {
      const nodeIndex = this.findNearestNode();
      if (nodeIndex >= 0 && !this.nodes[nodeIndex].flipped) {
        this.startCombo(nodeIndex);
      }
    }

    if (this.comboActive) {
      this.handleComboInput();
      if (Date.now() - this.comboStartMs > this.comboWindowMs) {
        this.failCombo();
      }
    }

    this.updateSnakeMovement(delta);
    this.updateProjectiles();

    this.hud.updateAll();
  }

  private findNearestNode(): number {
    let best = -1;
    let bestDist = 9999;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < scale(60) && dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  private startCombo(index: number): void {
    this.comboActive = true;
    this.comboStep = 0;
    this.comboStartMs = Date.now();
    this.activeNodeIndex = index;
    FloatingText.spawn(this, this.nodes[index].x, this.nodes[index].y - scale(20), "COMBO", "#ffd166");
  }

  private handleComboInput(): void {
    const keyQ = Phaser.Input.Keyboard.JustDown(this.inputManager.keys.Q) || Phaser.Input.Keyboard.JustDown(this.inputManager.cursors.left);
    const keyE = Phaser.Input.Keyboard.JustDown(this.inputManager.keys.E) || Phaser.Input.Keyboard.JustDown(this.inputManager.cursors.right);
    const keyShift = this.inputManager.justPressedShift();

    if (this.comboStep === 0 && keyQ) {
      this.comboStep = 1;
      return;
    }
    if (this.comboStep === 1 && keyE) {
      this.comboStep = 2;
      return;
    }
    if (this.comboStep === 2 && keyShift) {
      this.completeCombo();
      return;
    }
    if (keyQ || keyE || keyShift) {
      this.failCombo();
    }
  }

  private completeCombo(): void {
    const node = this.nodes[this.activeNodeIndex];
    node.setFlipped(true);
    this.comboActive = false;
    this.comboStep = 0;
    this.scoreSystem.addSkill(120);
    this.audio.playSfx("sfx-success", 0.5);
    FloatingText.spawn(this, node.x, node.y - scale(20), "+120", "#8fe388");

    if (this.nodes.every((n) => n.flipped)) {
      this.finishLevel();
    }
  }

  private failCombo(): void {
    this.comboActive = false;
    this.comboStep = 0;
    this.scoreSystem.addPenalty(-50);
    this.scoreSystem.breakCombo();
    this.applyDamage();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(20), "-1 HEART", "#ff6b6b");
  }

  private triggerSnakeAttack(): void {
    if (this.attackZone) {
      this.attackZone.destroy();
    }
    this.attackZone = this.add.rectangle(scaleX(320), scaleY(300), scaleX(260), scaleY(20), 0xff4d4d, 0.4);
    this.time.delayedCall(350, () => {
      const playerOnGround = this.player.body.blocked.down;
      if (playerOnGround && Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.attackZone!.getBounds())) {
        this.applyDamage();
        FloatingText.spawn(this, this.player.x, this.player.y - scale(20), "HIT", "#ff6b6b");
      }
      this.attackZone?.destroy();
      this.attackZone = undefined;
    });
  }

  private initSnakePath(): void {
    if (this.nodes.length === 0) {
      return;
    }
    this.snakeHead.set(this.nodes[0].x, this.nodes[0].y);
    const totalPoints = this.nodes.length * this.pathSpacing + 10;
    this.snakePath = [];
    for (let i = 0; i < totalPoints; i += 1) {
      this.snakePath.push(new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y));
    }
  }

  private updateSnakeMovement(delta: number): void {
    if (this.nodes.length === 0) {
      return;
    }
    const dt = delta / 1000;
    this.snakeHead.x += this.snakeDir * this.snakeSpeed * dt;
    if (this.snakeHead.x < this.snakeMinX) {
      this.snakeHead.x = this.snakeMinX;
      this.snakeDir = 1;
    } else if (this.snakeHead.x > this.snakeMaxX) {
      this.snakeHead.x = this.snakeMaxX;
      this.snakeDir = -1;
    }
    this.snakeWavePhase += delta * this.snakeWaveSpeed;
    const baseY = scaleY(220);
    this.snakeHead.y = baseY + Math.sin(this.snakeWavePhase) * this.snakeWaveAmplitude;

    this.snakePath.unshift(new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y));
    const maxLength = this.nodes.length * this.pathSpacing + 10;
    if (this.snakePath.length > maxLength) {
      this.snakePath.length = maxLength;
    }

    for (let i = 0; i < this.nodes.length; i += 1) {
      const index = Math.min(this.snakePath.length - 1, i * this.pathSpacing);
      const point = this.snakePath[index];
      this.nodes[i].setPosition(point.x, point.y);
    }
  }

  private fireSideShots(): void {
    if (this.nodes.length === 0) {
      return;
    }
    const origin = this.nodes[0];
    const speed = scale(180);
    const left = this.projectileGroup.create(origin.x, origin.y, "projectile") as Phaser.Physics.Arcade.Image;
    left.setScale(scale(1));
    left.setVelocity(-speed, 0);
    left.body.allowGravity = false;
    const right = this.projectileGroup.create(origin.x, origin.y, "projectile") as Phaser.Physics.Arcade.Image;
    right.setScale(scale(1));
    right.setVelocity(speed, 0);
    right.body.allowGravity = false;
  }

  private updateProjectiles(): void {
    this.projectileGroup.children.iterate((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj.active) {
        return false;
      }
      if (proj.x < -20 || proj.x > 660) {
        proj.destroy();
        return false;
      }
      return true;
    });
  }

  private finishLevel(): void {
    this.attackTimer?.remove();
    this.projectileTimer?.remove();
    this.scoreSystem.addBase(2000);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(500);
    }
    this.scoreSystem.applyTimeBonus(120000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, scaleX(320), scaleY(120), "+2000", "#8fe388");
    this.hud.updateAll();
    this.time.delayedCall(1400, () => this.scene.start("Level4Scene"));
  }
}

import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { SnakeNode } from "../entities/SnakeNode";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, FLOATING_TEXT, LEVEL3, MATH, PLAYER, RUN, SCALE, STAGE, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";
import { scale, scaleX, scaleY } from "../utils/layout";

export class Level3Scene extends BaseLevelScene {
  private player!: Player;
  private nodes: SnakeNode[] = [];
  private activeNodeIndex = LEVEL3.ACTIVE_NODE_NONE;
  private comboActive = false;
  private comboStep = LEVEL3.COMBO_STEP_START;
  private comboStartMs = 0;
  private comboWindowMs: number = LEVEL3.DEFAULT_COMBO_WINDOW_MS;
  private attackTimer?: Phaser.Time.TimerEvent;
  private attackZone?: Phaser.GameObjects.Rectangle;
  private projectileTimer?: Phaser.Time.TimerEvent;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private snakeHead = new Phaser.Math.Vector2(scaleX(LEVEL3.SNAKE_HEAD_X), scaleY(LEVEL3.SNAKE_HEAD_Y));
  private snakeDir: number = LEVEL3.SNAKE_DIR_RIGHT;
  private snakeSpeed = scale(LEVEL3.SNAKE_SPEED);
  private snakeWavePhase = 0;
  private snakeWaveSpeed = LEVEL3.SNAKE_WAVE_SPEED;
  private snakeWaveAmplitude = scale(LEVEL3.SNAKE_WAVE_AMPLITUDE);
  private snakePath: Phaser.Math.Vector2[] = [];
  private pathSpacing = scale(LEVEL3.PATH_SPACING);
  private snakeMinX = scaleX(LEVEL3.SNAKE_MIN_X);
  private snakeMaxX = scaleX(LEVEL3.SNAKE_MAX_X);

  constructor() {
    super("Level3Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL3);
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL3.WORLD_GRAVITY_Y;
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, LEVEL3.BG_COLOR);
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    const ground = this.physics.add
      .staticImage(scaleX(LEVEL3.GROUND_X), scaleY(LEVEL3.GROUND_Y), "platform")
      .setScale(LEVEL3.GROUND_SCALE_X * scaleX(SCALE.UNIT), LEVEL3.GROUND_SCALE_Y * scaleY(SCALE.UNIT))
      .refreshBody();

    this.player = new Player(this, scaleX(LEVEL3.PLAYER_START.x), scaleY(LEVEL3.PLAYER_START.y));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, ground);

    const diff = difficultyPresets[runState.difficulty];
    this.comboWindowMs = diff.l3.comboWindowMs;

    for (let i = 0; i < diff.l3.nodesCount; i += 1) {
      const node = new SnakeNode(
        this,
        scaleX(LEVEL3.NODE_START_X + i * LEVEL3.NODE_SPACING_X),
        scaleY(LEVEL3.NODE_START_Y),
        String(i + 1)
      );
      this.nodes.push(node);
    }
    this.initSnakePath();

    createDialogText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.TITLE_Y), "Reverse Linked List Snake", {
      maxWidth: LEVEL3.TITLE_MAX_WIDTH,
      fontSize: LEVEL3.TITLE_FONT_SIZE,
      color: "#e8eef2"
    });

    createDialogText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.SUBTITLE_Y), "Target a node, then Q -> E -> Shift", {
      maxWidth: LEVEL3.SUBTITLE_MAX_WIDTH,
      fontSize: LEVEL3.SUBTITLE_FONT_SIZE,
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
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "HIT", "#ff6b6b");
    });

    this.projectileTimer = this.time.addEvent({
      delay: LEVEL3.PROJECTILE_INTERVAL_MS,
      loop: true,
      callback: () => this.fireSideShots()
    });
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED_L3), scale(PLAYER.JUMP_L3));

    if (!this.comboActive && this.inputManager.justPressedConfirm()) {
      const nodeIndex = this.findNearestNode();
      if (nodeIndex !== LEVEL3.ACTIVE_NODE_NONE && !this.nodes[nodeIndex].flipped) {
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
    let best = LEVEL3.ACTIVE_NODE_NONE;
    let bestDist = MATH.LARGE_NUMBER;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < scale(LEVEL3.NODE_INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  private startCombo(index: number): void {
    this.comboActive = true;
    this.comboStep = LEVEL3.COMBO_STEP_START;
    this.comboStartMs = Date.now();
    this.activeNodeIndex = index;
    FloatingText.spawn(this, this.nodes[index].x, this.nodes[index].y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "COMBO", "#ffd166");
  }

  private handleComboInput(): void {
    const keyQ = Phaser.Input.Keyboard.JustDown(this.inputManager.keys.Q) || Phaser.Input.Keyboard.JustDown(this.inputManager.cursors.left);
    const keyE = Phaser.Input.Keyboard.JustDown(this.inputManager.keys.E) || Phaser.Input.Keyboard.JustDown(this.inputManager.cursors.right);
    const keyShift = this.inputManager.justPressedShift();

    if (this.comboStep === LEVEL3.COMBO_STEP_START && keyQ) {
      this.comboStep = LEVEL3.COMBO_STEP_Q;
      return;
    }
    if (this.comboStep === LEVEL3.COMBO_STEP_Q && keyE) {
      this.comboStep = LEVEL3.COMBO_STEP_E;
      return;
    }
    if (this.comboStep === LEVEL3.COMBO_STEP_E && keyShift) {
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
    this.comboStep = LEVEL3.COMBO_STEP_START;
    this.scoreSystem.addSkill(LEVEL3.COMBO_SKILL_SCORE);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    FloatingText.spawn(
      this,
      node.x,
      node.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      `+${LEVEL3.COMBO_SKILL_SCORE}`,
      "#8fe388"
    );

    if (this.nodes.every((n) => n.flipped)) {
      this.finishLevel();
    }
  }

  private failCombo(): void {
    this.comboActive = false;
    this.comboStep = LEVEL3.COMBO_STEP_START;
    this.scoreSystem.addPenalty(LEVEL3.COMBO_FAIL_PENALTY);
    this.scoreSystem.breakCombo();
    this.applyDamage();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "-1 HEART", "#ff6b6b");
  }

  private triggerSnakeAttack(): void {
    if (this.attackZone) {
      this.attackZone.destroy();
    }
    this.attackZone = this.add.rectangle(
      scaleX(LEVEL3.TITLE_X),
      scaleY(LEVEL3.ATTACK_ZONE_Y),
      scaleX(LEVEL3.ATTACK_ZONE_WIDTH),
      scaleY(LEVEL3.ATTACK_ZONE_HEIGHT),
      LEVEL3.ATTACK_ZONE_COLOR,
      LEVEL3.ATTACK_ZONE_ALPHA
    );
    this.time.delayedCall(LEVEL3.ATTACK_ZONE_DELAY_MS, () => {
      const playerOnGround = this.player.body.blocked.down;
      if (playerOnGround && Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.attackZone!.getBounds())) {
        this.applyDamage();
        FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "HIT", "#ff6b6b");
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
    const totalPoints = this.nodes.length * this.pathSpacing + LEVEL3.PATH_PADDING;
    this.snakePath = [];
    for (let i = 0; i < totalPoints; i += 1) {
      this.snakePath.push(new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y));
    }
  }

  private updateSnakeMovement(delta: number): void {
    if (this.nodes.length === 0) {
      return;
    }
    const dt = delta / TIME.MS_PER_SEC;
    this.snakeHead.x += this.snakeDir * this.snakeSpeed * dt;
    if (this.snakeHead.x < this.snakeMinX) {
      this.snakeHead.x = this.snakeMinX;
      this.snakeDir = LEVEL3.SNAKE_DIR_RIGHT;
    } else if (this.snakeHead.x > this.snakeMaxX) {
      this.snakeHead.x = this.snakeMaxX;
      this.snakeDir = LEVEL3.SNAKE_DIR_LEFT;
    }
    this.snakeWavePhase += delta * this.snakeWaveSpeed;
    const baseY = scaleY(LEVEL3.SNAKE_HEAD_Y);
    this.snakeHead.y = baseY + Math.sin(this.snakeWavePhase) * this.snakeWaveAmplitude;

    this.snakePath.unshift(new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y));
    const maxLength = this.nodes.length * this.pathSpacing + LEVEL3.PATH_PADDING;
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
    const speed = scale(LEVEL3.PROJECTILE_SPEED);
    const left = this.projectileGroup.create(origin.x, origin.y, "projectile") as Phaser.Physics.Arcade.Image;
    left.setScale(scale(SCALE.UNIT));
    left.setVelocity(-speed, 0);
    left.body.allowGravity = false;
    const right = this.projectileGroup.create(origin.x, origin.y, "projectile") as Phaser.Physics.Arcade.Image;
    right.setScale(scale(SCALE.UNIT));
    right.setVelocity(speed, 0);
    right.body.allowGravity = false;
  }

  private updateProjectiles(): void {
    this.projectileGroup.children.iterate((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj.active) {
        return false;
      }
      if (proj.x < LEVEL3.PROJECTILE_CULL_MIN_X || proj.x > LEVEL3.PROJECTILE_CULL_MAX_X) {
        proj.destroy();
        return false;
      }
      return true;
    });
  }

  private finishLevel(): void {
    this.attackTimer?.remove();
    this.projectileTimer?.remove();
    this.scoreSystem.addBase(LEVEL3.LEVEL_COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL3.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL3.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL3.COMPLETE_TEXT_X),
      scaleY(LEVEL3.COMPLETE_TEXT_Y),
      `+${LEVEL3.LEVEL_COMPLETE_SCORE}`,
      "#8fe388"
    );
    this.hud.updateAll();
    this.time.delayedCall(LEVEL3.LEVEL_COMPLETE_DELAY_MS, () => this.scene.start("Level4Scene"));
  }
}

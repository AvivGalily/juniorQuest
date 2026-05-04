import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { difficultyPresets } from "../../config/difficulty";
import { ALPHA, AUDIO, FLOATING_TEXT, LEVEL3, PLAYER, RUN, SCALE, STAGE, TEXTURES, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";
import { scale, scaleX, scaleY } from "../utils/layout";

type SnakeSegment = {
  index: number;
  x: number;
  y: number;
  image: Phaser.GameObjects.Image;
  platform: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Rectangle;
  core: Phaser.GameObjects.Ellipse;
  scanLine: Phaser.GameObjects.Rectangle;
  statusLight: Phaser.GameObjects.Arc;
  flipped: boolean;
};

type SnakeMotionPoint = {
  x: number;
  y: number;
  dx: number;
  dy: number;
};

type SnakePathPoint = {
  x: number;
  y: number;
  distance: number;
};

type TimedFireHazard = {
  object: Phaser.GameObjects.Rectangle;
  expiresAt: number;
  damageApplied: boolean;
};

export class Level3Scene extends BaseLevelScene {
  protected declare player: Player;
  private ground!: Phaser.Physics.Arcade.Image;
  private head!: Phaser.GameObjects.Image;
  private tail!: Phaser.GameObjects.Image;
  private segments: SnakeSegment[] = [];
  private links!: Phaser.GameObjects.Graphics;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private stalactiteGroup?: Phaser.Physics.Arcade.Group;
  private attackTimer?: Phaser.Time.TimerEvent;
  private stalactiteTimer?: Phaser.Time.TimerEvent;
  private completeTimer?: Phaser.Time.TimerEvent;
  private activeWarnings: Phaser.GameObjects.GameObject[] = [];
  private fireHazards: TimedFireHazard[] = [];
  private activeSegmentIndex = 0;
  private levelFinished = false;
  private cleanedUp = false;
  private snakeInitialized = false;
  private painFaceUntilMs = 0;
  private painFace?: Phaser.GameObjects.Graphics;
  private lastAttackPattern = -1;
  private attackCount = 0;
  private snakePhase = 0;
  private snakePath: SnakePathPoint[] = [];
  private snakePathDistance = 0;
  private nodeSpacing = scaleX(42);
  private readonly snakeBaseY = scaleY(LEVEL3.SNAKE_HEAD_Y);
  private readonly nodeDisplayWidth = scaleX(36);
  private readonly nodeDisplayHeight = scaleY(28);
  private readonly headDisplayWidth = scaleX(104);
  private readonly headDisplayHeight = scaleY(88);
  private readonly tailDisplayWidth = scaleX(96);
  private readonly tailDisplayHeight = scaleY(64);
  private readonly snakeWaveAmplitude = scaleY(8);
  private readonly headTrailGap = scaleX(78);
  private readonly figureEightCenterX = scaleX(320);
  private readonly figureEightAmplitudeX = scaleX(250);
  private readonly figureEightAmplitudeY = scaleY(34);
  private readonly figureEightSpeed = 0.00038;
  private readonly pathSampleSpacing = scaleX(5);

  constructor() {
    super("Level3Scene");
  }

  create(): void {
    this.cleanedUp = false;
    this.levelFinished = false;
    this.snakeInitialized = false;
    this.activeSegmentIndex = 0;
    this.painFaceUntilMs = 0;
    this.lastAttackPattern = -1;
    this.attackCount = 0;
    this.snakePhase = 0;
    this.snakePath = [];
    this.snakePathDistance = 0;
    this.segments = [];
    this.activeWarnings = [];
    this.fireHazards = [];
    this.attackTimer = undefined;
    this.stalactiteTimer = undefined;
    this.completeTimer = undefined;
    this.stalactiteGroup = undefined;
    this.painFace = undefined;
    this.initLevel(STAGE.LEVEL3);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupLevel3, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupLevel3, this);
    this.audio.playMusic("music-level3-action", AUDIO.MUSIC.LEVEL3_ACTION);
    this.physics.world.gravity.y = LEVEL3.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.add.image(this.scale.width / 2, this.scale.height / 2, "level3-snake-bg").setDisplaySize(this.scale.width, this.scale.height);

    this.ground = this.physics.add
      .staticImage(scaleX(LEVEL3.GROUND_X), scaleY(LEVEL3.GROUND_Y), "platform-smooth")
      .setScale(
        (LEVEL3.GROUND_SCALE_X * scaleX(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE,
        (LEVEL3.GROUND_SCALE_Y * scaleY(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE
      )
      .refreshBody() as Phaser.Physics.Arcade.Image;

    this.player = new Player(this, scaleX(LEVEL3.PLAYER_START.x), scaleY(LEVEL3.PLAYER_START.y));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, this.ground);

    this.links = this.add.graphics().setDepth(8);
    this.createSnake();

    createDialogText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.TITLE_Y), "Reverse Linked List Snake", {
      maxWidth: LEVEL3.TITLE_MAX_WIDTH,
      fontSize: LEVEL3.TITLE_FONT_SIZE,
      color: "#e8eef2"
    });
    createDialogText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.SUBTITLE_Y), "Jump on the glowing node, press E, dodge fire and falling spikes.", {
      maxWidth: LEVEL3.SUBTITLE_MAX_WIDTH,
      fontSize: LEVEL3.SUBTITLE_FONT_SIZE,
      color: "#cbd5e1"
    });

    this.projectileGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.projectileGroup, (_, projectile) => {
      (projectile as Phaser.GameObjects.GameObject).destroy();
      this.applyDamage();
      if (runState.hearts <= 0 || !this.isLevel3Active()) {
        return;
      }
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "FIRE", "#ff6b6b");
    });

    this.ensureStalactiteTexture();
    this.stalactiteGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.stalactiteGroup, (_, stalactite) => {
      const spike = stalactite as Phaser.Physics.Arcade.Image;
      if (!spike.active || this.levelFinished || !this.isLevel3Active()) {
        return;
      }
      spike.destroy();
      this.applyDamage();
      if (runState.hearts <= 0 || !this.isLevel3Active()) {
        return;
      }
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "SPIKE", "#ff6b6b");
    });

    this.scheduleNextAttack(850);
    this.scheduleNextStalactite(1250);
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused || this.levelFinished) {
      return;
    }

    this.updateSnakeMovement(delta);
    this.updatePainFace();
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED_L3), scale(PLAYER.JUMP_L3));
    this.updateProjectiles();
    this.updateFireHazards();
    this.updateStalactites();

    if (this.inputManager.justPressedInteract()) {
      this.tryFlipMountedSegment();
    }

    this.hud.updateAll();
  }

  private createSnake(): void {
    const diff = difficultyPresets[runState.difficulty];
    const count = Math.min(diff.l3.nodesCount, 9);
    this.nodeSpacing = Math.min(scaleX(42), (scaleX(500) - scaleX(120)) / Math.max(1, count - 1));

    this.tail = this.add.image(0, 0, "linked-snake-tail").setDisplaySize(this.tailDisplayWidth, this.tailDisplayHeight).setDepth(10);
    this.head = this.add.image(0, 0, "linked-snake-head").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight).setDepth(14);
    this.painFace = this.add.graphics().setDepth(35).setVisible(false);

    for (let i = 0; i < count; i += 1) {
      const image = this.add.image(0, 0, "linked-snake-node").setDisplaySize(this.nodeDisplayWidth, this.nodeDisplayHeight).setDepth(13);
      const platform = this.add.rectangle(0, 0, this.nodeDisplayWidth * 0.82, scaleY(8), 0xffffff, 0);
      this.physics.add.existing(platform, true);
      this.configureTopOnlyPlatform(platform);
      this.physics.add.collider(this.player, platform);

      const label = this.add
        .text(0, 0, String(i + 1), {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.round(scale(13))}px`,
          color: "#e8fff7",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(16);
      const glow = this.add
        .rectangle(0, 0, this.nodeDisplayWidth * 1.08, this.nodeDisplayHeight * 1.22)
        .setStrokeStyle(scale(2), 0xffd166, ALPHA.FULL)
        .setDepth(12)
        .setVisible(false);
      const core = this.add
        .ellipse(0, 0, this.nodeDisplayWidth * 0.42, this.nodeDisplayHeight * 0.58, 0x07151b, 0.78)
        .setStrokeStyle(scale(1), 0xff8a1a, 0.95)
        .setDepth(14);
      const scanLine = this.add
        .rectangle(0, 0, this.nodeDisplayWidth * 0.68, scaleY(3), 0x7df9ff, 0.55)
        .setDepth(15);
      const statusLight = this.add.circle(0, 0, scale(3), 0xff8a1a, 0.95).setDepth(16);

      this.segments.push({ index: i, x: 0, y: 0, image, platform, label, glow, core, scanLine, statusLight, flipped: false });
    }

    this.resetSnakePath();
    this.updateSnakePose(0);
    this.updateSegmentHighlights();
  }

  private configureTopOnlyPlatform(platform: Phaser.GameObjects.Rectangle): void {
    const body = platform.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (!body) {
      return;
    }
    body.checkCollision.up = true;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  private updateSnakeMovement(delta: number): void {
    this.snakePhase += delta * this.figureEightSpeed;
    this.recordSnakeHeadPoint();
    this.updateSnakePose(delta / TIME.MS_PER_SEC);
  }

  private getSnakeHeadPoint(): SnakeMotionPoint {
    const t = this.snakePhase;
    const primaryY = Math.sin(t * 0.9) * this.figureEightAmplitudeY;
    const rippleY = Math.sin(t * 2.3) * scaleY(7);
    return {
      x: this.figureEightCenterX + Math.sin(t) * this.figureEightAmplitudeX,
      y: this.snakeBaseY + primaryY + rippleY,
      dx: Math.cos(t) * this.figureEightAmplitudeX,
      dy: Math.cos(t * 0.9) * this.figureEightAmplitudeY * 0.9 + Math.cos(t * 2.3) * scaleY(7) * 2.3
    };
  }

  private getBodyGap(): number {
    return this.nodeSpacing * 1.12;
  }

  private getTrailVector(headPoint: SnakeMotionPoint): Phaser.Math.Vector2 {
    const trail = new Phaser.Math.Vector2(-headPoint.dx, -headPoint.dy);
    if (trail.lengthSq() < 0.001) {
      return new Phaser.Math.Vector2(-1, 0);
    }
    return trail.normalize();
  }

  private getMaxTrailDistance(): number {
    return this.headTrailGap + (this.segments.length + 2) * this.getBodyGap() + scaleX(120);
  }

  private resetSnakePath(): void {
    const headPoint = this.getSnakeHeadPoint();
    const trail = this.getTrailVector(headPoint);
    this.snakePath = [];
    this.snakePathDistance = 0;
    for (let distance = 0; distance <= this.getMaxTrailDistance(); distance += this.pathSampleSpacing) {
      this.snakePath.push({
        x: headPoint.x + trail.x * distance,
        y: headPoint.y + trail.y * distance,
        distance: -distance
      });
    }
  }

  private recordSnakeHeadPoint(): void {
    const headPoint = this.getSnakeHeadPoint();
    const previous = this.snakePath[0];
    if (!previous) {
      this.resetSnakePath();
      return;
    }
    const delta = Phaser.Math.Distance.Between(previous.x, previous.y, headPoint.x, headPoint.y);
    if (delta < 0.01) {
      return;
    }
    this.snakePathDistance += delta;
    this.snakePath.unshift({ x: headPoint.x, y: headPoint.y, distance: this.snakePathDistance });

    const trimDistance = this.snakePathDistance - this.getMaxTrailDistance() - this.pathSampleSpacing;
    while (this.snakePath.length > 2 && this.snakePath[this.snakePath.length - 1].distance < trimDistance) {
      this.snakePath.pop();
    }
  }

  private sampleSnakePath(distanceBehindHead: number): SnakePathPoint {
    const targetDistance = this.snakePathDistance - distanceBehindHead;
    const first = this.snakePath[0];
    const last = this.snakePath[this.snakePath.length - 1];
    if (!first) {
      const headPoint = this.getSnakeHeadPoint();
      return { x: headPoint.x, y: headPoint.y, distance: this.snakePathDistance };
    }
    if (!last || targetDistance >= first.distance) {
      return first;
    }
    if (targetDistance <= last.distance) {
      return last;
    }
    for (let i = 0; i < this.snakePath.length - 1; i += 1) {
      const newer = this.snakePath[i];
      const older = this.snakePath[i + 1];
      if (newer.distance >= targetDistance && older.distance <= targetDistance) {
        const span = newer.distance - older.distance || 1;
        const t = (targetDistance - older.distance) / span;
        return {
          x: Phaser.Math.Linear(older.x, newer.x, t),
          y: Phaser.Math.Linear(older.y, newer.y, t),
          distance: targetDistance
        };
      }
    }
    return last;
  }

  private updateSnakePose(dt: number): void {
    const headPoint = this.getSnakeHeadPoint();
    const bodyGap = this.getBodyGap();
    for (const segment of this.segments) {
      const point = this.sampleSnakePath(this.headTrailGap + segment.index * bodyGap);
      const previousPoint = this.sampleSnakePath(this.headTrailGap + Math.max(0, segment.index - 1) * bodyGap);
      const tangent = new Phaser.Math.Vector2(previousPoint.x - point.x, previousPoint.y - point.y);
      if (tangent.lengthSq() > 0.001) {
        tangent.normalize();
      } else {
        tangent.set(1, 0);
      }
      const normal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
      const servoWave = Math.sin(this.snakePhase * 2.4 + segment.index * 0.72) * scaleY(1.8);
      this.moveSegment(segment, point.x + normal.x * servoWave, point.y + normal.y * servoWave);
    }

    const first = this.segments[0];
    const last = this.segments[this.segments.length - 1];
    if (!first || !last) {
      return;
    }

    const headFacesRight = first.x <= headPoint.x;
    const travelAngle = Phaser.Math.RadToDeg(Math.atan2(headPoint.dy, headPoint.dx));
    const headAngle = headFacesRight ? travelAngle : Phaser.Math.Angle.WrapDegrees(travelAngle + 180);

    this.head.setPosition(headPoint.x, headPoint.y - scaleY(4));
    this.head.setFlipX(!headFacesRight);
    this.head.setAngle(Phaser.Math.Clamp(headAngle * 0.22, -10, 10) + Math.sin(this.snakePhase * 1.4) * 2);

    const tailPoint = this.sampleSnakePath(this.headTrailGap + this.segments.length * bodyGap);
    const tailX = tailPoint.x;
    const tailY = tailPoint.y;
    this.tail.setPosition(tailX, tailY + scaleY(4));
    this.tail.setFlipX(last.x > tailX);
    this.tail.setAngle(Phaser.Math.Clamp(Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(last.x, last.y, tailX, tailY)) * 0.35, -14, 14));

    this.drawLinks();
    this.carryMountedPlayer(dt);
  }

  private moveSegment(segment: SnakeSegment, x: number, y: number): void {
    const prevX = segment.x;
    const prevY = segment.y;
    segment.x = x;
    segment.y = y;
    const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(prevX, prevY, x, y));
    const displayAngle = Number.isFinite(angle) ? Phaser.Math.Clamp(angle * 0.2, -10, 10) : 0;
    segment.image.setPosition(x, y);
    segment.image.setAngle(displayAngle);
    segment.label.setPosition(x, y + scaleY(2));
    segment.glow.setPosition(x, y);
    segment.glow.setAngle(displayAngle);
    segment.core.setPosition(x, y);
    segment.core.setAngle(displayAngle);
    segment.scanLine.setPosition(x, y + Math.sin(this.snakePhase * 2 + segment.index) * scaleY(5));
    segment.scanLine.setAngle(displayAngle);
    segment.statusLight.setPosition(x + this.nodeDisplayWidth * 0.34, y - this.nodeDisplayHeight * 0.28);
    segment.platform.setPosition(x, y - this.nodeDisplayHeight / 2 + scaleY(6));
    segment.platform.setData("dx", x - prevX);
    segment.platform.setData("dy", y - prevY);
    (segment.platform.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private carryMountedPlayer(dt: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (dt <= 0 || !body?.blocked.down) {
      return;
    }
    const mountedIndex = this.getMountedSegmentIndex();
    if (mountedIndex === undefined) {
      return;
    }
    const segment = this.segments[mountedIndex];
    const dx = segment.platform.getData("dx") as number | undefined;
    const dy = segment.platform.getData("dy") as number | undefined;
    this.player.setPosition(this.player.x + (dx ?? 0), this.player.y + (dy ?? 0));
  }

  private drawLinks(): void {
    this.links.clear();
    const first = this.segments[0];
    const last = this.segments[this.segments.length - 1];
    if (!first || !last) {
      return;
    }

    this.drawArrowBetween(
      this.head.x,
      this.head.y + scaleY(6),
      this.headDisplayWidth * 0.34,
      first.x,
      first.y,
      this.nodeDisplayWidth / 2,
      this.activeSegmentIndex === 0 ? 0xffd166 : 0x66d9ef
    );

    for (const segment of this.segments) {
      const target = segment.flipped ? this.segments[segment.index - 1] : this.segments[segment.index + 1];
      if (!target) {
        continue;
      }
      const color = segment.flipped ? 0x8fe388 : segment.index === this.activeSegmentIndex ? 0xffd166 : 0x66d9ef;
      this.drawArrowBetween(segment.x, segment.y, this.nodeDisplayWidth / 2, target.x, target.y, this.nodeDisplayWidth / 2, color);
    }

    this.drawArrowBetween(last.x, last.y, this.nodeDisplayWidth / 2, this.tail.x, this.tail.y - scaleY(4), this.tailDisplayWidth * 0.25, last.flipped ? 0x8fe388 : 0x66d9ef);
  }

  private drawArrowBetween(
    fromX: number,
    fromY: number,
    fromRadius: number,
    toX: number,
    toY: number,
    toRadius: number,
    color: number
  ): void {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const startX = fromX + Math.cos(angle) * fromRadius;
    const startY = fromY + Math.sin(angle) * fromRadius;
    const endX = toX - Math.cos(angle) * toRadius;
    const endY = toY - Math.sin(angle) * toRadius;
    this.drawArrow(startX, startY, endX, endY, color);
  }

  private drawArrow(startX: number, startY: number, endX: number, endY: number, color: number): void {
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    const headLength = scale(8);
    this.links.lineStyle(scale(3), color, ALPHA.FULL);
    this.links.lineBetween(startX, startY, endX, endY);
    this.links.fillStyle(color, ALPHA.FULL);
    this.links.beginPath();
    this.links.moveTo(endX, endY);
    this.links.lineTo(endX - Math.cos(angle - 0.45) * headLength, endY - Math.sin(angle - 0.45) * headLength);
    this.links.lineTo(endX - Math.cos(angle + 0.45) * headLength, endY - Math.sin(angle + 0.45) * headLength);
    this.links.closePath();
    this.links.fillPath();
  }

  private updateSegmentHighlights(): void {
    for (const segment of this.segments) {
      const active = segment.index === this.activeSegmentIndex;
      const tint = segment.flipped ? 0x8fe388 : active ? 0xffd166 : 0xffffff;
      const accent = segment.flipped ? 0x8fe388 : active ? 0xffd166 : 0x7df9ff;
      segment.glow.setVisible(active);
      segment.image.setTint(tint);
      segment.core.setStrokeStyle(scale(active ? 2 : 1), accent, active ? ALPHA.FULL : 0.82);
      segment.scanLine.setFillStyle(accent, active ? 0.76 : 0.42);
      segment.statusLight.setFillStyle(accent, segment.flipped || active ? ALPHA.FULL : 0.7);
    }
  }

  private tryFlipMountedSegment(): void {
    const mountedIndex = this.getMountedSegmentIndex();
    if (mountedIndex === undefined) {
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "LAND ON A NODE", "#ffd166");
      return;
    }

    if (mountedIndex !== this.activeSegmentIndex) {
      this.scoreSystem.addPenalty(LEVEL3.COMBO_FAIL_PENALTY);
      this.scoreSystem.breakCombo();
      this.applyDamage();
      this.throwPlayerDown(mountedIndex);
      FloatingText.spawn(this, this.segments[mountedIndex].x, this.segments[mountedIndex].y - scale(24), "WRONG NODE", "#ff6b6b");
      return;
    }

    const segment = this.segments[mountedIndex];
    segment.flipped = true;
    this.triggerPainFace();
    this.scoreSystem.addSkill(LEVEL3.COMBO_SKILL_SCORE);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    FloatingText.spawn(this, segment.x, segment.y - scale(24), "next = prev", "#8fe388");
    this.throwPlayerDown(mountedIndex);
    this.activeSegmentIndex += 1;
    this.drawLinks();
    this.updateSegmentHighlights();

    if (this.activeSegmentIndex >= this.segments.length) {
      this.killSnake();
    }
  }

  private triggerPainFace(): void {
    this.painFaceUntilMs = this.time.now + 720;
    this.head.setTexture("linked-snake-head-hurt").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight);
    this.head.setTint(0xffd4c7);
    this.audio.playSfx("sfx-snake-hurt", AUDIO.SFX.SNAKE_HURT);
    this.time.delayedCall(720, () => {
      if (this.time.now >= this.painFaceUntilMs && !this.levelFinished && this.isLevel3Active()) {
        this.head.setTexture("linked-snake-head").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight);
        this.head.clearTint();
      }
    });
    FloatingText.spawn(this, this.head.x, this.head.y - this.headDisplayHeight * 0.42, "OUCH", "#ff8a66");
  }

  private updatePainFace(): void {
    if (!this.painFace) {
      return;
    }
    this.painFace.clear();
    if (this.time.now >= this.painFaceUntilMs || this.levelFinished) {
      this.painFace.setVisible(false);
      return;
    }

    const side = this.getHeadMouthDirection();
    const shake = Math.sin(this.time.now * 0.08) * scaleX(2.5);
    const eyeX = this.head.x + side * this.headDisplayWidth * 0.2 + shake;
    const eyeY = this.head.y - this.headDisplayHeight * 0.1;
    const mouthX = this.head.x + side * this.headDisplayWidth * 0.35 + shake;
    const mouthY = this.head.y + this.headDisplayHeight * 0.17;
    const eyeSize = scale(8);
    const zig = scale(5);

    this.painFace.setVisible(true);
    this.painFace.lineStyle(scale(3), 0xff4d4d, ALPHA.FULL);
    this.painFace.lineBetween(eyeX - eyeSize, eyeY - eyeSize, eyeX + eyeSize, eyeY + eyeSize);
    this.painFace.lineBetween(eyeX + eyeSize, eyeY - eyeSize, eyeX - eyeSize, eyeY + eyeSize);
    this.painFace.lineStyle(scale(3), 0xffd166, ALPHA.FULL);
    this.painFace.beginPath();
    this.painFace.moveTo(mouthX - zig * 2, mouthY);
    this.painFace.lineTo(mouthX - zig, mouthY + zig);
    this.painFace.lineTo(mouthX, mouthY - zig);
    this.painFace.lineTo(mouthX + zig, mouthY + zig);
    this.painFace.lineTo(mouthX + zig * 2, mouthY);
    this.painFace.strokePath();
  }

  private getMountedSegmentIndex(): number | undefined {
    const playerBounds = this.player.getBounds();
    let closestIndex: number | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const segment of this.segments) {
      const platformBounds = segment.platform.getBounds();
      const overlapsX = playerBounds.right > platformBounds.left && playerBounds.left < platformBounds.right;
      const closeToTop = Math.abs(playerBounds.bottom - platformBounds.top) <= scaleY(12);
      if (overlapsX && closeToTop) {
        if (segment.index === this.activeSegmentIndex) {
          return segment.index;
        }
        const distance = Math.abs(this.player.x - segment.x);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = segment.index;
        }
      }
    }
    return closestIndex;
  }

  private throwPlayerDown(segmentIndex: number): void {
    const segment = this.segments[segmentIndex];
    const direction = this.player.x < segment.x ? -1 : 1;
    this.player.setPosition(this.player.x + direction * scaleX(18), this.player.y + scaleY(24));
    this.player.setVelocity(direction * scaleX(90), scaleY(260));
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
  }

  private scheduleNextAttack(delayMs?: number): void {
    if (this.levelFinished) {
      return;
    }
    const diff = difficultyPresets[runState.difficulty];
    const baseDelay = Math.max(1650, diff.l3.snakeAttackIntervalMs * 0.62);
    const delay = delayMs ?? baseDelay + Phaser.Math.Between(360, 860);
    this.attackTimer?.remove(false);
    this.attackTimer = this.time.delayedCall(delay, () => {
      this.attackTimer = undefined;
      if (this.levelFinished || !this.isLevel3Active()) {
        return;
      }
      this.fireBreath();
      this.scheduleNextAttack();
    });
  }

  private fireBreath(): void {
    if (this.levelFinished || !this.isLevel3Active() || !this.projectileGroup) {
      return;
    }
    this.attackCount += 1;
    if (this.attackCount % 4 === 0) {
      this.fireSingleShot();
      this.time.delayedCall(260, () => {
        if (!this.levelFinished && this.isLevel3Active()) {
          this.fireGroundStrikes();
        }
      });
      this.lastAttackPattern = 2;
      return;
    }
    if (this.attackCount % 2 === 0) {
      this.fireSpreadShot();
      this.lastAttackPattern = 1;
      return;
    }
    this.lastAttackPattern = 0;
    this.fireSingleShot();
  }

  private fireSingleShot(): void {
    const mouth = this.getMouthPoint();
    this.drawFireJet(mouth.x, mouth.y, mouth.direction, 0.72);
    this.showMouthWarning(mouth.x, mouth.y, () => {
      const currentMouth = this.getMouthPoint();
      this.drawFireJet(currentMouth.x, currentMouth.y, currentMouth.direction, 1);
      this.spawnFireball(currentMouth.x, currentMouth.y, currentMouth.direction, this.getFireAimVelocityY(currentMouth.y), 1.12);
    });
  }

  private fireSpreadShot(): void {
    const mouth = this.getMouthPoint();
    this.drawFireJet(mouth.x, mouth.y, mouth.direction, 0.78);
    this.showMouthWarning(mouth.x, mouth.y, () => {
      const currentMouth = this.getMouthPoint();
      const aimVelocityY = this.getFireAimVelocityY(currentMouth.y);
      this.drawFireJet(currentMouth.x, currentMouth.y, currentMouth.direction, 1.12);
      this.spawnFireball(currentMouth.x, currentMouth.y - scaleY(7), currentMouth.direction, aimVelocityY - scaleY(92), 0.92);
      this.spawnFireball(currentMouth.x, currentMouth.y, currentMouth.direction, aimVelocityY, 1.04);
      this.spawnFireball(currentMouth.x, currentMouth.y + scaleY(7), currentMouth.direction, aimVelocityY + scaleY(92), 0.92);
    });
  }

  private drawFireJet(x: number, y: number, direction: number, sizeScale: number): void {
    if (this.levelFinished || !this.isLevel3Active()) {
      return;
    }
    const length = scaleX(118) * sizeScale;
    const height = scaleY(48) * sizeScale;
    const jet = this.add.graphics().setDepth(32);
    jet.fillStyle(0xff6b1a, 0.78);
    jet.fillTriangle(x, y, x + direction * length, y - height * 0.48, x + direction * length, y + height * 0.48);
    jet.fillStyle(0xffd166, 0.92);
    jet.fillTriangle(x + direction * scaleX(10), y, x + direction * length * 0.72, y - height * 0.22, x + direction * length * 0.72, y + height * 0.22);
    jet.lineStyle(scale(3), 0xfff3a3, 0.8);
    jet.lineBetween(x, y, x + direction * length * 0.86, y);
    this.activeWarnings.push(jet);
    this.tweens.add({
      targets: jet,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.25,
      duration: 440,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.activeWarnings = this.activeWarnings.filter((item) => item !== jet);
        jet.destroy();
      }
    });
  }

  private getFireAimVelocityY(fromY: number): number {
    const targetY = Phaser.Math.Clamp(this.player.y - scaleY(18), scaleY(145), scaleY(306));
    return Phaser.Math.Clamp((targetY - fromY) * 1.18, -scaleY(132), scaleY(145));
  }

  private fireGroundStrikes(): void {
    const zoneY = scaleY(LEVEL3.GROUND_Y - 42);
    const zoneWidth = scaleX(78);
    const zoneHeight = scaleY(30);
    const candidates = [
      this.player.x + Phaser.Math.Between(-scaleX(120), scaleX(120)),
      this.head.x + Phaser.Math.Between(-scaleX(160), scaleX(160)),
      Phaser.Math.Between(scaleX(150), this.scale.width - scaleX(150))
    ];

    for (const rawX of candidates.slice(0, Phaser.Math.Between(2, 3))) {
      const x = Phaser.Math.Clamp(rawX, scaleX(120), this.scale.width - scaleX(120));
      const warning = this.add.rectangle(x, zoneY, zoneWidth, zoneHeight, 0xff6b1a, 0.2).setDepth(27);
      warning.setStrokeStyle(scale(2), 0xffd166, 0.95);
      this.activeWarnings.push(warning);
      this.tweens.add({
        targets: warning,
        alpha: 0.55,
        scaleX: 1.12,
        duration: LEVEL3.ATTACK_ZONE_DELAY_MS,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut"
      });
      this.time.delayedCall(LEVEL3.ATTACK_ZONE_DELAY_MS + 420, () => {
        this.activeWarnings = this.activeWarnings.filter((item) => item !== warning);
        if (this.levelFinished || !this.isLevel3Active()) {
          warning.destroy();
          return;
        }
        const flame = this.add.rectangle(x, zoneY, zoneWidth * 1.05, zoneHeight * 1.45, 0xff6b1a, 0.72).setDepth(28);
        flame.setStrokeStyle(scale(2), 0xffd166, 0.95);
        this.activeWarnings.push(flame);
        this.fireHazards.push({ object: flame, expiresAt: this.time.now + 920, damageApplied: false });
        warning.destroy();
        this.tweens.add({
          targets: flame,
          alpha: 0,
          scaleY: 1.7,
          duration: 920,
          ease: "Sine.easeOut",
          onComplete: () => {
            this.activeWarnings = this.activeWarnings.filter((item) => item !== flame);
            this.fireHazards = this.fireHazards.filter((hazard) => hazard.object !== flame);
            flame.destroy();
          }
        });
      });
    }
  }

  private getMouthPoint(): { x: number; y: number; direction: number } {
    const mouthDirection = this.getHeadMouthDirection();
    return {
      x: this.head.x + mouthDirection * this.headDisplayWidth * 0.66,
      y: this.head.y + scaleY(12),
      direction: mouthDirection
    };
  }

  private showMouthWarning(x: number, y: number, onComplete: () => void): void {
    if (this.levelFinished || !this.isLevel3Active()) {
      return;
    }
    const warning = this.add.circle(x, y, scale(9), 0xff6b1a, 0.85).setDepth(30);
    this.activeWarnings.push(warning);
    this.tweens.add({
      targets: warning,
      scale: 1.9,
      alpha: 0.15,
      duration: LEVEL3.ATTACK_ZONE_DELAY_MS,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.activeWarnings = this.activeWarnings.filter((item) => item !== warning);
        warning.destroy();
        if (!this.levelFinished && this.isLevel3Active()) {
          onComplete();
        }
      }
    });
  }

  private getHeadMouthDirection(): number {
    const first = this.segments[0];
    if (!first) {
      return this.getSnakeHeadPoint().dx >= 0 ? 1 : -1;
    }
    return first.x <= this.head.x ? 1 : -1;
  }

  private spawnFireball(x: number, y: number, direction: number, velocityY: number, sizeScale: number): void {
    if (this.levelFinished || !this.isLevel3Active() || !this.projectileGroup) {
      return;
    }
    const muzzleFlash = this.add
      .image(x, y, "linked-snake-fireball")
      .setDisplaySize(scaleX(58) * sizeScale, scaleY(27) * sizeScale)
      .setDepth(31)
      .setFlipX(direction > 0)
      .setAlpha(0.85);
    this.tweens.add({
      targets: muzzleFlash,
      scale: 1.45,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => muzzleFlash.destroy()
    });
    const fire = this.projectileGroup.create(x, y, "linked-snake-fireball") as Phaser.Physics.Arcade.Image;
    fire.setDisplaySize(scaleX(54) * sizeScale, scaleY(25) * sizeScale);
    fire.setDepth(29);
    fire.setFlipX(direction > 0);
    const fireBody = fire.body as Phaser.Physics.Arcade.Body | null;
    if (fireBody) {
      fireBody.setAllowGravity(false);
      fireBody.setSize(fire.width * 0.62, fire.height * 0.62, true);
    }
    fire.setVelocity(direction * scale(LEVEL3.PROJECTILE_SPEED + 36), velocityY);
    this.audio.playSfx("sfx-fire-spit", AUDIO.SFX.FIRE);
  }

  private updateProjectiles(): void {
    if (!this.projectileGroup) {
      return;
    }
    this.projectileGroup.children.iterate((child) => {
      if (!child) {
        return true;
      }
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) {
        return true;
      }
      if (projectile.x < -scaleX(80) || projectile.x > this.scale.width + scaleX(80) || projectile.y > this.scale.height + scaleY(80)) {
        projectile.destroy();
      }
      return true;
    });
  }

  private updateFireHazards(): void {
    if (this.fireHazards.length === 0 || this.levelFinished || !this.isLevel3Active()) {
      return;
    }
    const playerBounds = this.player.getBounds();
    this.fireHazards = this.fireHazards.filter((hazard) => {
      if (!hazard.object.active || this.time.now >= hazard.expiresAt) {
        hazard.object.destroy();
        return false;
      }
      if (!hazard.damageApplied && Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, hazard.object.getBounds())) {
        hazard.damageApplied = true;
        this.applyDamage();
        if (runState.hearts > 0 && this.isLevel3Active()) {
          FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "BURN", "#ff6b6b");
        }
      }
      return true;
    });
  }

  private ensureStalactiteTexture(): void {
    if (this.textures.exists("level3-stalactite")) {
      return;
    }
    const g = this.add.graphics();
    g.clear();
    g.fillStyle(0x111923, 1);
    g.fillTriangle(4, 0, 60, 0, 32, 128);
    g.fillStyle(0x263746, 1);
    g.fillTriangle(10, 4, 42, 4, 32, 118);
    g.fillStyle(0x5f7384, 0.9);
    g.fillTriangle(20, 8, 35, 8, 31, 92);
    g.lineStyle(3, 0x9fb6c8, 0.9);
    g.lineBetween(4, 0, 32, 128);
    g.lineBetween(60, 0, 32, 128);
    g.lineStyle(2, 0xffd166, 0.75);
    g.lineBetween(26, 38, 36, 70);
    g.generateTexture("level3-stalactite", 64, 128);
    g.destroy();
  }

  private scheduleNextStalactite(delayMs?: number): void {
    if (this.levelFinished) {
      return;
    }
    this.stalactiteTimer?.remove(false);
    this.stalactiteTimer = this.time.delayedCall(delayMs ?? Phaser.Math.Between(1600, 2700), () => {
      this.stalactiteTimer = undefined;
      if (this.levelFinished || !this.isLevel3Active()) {
        return;
      }
      this.spawnStalactite();
      if (Phaser.Math.Between(0, 100) > 48) {
        this.time.delayedCall(260, () => this.spawnStalactite());
      }
      this.scheduleNextStalactite();
    });
  }

  private spawnStalactite(): void {
    if (this.levelFinished || !this.isLevel3Active() || !this.stalactiteGroup) {
      return;
    }
    const x = Phaser.Math.Between(scaleX(76), this.scale.width - scaleX(76));
    const warning = this.add.rectangle(x, scaleY(26), scaleX(48), scaleY(9), 0xffd166, 0.82).setDepth(45);
    warning.setStrokeStyle(scale(1), 0xff6b1a, 0.9);
    this.activeWarnings.push(warning);
    this.tweens.add({
      targets: warning,
      alpha: 0.18,
      scaleX: 1.4,
      duration: 190,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut"
    });
    this.time.delayedCall(620, () => {
      this.activeWarnings = this.activeWarnings.filter((item) => item !== warning);
      warning.destroy();
      if (this.levelFinished || !this.isLevel3Active() || !this.stalactiteGroup) {
        return;
      }
      const spike = this.stalactiteGroup.create(x, -scaleY(42), "level3-stalactite") as Phaser.Physics.Arcade.Image;
      spike.setDisplaySize(scaleX(42), scaleY(102));
      spike.setDepth(46);
      spike.setAngle(Phaser.Math.Between(-5, 5));
      spike.setVelocityY(scaleY(245 + Phaser.Math.Between(0, 82)));
      spike.setAngularVelocity(Phaser.Math.Between(-24, 24));
      const body = spike.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        body.setAllowGravity(false);
        body.setSize(spike.width * 0.48, spike.height * 0.84, true);
      }
    });
  }

  private updateStalactites(): void {
    if (!this.stalactiteGroup) {
      return;
    }
    this.stalactiteGroup.children.iterate((child) => {
      if (!child) {
        return true;
      }
      const spike = child as Phaser.Physics.Arcade.Image;
      if (!spike.active) {
        return true;
      }
      if (spike.y > this.scale.height + scaleY(90)) {
        spike.destroy();
      }
      return true;
    });
  }

  private isLevel3Active(): boolean {
    return this.scene.isActive(this.sys.settings.key);
  }

  private killSnake(): void {
    if (this.levelFinished) {
      return;
    }
    this.levelFinished = true;
    this.attackTimer?.remove();
    this.stalactiteTimer?.remove();
    this.attackTimer = undefined;
    this.stalactiteTimer = undefined;
    this.projectileGroup?.clear(true, true);
    this.stalactiteGroup?.clear(true, true);
    for (const hazard of this.fireHazards) {
      this.tweens.killTweensOf(hazard.object);
      hazard.object.destroy();
    }
    this.fireHazards = [];
    this.scoreSystem.addBase(LEVEL3.LEVEL_COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL3.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL3.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);

    const burst = this.add.image(this.head.x - scaleX(28), this.head.y + scaleY(14), "linked-snake-burst").setDisplaySize(scaleX(110), scaleY(74)).setDepth(40);
    FloatingText.spawn(this, scaleX(LEVEL3.COMPLETE_TEXT_X), scaleY(LEVEL3.COMPLETE_TEXT_Y), `+${LEVEL3.LEVEL_COMPLETE_SCORE}`, "#8fe388");

    const fadeTargets = [
      this.head,
      this.tail,
      this.links,
      ...(this.painFace ? [this.painFace] : []),
      ...this.segments.flatMap((segment) => [segment.image, segment.label, segment.glow, segment.core, segment.scanLine, segment.statusLight])
    ];
    this.tweens.add({
      targets: fadeTargets,
      alpha: 0,
      duration: LEVEL3.LEVEL_COMPLETE_DELAY_MS,
      ease: "Sine.easeIn"
    });
    this.tweens.add({
      targets: burst,
      scale: 1.25,
      alpha: 0,
      duration: LEVEL3.LEVEL_COMPLETE_DELAY_MS,
      ease: "Sine.easeOut"
    });

    this.hud.updateAll();
    this.completeTimer = this.time.delayedCall(LEVEL3.LEVEL_COMPLETE_DELAY_MS, () => {
      if (this.isLevel3Active()) {
        this.scene.start("Level4Scene");
      }
    });
  }

  private cleanupLevel3(): void {
    if (this.cleanedUp) {
      return;
    }
    this.cleanedUp = true;
    this.levelFinished = true;
    this.attackTimer?.remove(false);
    this.stalactiteTimer?.remove(false);
    this.completeTimer?.remove(false);
    this.attackTimer = undefined;
    this.stalactiteTimer = undefined;
    this.completeTimer = undefined;
    if (this.head?.active) {
      this.head.setTexture("linked-snake-head").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight);
      this.head.clearTint();
    }
    this.painFace?.clear();
    this.painFace?.setVisible(false);
    for (const hazard of this.fireHazards) {
      this.tweens.killTweensOf(hazard.object);
      hazard.object.destroy();
    }
    this.fireHazards = [];
    for (const warning of this.activeWarnings) {
      this.tweens.killTweensOf(warning);
      warning.destroy();
    }
    this.activeWarnings = [];
    if (this.projectileGroup) {
      this.projectileGroup.clear(true, true);
    }
    if (this.stalactiteGroup) {
      this.stalactiteGroup.clear(true, true);
    }
  }
}

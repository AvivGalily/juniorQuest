import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { difficultyPresets } from "../../config/difficulty";
import { ALPHA, AUDIO, FLOATING_TEXT, LEVEL3, PLAYER, RUN, SCALE, STAGE, TEXTURES, TIME } from "../../config/physics";
import { Level3Physics } from "../../config/levelPhysics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createTranslatedText } from "../utils/domText";
import { t } from "../i18n/i18n";
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
  object: Phaser.GameObjects.Zone;
  effect: Phaser.GameObjects.Sprite;
  expiresAt: number;
  damageApplied: boolean;
};

type ReverseStepKey = "SaveNext" | "ReversePointer" | "AdvancePointers";

const REVERSE_STEPS: ReverseStepKey[] = ["SaveNext", "ReversePointer", "AdvancePointers"];
const INTERVIEWER_TAUNTS = ["level3.interviewerTaunt1", "level3.interviewerTaunt2", "level3.interviewerTaunt3"] as const;

export class Level3Scene extends BaseLevelScene {
  protected declare player: Player;
  private ground!: Phaser.Physics.Arcade.Image;
  private head!: Phaser.GameObjects.Image;
  private tail!: Phaser.GameObjects.Image;
  private headPlatform!: Phaser.GameObjects.Rectangle;
  private tailPlatform!: Phaser.GameObjects.Rectangle;
  private segments: SnakeSegment[] = [];
  private links!: Phaser.GameObjects.Graphics;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private stalactiteGroup?: Phaser.Physics.Arcade.Group;
  private attackTimer?: Phaser.Time.TimerEvent;
  private stalactiteTimer?: Phaser.Time.TimerEvent;
  private completeTimer?: Phaser.Time.TimerEvent;
  private completeFallbackId?: number;
  private levelCompleteTransitionAtMs = 0;
  private levelCompleteTransitionStarted = false;
  private activeWarnings: Phaser.GameObjects.GameObject[] = [];
  private fireHazards: TimedFireHazard[] = [];
  private activeSegmentIndex = 0;
  private reverseStepIndex = 0;
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
  private nodeSpacing = scaleX(Level3Physics.snakeInitialNodeSpacing);
  private readonly snakeBaseY = scaleY(LEVEL3.SNAKE_HEAD_Y);
  private readonly nodeDisplayWidth = scaleX(Level3Physics.snakeNodeDisplayWidth);
  private readonly nodeDisplayHeight = scaleY(Level3Physics.snakeNodeDisplayHeight);
  private readonly headDisplayWidth = scaleX(Level3Physics.snakeHeadDisplayWidth);
  private readonly headDisplayHeight = scaleY(Level3Physics.snakeHeadDisplayHeight);
  private readonly tailDisplayWidth = scaleX(Level3Physics.snakeTailDisplayWidth);
  private readonly tailDisplayHeight = scaleY(Level3Physics.snakeTailDisplayHeight);
  private readonly snakeWaveAmplitude = scaleY(Level3Physics.snakeWaveAmplitudeY);
  private readonly headTrailGap = scaleX(Level3Physics.snakeHeadTrailGap);
  private readonly figureEightCenterX = scaleX(Level3Physics.snakeFigureEightCenterX);
  private readonly figureEightAmplitudeX = scaleX(Level3Physics.snakeFigureEightAmplitudeX);
  private readonly figureEightAmplitudeY = scaleY(Level3Physics.snakeFigureEightAmplitudeY);
  private readonly figureEightSpeed = 0.00038;
  private readonly pathSampleSpacing = scaleX(Level3Physics.snakePathSampleSpacing);
  private stepChips: Phaser.GameObjects.Rectangle[] = [];
  private stepTexts: Phaser.GameObjects.Text[] = [];
  private pointerLabels: Phaser.GameObjects.Text[] = [];
  private interviewerNpc?: Phaser.GameObjects.Image;
  private interviewerBubble?: Phaser.GameObjects.Rectangle;
  private interviewerText?: Phaser.GameObjects.Text;
  private interviewerTimer?: Phaser.Time.TimerEvent;
  private interviewerInitialTimer?: Phaser.Time.TimerEvent;
  private interviewerTauntIndex = 0;
  private nextInterviewerTauntAtMs = 0;
  private nextHeartPickupAtMs = 0;
  private heartPickupExpiresAtMs = 0;
  private heartPickup?: Phaser.GameObjects.Image;

  constructor() {
    super("Level3Scene");
  }

  create(): void {
    this.cleanedUp = false;
    this.levelFinished = false;
    this.snakeInitialized = false;
    this.activeSegmentIndex = 0;
    this.reverseStepIndex = 0;
    this.painFaceUntilMs = 0;
    this.lastAttackPattern = -1;
    this.attackCount = 0;
    this.interviewerTauntIndex = 0;
    this.snakePhase = 0;
    this.snakePath = [];
    this.snakePathDistance = 0;
    this.segments = [];
    this.stepChips = [];
    this.stepTexts = [];
    this.pointerLabels = [];
    this.activeWarnings = [];
    this.fireHazards = [];
    this.attackTimer = undefined;
    this.stalactiteTimer = undefined;
    this.interviewerTimer = undefined;
    this.interviewerInitialTimer = undefined;
    this.nextInterviewerTauntAtMs = 0;
    this.nextHeartPickupAtMs = 0;
    this.heartPickupExpiresAtMs = 0;
    this.completeTimer = undefined;
    this.completeFallbackId = undefined;
    this.levelCompleteTransitionAtMs = 0;
    this.levelCompleteTransitionStarted = false;
    this.stalactiteGroup = undefined;
    this.painFace = undefined;
    this.headPlatform = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.tailPlatform = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.interviewerNpc = undefined;
    this.interviewerBubble = undefined;
    this.interviewerText = undefined;
    this.heartPickup = undefined;
    this.initLevel(STAGE.LEVEL3);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupLevel3, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupLevel3, this);
    this.audio.playMusic("music-level3-action", AUDIO.MUSIC.LEVEL3_ACTION);
    this.physics.world.gravity.y = LEVEL3.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.ensureLevel3EffectAnimations();

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
    this.createReverseStepHud();
    this.createPointerLabels();
    this.createInterviewerCommentary();

    createTranslatedText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.TITLE_Y), "level3.title", {
      maxWidth: LEVEL3.TITLE_MAX_WIDTH,
      fontSize: LEVEL3.TITLE_FONT_SIZE,
      color: "#e8eef2"
    });
    createTranslatedText(this, scaleX(LEVEL3.TITLE_X), scaleY(LEVEL3.SUBTITLE_Y), "level3.subtitle", {
      maxWidth: LEVEL3.SUBTITLE_MAX_WIDTH,
      fontSize: LEVEL3.SUBTITLE_FONT_SIZE,
      color: "#cbd5e1"
    });

    this.projectileGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.projectileGroup, (_, projectile) => {
      const fireball = projectile as Phaser.Physics.Arcade.Image;
      this.spawnFireImpact(fireball.x, fireball.y, 0.58);
      fireball.destroy();
      this.applyLevel3Damage();
    });

    this.ensureStalactiteTexture();
    this.stalactiteGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.stalactiteGroup, (_, stalactite) => {
      const spike = stalactite as Phaser.Physics.Arcade.Image;
      if (!spike.active || this.levelFinished || !this.isLevel3Active()) {
        return;
      }
      this.spawnRockBurst(spike.x, Math.min(spike.y + scaleY(42), scaleY(LEVEL3.GROUND_Y - 7)), 0.72);
      spike.destroy();
      this.applyLevel3Damage();
    });

    this.scheduleNextAttack(850);
    this.scheduleNextStalactite(1250);
    this.nextInterviewerTauntAtMs = this.time.now + Level3Physics.interviewerFirstTauntDelayMs;
    this.scheduleNextHeartPickup(Level3Physics.heartPickupFirstDelayMs);
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.levelFinished) {
      this.updateLevelCompleteTransition();
      return;
    }
    if (this.paused) {
      return;
    }

    this.updateSnakeMovement(delta);
    this.updatePainFace();
    this.updatePointerLabels();
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED_L3), scale(PLAYER.JUMP_L3));
    this.updateProjectiles();
    this.updateFireHazards();
    this.updateStalactites();
    this.checkHeartPickup();
    this.updateHeartPickupSpawn();
    this.updateInterviewerTaunts();

    if (this.inputManager.justPressedInteract()) {
      this.tryFlipMountedSegment();
    }

    this.hud.updateAll();
  }

  private createSnake(): void {
    const diff = difficultyPresets[runState.difficulty];
    const count = Math.min(diff.l3.nodesCount, 9);
    this.nodeSpacing = Math.min(
      scaleX(Level3Physics.snakeInitialNodeSpacing),
      (scaleX(Level3Physics.snakePathStartX) - scaleX(Level3Physics.snakePathEndX)) / Math.max(1, count - 1)
    );

    this.tail = this.add.image(0, 0, "linked-snake-tail").setDisplaySize(this.tailDisplayWidth, this.tailDisplayHeight).setDepth(10);
    this.head = this.add.image(0, 0, "linked-snake-head").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight).setDepth(14);
    this.headPlatform = this.createSnakeRidePlatform(this.headDisplayWidth * 0.52, scaleY(9));
    this.tailPlatform = this.createSnakeRidePlatform(this.tailDisplayWidth * 0.54, scaleY(8));
    this.painFace = this.add.graphics().setDepth(35).setVisible(false);

    for (let i = 0; i < count; i += 1) {
      const image = this.add.image(0, 0, "linked-snake-node").setDisplaySize(this.nodeDisplayWidth, this.nodeDisplayHeight).setDepth(13);
      const platform = this.createSnakeRidePlatform(this.nodeDisplayWidth * 0.82, scaleY(8));

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

  private createSnakeRidePlatform(width: number, height: number): Phaser.GameObjects.Rectangle {
    const platform = this.add.rectangle(0, 0, width, height, 0xffffff, 0);
    this.physics.add.existing(platform, true);
    this.configureTopOnlyPlatform(platform);
    this.physics.add.collider(this.player, platform);
    return platform;
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
    this.moveLoosePlatform(this.headPlatform, this.head.x, this.head.y - this.headDisplayHeight * 0.34);

    const tailPoint = this.sampleSnakePath(this.headTrailGap + this.segments.length * bodyGap);
    const tailX = tailPoint.x;
    const tailY = tailPoint.y;
    this.tail.setPosition(tailX, tailY + scaleY(4));
    this.tail.setFlipX(last.x > tailX);
    this.tail.setAngle(Phaser.Math.Clamp(Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(last.x, last.y, tailX, tailY)) * 0.35, -14, 14));
    this.moveLoosePlatform(this.tailPlatform, this.tail.x, this.tail.y - this.tailDisplayHeight * 0.32);

    this.drawLinks();
    this.carryMountedPlayer(dt);
  }

  private moveLoosePlatform(platform: Phaser.GameObjects.Rectangle | undefined, x: number, y: number): void {
    const body = platform?.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (!platform || !body) {
      return;
    }
    const prevX = platform.x;
    const prevY = platform.y;
    platform.setPosition(x, y);
    platform.setData("dx", x - prevX);
    platform.setData("dy", y - prevY);
    body.updateFromGameObject();
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
    const playerBounds = this.player.getBounds();
    const mountedIndex = this.getMountedSegmentIndex();
    if (mountedIndex === undefined) {
      for (const platform of [this.headPlatform, this.tailPlatform]) {
        const platformBounds = platform?.getBounds();
        if (!platformBounds) {
          continue;
        }
        const overlapsX = playerBounds.right > platformBounds.left && playerBounds.left < platformBounds.right;
        const closeToTop = Math.abs(playerBounds.bottom - platformBounds.top) <= scaleY(12);
        if (!overlapsX || !closeToTop) {
          continue;
        }
        const dx = platform.getData("dx") as number | undefined;
        const dy = platform.getData("dy") as number | undefined;
        this.player.setPosition(this.player.x + (dx ?? 0), this.player.y + (dy ?? 0));
        return;
      }
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

  private createReverseStepHud(): void {
    const y = scaleY(82);
    const chipWidth = scaleX(126);
    const chipHeight = scaleY(22);
    const gap = scaleX(6);
    const startX = this.scale.width / 2 - chipWidth - gap;
    for (let i = 0; i < REVERSE_STEPS.length; i += 1) {
      const x = startX + i * (chipWidth + gap);
      const chip = this.add
        .rectangle(x, y, chipWidth, chipHeight, 0x102332, 0.86)
        .setStrokeStyle(scale(1), 0x38bdf8, 0.72)
        .setScrollFactor(0)
        .setDepth(1010);
      const label = this.add
        .text(x, y, t(`level3.step${REVERSE_STEPS[i]}`), {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.round(scale(10))}px`,
          color: "#cbd5e1",
          fontStyle: "bold",
          align: "center"
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1011);
      this.stepChips.push(chip);
      this.stepTexts.push(label);
    }
    this.updateReverseStepHud();
  }

  private updateReverseStepHud(): void {
    for (let i = 0; i < this.stepChips.length; i += 1) {
      const chip = this.stepChips[i];
      const label = this.stepTexts[i];
      const completed = i < this.reverseStepIndex;
      const active = i === this.reverseStepIndex && this.activeSegmentIndex < this.segments.length;
      chip.setFillStyle(completed ? 0x14532d : active ? 0x3b2f0b : 0x102332, active ? 0.94 : 0.82);
      chip.setStrokeStyle(scale(active ? 2 : 1), completed ? 0x8fe388 : active ? 0xffd166 : 0x38bdf8, active ? 1 : 0.72);
      label.setColor(completed ? "#bbf7d0" : active ? "#fef08a" : "#cbd5e1");
    }
  }

  private createPointerLabels(): void {
    const keys = ["level3.pointerPrev", "level3.pointerCurr", "level3.pointerNext"];
    this.pointerLabels = keys.map((key) =>
      this.add
        .text(0, 0, t(key), {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.round(scale(10))}px`,
          color: "#f8fafc",
          fontStyle: "bold",
          align: "center",
          backgroundColor: "#0f172acc",
          padding: { left: Math.round(scaleX(4)), right: Math.round(scaleX(4)), top: Math.round(scaleY(2)), bottom: Math.round(scaleY(2)) }
        })
        .setOrigin(0.5)
        .setDepth(38)
        .setVisible(false)
    );
    this.updatePointerLabels();
  }

  private updatePointerLabels(): void {
    const current = this.segments[this.activeSegmentIndex];
    if (!current) {
      this.pointerLabels.forEach((label) => label.setVisible(false));
      return;
    }
    const prev = this.segments[this.activeSegmentIndex - 1];
    const next = this.segments[this.activeSegmentIndex + 1];
    const entries = [
      { label: this.pointerLabels[0], node: prev, fallbackX: current.x - scaleX(55), textKey: prev ? "level3.pointerPrev" : "level3.pointerPrevNull" },
      { label: this.pointerLabels[1], node: current, fallbackX: current.x, textKey: "level3.pointerCurr" },
      { label: this.pointerLabels[2], node: next, fallbackX: current.x + scaleX(55), textKey: next ? "level3.pointerNext" : "level3.pointerNextNull" }
    ];
    for (const entry of entries) {
      if (!entry.label) {
        continue;
      }
      const x = entry.node?.x ?? entry.fallbackX;
      const y = (entry.node?.y ?? current.y) - scaleY(34);
      entry.label.setText(t(entry.textKey));
      entry.label.setPosition(x, y);
      entry.label.setVisible(true);
    }
  }

  private createInterviewerCommentary(): void {
    const npcX = scaleX(Level3Physics.interviewerNpcX);
    const npcY = scaleY(Level3Physics.interviewerNpcY);
    this.interviewerNpc = this.add
      .image(npcX, npcY, "level3-interviewer-npc")
      .setDisplaySize(scaleX(Level3Physics.interviewerNpcWidth), scaleY(Level3Physics.interviewerNpcHeight))
      .setDepth(19);
    this.interviewerBubble = this.add
      .rectangle(
        npcX - scaleX(Level3Physics.interviewerBubbleOffsetX),
        npcY - scaleY(Level3Physics.interviewerBubbleOffsetY),
        scaleX(Level3Physics.interviewerBubbleWidth),
        scaleY(Level3Physics.interviewerBubbleHeight),
        0xf8fafc,
        0.94
      )
      .setStrokeStyle(scale(1), 0x1f2937, 0.9)
      .setDepth(1018)
      .setVisible(false);
    this.interviewerText = this.add
      .text(npcX - scaleX(Level3Physics.interviewerBubbleOffsetX), npcY - scaleY(Level3Physics.interviewerBubbleOffsetY), "", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.round(scale(Level3Physics.interviewerBubbleFontSize))}px`,
        color: "#111827",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: Math.round(scaleX(Level3Physics.interviewerBubbleTextWrapWidth)) }
      })
      .setOrigin(0.5)
      .setDepth(1019)
      .setVisible(false);
  }

  private updateInterviewerTaunts(): void {
    if (
      this.levelFinished ||
      this.deathTransitioning ||
      !this.interviewerBubble ||
      !this.interviewerText ||
      !this.isLevel3Active() ||
      this.time.now < this.nextInterviewerTauntAtMs
    ) {
      return;
    }
    this.showInterviewerTaunt();
    this.nextInterviewerTauntAtMs = this.time.now + Level3Physics.interviewerTauntIntervalMs;
  }

  private showInterviewerTaunt(): void {
    if (this.levelFinished || !this.interviewerBubble || !this.interviewerText) {
      return;
    }
    const key = INTERVIEWER_TAUNTS[this.interviewerTauntIndex % INTERVIEWER_TAUNTS.length];
    this.interviewerTauntIndex += 1;
    this.tweens.killTweensOf([this.interviewerBubble, this.interviewerText]);
    this.interviewerText.setText(t(key));
    this.interviewerBubble.setAlpha(0).setVisible(true);
    this.interviewerText.setAlpha(0).setVisible(true);
    this.tweens.add({
      targets: [this.interviewerBubble, this.interviewerText],
      alpha: 1,
      duration: 150,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: [this.interviewerBubble, this.interviewerText],
      alpha: 0,
      delay: 2800,
      duration: 260,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.interviewerBubble?.setVisible(false);
        this.interviewerText?.setVisible(false);
      }
    });
  }

  private scheduleNextHeartPickup(delayMs?: number): void {
    if (this.levelFinished || this.deathTransitioning || !this.isLevel3Active()) {
      this.nextHeartPickupAtMs = 0;
      return;
    }
    const resolvedDelayMs =
      delayMs ?? Phaser.Math.Between(Level3Physics.heartPickupMinIntervalMs, Level3Physics.heartPickupMaxIntervalMs);
    this.nextHeartPickupAtMs = this.time.now + resolvedDelayMs;
  }

  private updateHeartPickupSpawn(): void {
    if (this.levelFinished || this.deathTransitioning || !this.isLevel3Active()) {
      return;
    }
    if (this.heartPickup?.active) {
      if (this.heartPickupExpiresAtMs > 0 && this.time.now >= this.heartPickupExpiresAtMs) {
        this.clearHeartPickup();
        this.scheduleNextHeartPickup();
      }
      return;
    }
    if (this.nextHeartPickupAtMs > 0 && this.time.now >= this.nextHeartPickupAtMs) {
      this.nextHeartPickupAtMs = 0;
      this.spawnHeartPickup();
    }
  }

  private spawnHeartPickup(): void {
    if (this.levelFinished || this.deathTransitioning || !this.isLevel3Active() || this.heartPickup?.active) {
      this.scheduleNextHeartPickup();
      return;
    }
    const x = Phaser.Math.Between(
      Math.round(scaleX(Level3Physics.heartPickupMarginX)),
      Math.round(this.scale.width - scaleX(Level3Physics.heartPickupMarginX))
    );
    const y = Phaser.Math.Between(Math.round(scaleY(Level3Physics.heartPickupMinY)), Math.round(scaleY(Level3Physics.heartPickupMaxY)));
    const heart = this.add
      .image(x, y, "heart_full")
      .setDisplaySize(scale(Level3Physics.heartPickupSize), scale(Level3Physics.heartPickupSize))
      .setDepth(60);
    heart.setData("collected", false);
    this.heartPickup = heart;
    this.heartPickupExpiresAtMs = this.time.now + Level3Physics.heartPickupVisibleMs;
    this.tweens.add({
      targets: heart,
      y: y - scaleY(Level3Physics.heartPickupBobY),
      scale: Level3Physics.heartPickupPulseScale,
      alpha: Level3Physics.heartPickupPulseAlpha,
      duration: Level3Physics.heartPickupPulseMs,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private checkHeartPickup(): void {
    const heart = this.heartPickup;
    if (!heart?.active || heart.getData("collected")) {
      return;
    }
    if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), heart.getBounds())) {
      this.collectHeartPickup(heart);
    }
  }

  private collectHeartPickup(heart: Phaser.GameObjects.Image): void {
    if (!heart.active || heart.getData("collected")) {
      return;
    }
    heart.setData("collected", true);
    this.clearHeartPickup();
    runState.hearts += 1;
    this.hud.updateAll();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("level3.heartPickup"), "#8fe388");
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_LIGHT);
    this.scheduleNextHeartPickup();
  }

  private clearHeartPickup(): void {
    if (!this.heartPickup?.active) {
      this.heartPickup = undefined;
      this.heartPickupExpiresAtMs = 0;
      return;
    }
    this.tweens.killTweensOf(this.heartPickup);
    this.heartPickup.destroy();
    this.heartPickup = undefined;
    this.heartPickupExpiresAtMs = 0;
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
    this.updateReverseStepHud();
    this.updatePointerLabels();
  }

  private tryFlipMountedSegment(): void {
    const mountedIndex = this.getMountedSegmentIndex();
    if (mountedIndex === undefined) {
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), t("level3.landOnNode"), "#ffd166");
      return;
    }

    if (mountedIndex !== this.activeSegmentIndex) {
      this.scoreSystem.addPenalty(LEVEL3.COMBO_FAIL_PENALTY);
      this.scoreSystem.breakCombo();
      this.reverseStepIndex = 0;
      this.updateReverseStepHud();
      const died = this.applyLevel3Damage();
      if (died || !this.isLevel3Active()) {
        return;
      }
      this.throwPlayerDown(mountedIndex);
      return;
    }

    const segment = this.segments[mountedIndex];
    const step = REVERSE_STEPS[this.reverseStepIndex];
    this.audio.playSfx("sfx-success", this.reverseStepIndex === REVERSE_STEPS.length - 1 ? AUDIO.SFX.SUCCESS_MED : AUDIO.SFX.SUCCESS_LIGHT);
    FloatingText.spawn(this, segment.x, segment.y - scale(24), t(`level3.step${step}`), this.reverseStepIndex === 1 ? "#fef08a" : "#8fe388");
    this.reverseStepIndex += 1;
    this.updateReverseStepHud();

    if (this.reverseStepIndex < REVERSE_STEPS.length) {
      return;
    }

    this.reverseStepIndex = 0;
    segment.flipped = true;
    this.triggerPainFace();
    this.scoreSystem.addSkill(LEVEL3.COMBO_SKILL_SCORE);
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
    FloatingText.spawn(this, this.head.x, this.head.y - this.headDisplayHeight * 0.42, t("level3.ouch"), "#ff8a66");
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

  private ensureLevel3EffectAnimations(): void {
    if (!this.anims.exists("level3-fire-impact")) {
      this.anims.create({
        key: "level3-fire-impact",
        frames: this.anims.generateFrameNumbers("level3-fire-impact-sheet", { start: 0, end: 5 }),
        frameRate: 9,
        repeat: 0
      });
    }
    if (!this.anims.exists("level3-rock-burst")) {
      this.anims.create({
        key: "level3-rock-burst",
        frames: this.anims.generateFrameNumbers("level3-rock-burst-sheet", { start: 0, end: 5 }),
        frameRate: 12,
        repeat: 0
      });
    }
  }

  private spawnFireImpact(x: number, y: number, sizeScale = 1): Phaser.GameObjects.Sprite | undefined {
    if (this.levelFinished || !this.isLevel3Active()) {
      return undefined;
    }
    const flame = this.add
      .sprite(x, y, "level3-fire-impact-sheet", 0)
      .setOrigin(0.5, 0.82)
      .setDisplaySize(scaleX(112) * sizeScale, scaleY(78) * sizeScale)
      .setDepth(28);
    flame.play("level3-fire-impact");
    flame.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: flame,
        alpha: 0,
        duration: 170,
        ease: "Sine.easeOut",
        onComplete: () => flame.destroy()
      });
    });
    return flame;
  }

  private spawnRockBurst(x: number, y: number, sizeScale = 1): void {
    if (this.levelFinished || !this.isLevel3Active()) {
      return;
    }
    const burst = this.add
      .sprite(x, y, "level3-rock-burst-sheet", 0)
      .setOrigin(0.5, 0.84)
      .setDisplaySize(scaleX(112) * sizeScale, scaleY(78) * sizeScale)
      .setDepth(47);
    burst.play("level3-rock-burst");
    burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: burst,
        alpha: 0,
        duration: 120,
        ease: "Sine.easeOut",
        onComplete: () => burst.destroy()
      });
    });
  }

  private destroyFireHazard(hazard: TimedFireHazard): void {
    this.tweens.killTweensOf(hazard.object);
    this.tweens.killTweensOf(hazard.effect);
    hazard.object.destroy();
    hazard.effect.destroy();
  }

  private applyLevel3Damage(): boolean {
    if (this.deathTransitioning || this.invulnerable || this.levelFinished) {
      return false;
    }
    if (runState.hearts > 1) {
      const died = super.applyDamage();
      this.hud.updateAll();
      return died;
    }

    runState.hearts = 0;
    this.comboSystem.reset();
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    this.hud.updateAll();
    this.showLevel3GameOverAndScoreboard();
    return true;
  }

  private showLevel3GameOverAndScoreboard(): void {
    if (this.deathTransitioning) {
      return;
    }
    this.deathTransitioning = true;
    this.levelFinished = true;
    this.input.enabled = false;
    this.physics.world.isPaused = false;
    this.time.timeScale = 1;
    this.stopLevel3Timers();

    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.setVelocity(0, 0);
    }

    let started = false;
    const startScoreboard = (): void => {
      if (started) {
        return;
      }
      started = true;
      this.physics.world.isPaused = false;
      this.time.timeScale = 1;
      try {
        this.scene.start("GameOverScene");
      } catch {
        this.scene.manager.start("GameOverScene");
      }
      window.setTimeout(() => {
        if (!this.scene.isActive("GameOverScene")) {
          this.scene.manager.start("GameOverScene");
        }
      }, 120);
    };

    window.setTimeout(startScoreboard, 0);
    this.time.delayedCall(1, startScoreboard);
  }

  private stopLevel3Timers(): void {
    this.attackTimer?.remove(false);
    this.stalactiteTimer?.remove(false);
    this.interviewerTimer?.remove(false);
    this.interviewerInitialTimer?.remove(false);
    this.attackTimer = undefined;
    this.stalactiteTimer = undefined;
    this.interviewerTimer = undefined;
    this.interviewerInitialTimer = undefined;
    this.nextHeartPickupAtMs = 0;
    this.heartPickupExpiresAtMs = 0;
  }

  private stopLevel3Threats(): void {
    this.stopLevel3Timers();
    this.clearArcadeGroup(this.projectileGroup);
    this.clearArcadeGroup(this.stalactiteGroup);
    for (const hazard of this.fireHazards) {
      this.destroyFireHazard(hazard);
    }
    this.fireHazards = [];
    for (const warning of this.activeWarnings) {
      this.tweens.killTweensOf(warning);
      warning.destroy();
    }
    this.activeWarnings = [];
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
    const frequency = Math.max(0.1, diff.l3.hazardFrequencyMultiplier);
    const delay = delayMs ?? (1650 + Phaser.Math.Between(360, 860)) / frequency;
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
    const flash = this.add
      .image(x + direction * scaleX(24), y, "linked-snake-fireball")
      .setDisplaySize(scaleX(38) * sizeScale, scaleY(18) * sizeScale)
      .setDepth(32)
      .setFlipX(direction > 0)
      .setAlpha(0.78);
    this.activeWarnings.push(flash);
    this.tweens.add({
      targets: flash,
      scale: 1.28,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.activeWarnings = this.activeWarnings.filter((item) => item !== flash);
        flash.destroy();
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

    for (const rawX of candidates.slice(0, 1)) {
      const x = Phaser.Math.Clamp(rawX, scaleX(120), this.scale.width - scaleX(120));
      const warning = this.add
        .sprite(x, zoneY + scaleY(8), "level3-fire-impact-sheet", 0)
        .setOrigin(0.5, 0.82)
        .setDisplaySize(zoneWidth * 1.18, zoneHeight * 2.35)
        .setAlpha(0.32)
        .setDepth(27);
      this.activeWarnings.push(warning);
      this.tweens.add({
        targets: warning,
        alpha: 0.62,
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
        const flame = this.spawnFireImpact(x, zoneY + scaleY(10), 1);
        const hazardZone = this.add.zone(x, zoneY, zoneWidth * 1.05, zoneHeight * 1.45).setOrigin(0.5);
        if (flame) {
          this.fireHazards.push({ object: hazardZone, effect: flame, expiresAt: this.time.now + 920, damageApplied: false });
        } else {
          hazardZone.destroy();
        }
        warning.destroy();
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
        this.destroyFireHazard(hazard);
        return false;
      }
      if (!hazard.damageApplied && Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, hazard.object.getBounds())) {
        hazard.damageApplied = true;
        this.applyLevel3Damage();
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
    const diff = difficultyPresets[runState.difficulty];
    const frequency = Math.max(0.1, diff.l3.hazardFrequencyMultiplier);
    this.stalactiteTimer?.remove(false);
    this.stalactiteTimer = this.time.delayedCall(
      delayMs ?? Phaser.Math.Between(Math.round(3200 / frequency), Math.round(5400 / frequency)),
      () => {
      this.stalactiteTimer = undefined;
      if (this.levelFinished || !this.isLevel3Active()) {
        return;
      }
      this.spawnStalactite();
      if (Phaser.Math.Between(0, 100) > 76) {
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
      if (spike.y + spike.displayHeight * 0.42 >= scaleY(LEVEL3.GROUND_Y - 7)) {
        this.spawnRockBurst(spike.x, scaleY(LEVEL3.GROUND_Y - 7), 0.92);
        spike.destroy();
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
    this.stopLevel3Timers();
    this.clearHeartPickup();
    this.clearArcadeGroup(this.projectileGroup);
    this.clearArcadeGroup(this.stalactiteGroup);
    for (const hazard of this.fireHazards) {
      this.destroyFireHazard(hazard);
    }
    this.fireHazards = [];
    this.scoreSystem.addBase(LEVEL3.LEVEL_COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL3.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL3.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);

    const burst = this.add.image(this.head.x - scaleX(28), this.head.y + scaleY(14), "linked-snake-burst").setDisplaySize(scaleX(110), scaleY(74)).setDepth(40);
    FloatingText.spawn(this, scaleX(LEVEL3.COMPLETE_TEXT_X), scaleY(LEVEL3.COMPLETE_TEXT_Y), t("common.points", { points: LEVEL3.LEVEL_COMPLETE_SCORE }), "#8fe388");

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
    this.scheduleLevel4Intro(LEVEL3.LEVEL_COMPLETE_DELAY_MS);
  }

  private scheduleLevel4Intro(delayMs: number): void {
    this.levelCompleteTransitionAtMs = Date.now() + delayMs;
    this.levelCompleteTransitionStarted = false;
    this.completeTimer = this.time.delayedCall(delayMs, () => this.startLevel4Intro());
    this.completeFallbackId = window.setTimeout(() => this.startLevel4Intro(), delayMs + 250);
  }

  private updateLevelCompleteTransition(): void {
    if (
      this.deathTransitioning ||
      this.levelCompleteTransitionStarted ||
      this.levelCompleteTransitionAtMs <= 0 ||
      Date.now() < this.levelCompleteTransitionAtMs
    ) {
      return;
    }
    this.startLevel4Intro();
  }

  private startLevel4Intro(): void {
    if (this.levelCompleteTransitionStarted) {
      return;
    }
    this.levelCompleteTransitionStarted = true;
    this.physics.world.isPaused = false;
    this.time.timeScale = 1;
    this.input.enabled = false;
    try {
      this.scene.start("Level4IntroScene");
    } catch {
      this.scene.manager.start("Level4IntroScene");
    }
    window.setTimeout(() => {
      if (!this.scene.isActive("Level4IntroScene")) {
        this.scene.manager.start("Level4IntroScene");
      }
    }, 120);
  }

  private cleanupLevel3(): void {
    if (this.cleanedUp) {
      return;
    }
    this.cleanedUp = true;
    this.levelFinished = true;
    if (this.deathTransitioning) {
      this.stopLevel3Timers();
      this.fireHazards = [];
      this.activeWarnings = [];
      return;
    }
    this.completeTimer?.remove(false);
    if (this.completeFallbackId !== undefined) {
      window.clearTimeout(this.completeFallbackId);
      this.completeFallbackId = undefined;
    }
    this.stopLevel3Timers();
    this.clearHeartPickup();
    this.completeTimer = undefined;
    if (this.head?.active) {
      this.head.setTexture("linked-snake-head").setDisplaySize(this.headDisplayWidth, this.headDisplayHeight);
      this.head.clearTint();
    }
    this.painFace?.clear();
    this.painFace?.setVisible(false);
    for (const hazard of this.fireHazards) {
      this.destroyFireHazard(hazard);
    }
    this.fireHazards = [];
    for (const warning of this.activeWarnings) {
      this.tweens.killTweensOf(warning);
      warning.destroy();
    }
    this.activeWarnings = [];
    this.clearArcadeGroup(this.projectileGroup);
    this.clearArcadeGroup(this.stalactiteGroup);
  }

  private clearArcadeGroup(group?: Phaser.Physics.Arcade.Group): void {
    const children = group?.children;
    if (!group || !children) {
      return;
    }
    try {
      group.clear(true, true);
    } catch {
      const entries = [...(children.entries ?? [])] as Phaser.GameObjects.GameObject[];
      for (const child of entries) {
        child.destroy();
      }
      children.clear();
    }
  }
}

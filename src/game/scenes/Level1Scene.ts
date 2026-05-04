import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Recruiter } from "../entities/recruiter/Recruiter";
import { Guard } from "../entities/guard/Guard";
import { Npc } from "../entities/npc/Npc";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, DEPTH, DOM_TEXT, FLOATING_TEXT, LEVEL1, MATH, PLAYER, RUN, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { rngInt, rngPick } from "../utils/rng";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText, setDomText } from "../utils/domText";
import { BASE_HEIGHT, getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";
import { scaleSpriteToHeight } from "../utils/spriteScale";

type RecruiterState = {
  recruiter: Recruiter;
  npcCvCount: number;
  leaving: boolean;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  barLabel: Phaser.GameObjects.DOMElement;
};

type NpcCourierState = {
  npc: Npc;
  target?: RecruiterState;
  deliveryCooldownMs: number;
  deliveredRecruiters: Set<RecruiterState>;
  lastX: number;
  lastY: number;
  lastMoveCheckAt: number;
  stuckMs: number;
};

type Level1RestartData = {
  heartsOverride?: number;
};

type TrashBinState = {
  sprite: Phaser.Physics.Arcade.Image;
  full: boolean;
};

type VisionBlocker = Phaser.Geom.Rectangle;

export class Level1Scene extends BaseLevelScene {
  private player!: Player;
  private guards: Guard[] = [];
  private guardFovs: Phaser.GameObjects.Graphics[] = [];
  private recruiterStates: RecruiterState[] = [];
  private npcCouriers: NpcCourierState[] = [];
  private targetRecruiter?: Recruiter;
  private targetCompany = "";
  private targetNoticeText?: Phaser.GameObjects.DOMElement;
  private detectionTimer = 0;
  private exposureHeat = 0;
  private exposureMeter?: {
    bg: Phaser.GameObjects.Rectangle;
    fill: Phaser.GameObjects.Rectangle;
    bulb: Phaser.GameObjects.Ellipse;
    outline: Phaser.GameObjects.Rectangle;
  };
  private dialog?: { bubble: Phaser.GameObjects.Image; label: Phaser.GameObjects.DOMElement };
  private wrongInteractions = 0;
  private hasCV = false;
  private levelCompleted = false;
  private allRecruitersGoneHandled = false;
  private cvItem?: Phaser.Physics.Arcade.Image;
  private cvLabel?: Phaser.GameObjects.DOMElement;
  private cvStartX = LEVEL1.CV_START.x;
  private cvStartY = LEVEL1.CV_START.y;
  private trashBins: TrashBinState[] = [];
  private walkableFloor!: Phaser.Geom.Polygon;
  private walkableFloorCenter!: Phaser.Math.Vector2;
  private visionBlockers: VisionBlocker[] = [];
  private cvTrashWarning?: {
    bin: TrashBinState;
    arrow: Phaser.GameObjects.Triangle;
    message: Phaser.GameObjects.DOMElement;
    tween: Phaser.Tweens.Tween;
  };

  constructor() {
    super("Level1Scene");
  }

  create(data?: Level1RestartData): void {
    this.initLevel(STAGE.LEVEL1);
    if (typeof data?.heartsOverride === "number") {
      runState.hearts = data.heartsOverride;
      this.hud.updateAll();
    }
    this.allRecruitersGoneHandled = false;
    this.audio.playMusic("music-level1-fair", AUDIO.MUSIC.LEVEL1_FAIR);
    this.physics.world.gravity.y = LEVEL1.WORLD_GRAVITY_Y;
    this.add.image(this.scale.width / 2, this.scale.height / 2, "level1-job-fair-bg").setDisplaySize(this.scale.width, this.scale.height).setDepth(0);
    this.walkableFloor = new Phaser.Geom.Polygon(LEVEL1.WALKABLE_FLOOR.map((pos) => new Phaser.Geom.Point(scaleX(pos.x), scaleY(pos.y))));
    this.walkableFloorCenter = this.getPolygonCenter(this.walkableFloor);
    this.visionBlockers = [];
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      LEVEL1.BG_COLOR,
      LEVEL1.BG_OVERLAY_ALPHA
    ).setDepth(1);
    this.createFairDecor();
    this.createLevel1HudBackplates();
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    const obstacles = this.physics.add.staticGroup();
    const boothHeight = BASE_HEIGHT * LEVEL1.BOOTH_HEIGHT_RATIO;
    const booths = LEVEL1.BOOTHS.map((pos) =>
      obstacles.create(scaleX(pos.x), scaleY(pos.y), pos.texture) as Phaser.Physics.Arcade.Image
    );
    booths.forEach((booth) => {
      scaleSpriteToHeight(booth, boothHeight);
      booth.setDepth(booth.y - booth.displayHeight * 0.3);
      booth.refreshBody();
      this.visionBlockers.push(this.getBoothVisionBlocker(booth));
    });

    const trashGroup = this.physics.add.staticGroup();
    const trashHeight = BASE_HEIGHT * LEVEL1.TRASH_HEIGHT_RATIO;
    this.trashBins = LEVEL1.TRASH_POSITIONS.map((pos) => {
      const safe = this.getSafeFloorPoint(scaleX(pos.x), scaleY(pos.y));
      const x = safe.x;
      const y = safe.y;
      const sprite = trashGroup.create(x, y, "trash-empty-crisp") as Phaser.Physics.Arcade.Image;
      scaleSpriteToHeight(sprite, trashHeight);
      sprite.setDepth(y);
      sprite.refreshBody();
      return { sprite, full: false };
    });

    const playerStart = this.getSafeFloorPoint(scaleX(LEVEL1.PLAYER_START.x), scaleY(LEVEL1.PLAYER_START.y));
    this.player = new Player(this, playerStart.x, playerStart.y);
    this.player.body.allowGravity = false;
    this.player.setCarrying(false);
    this.player.setCarryStyle("cv");
    this.setPlayer(this.player);

    const cvStart = this.getSafeFloorPoint(scaleX(LEVEL1.CV_START.x), scaleY(LEVEL1.CV_START.y));
    this.cvStartX = cvStart.x;
    this.cvStartY = cvStart.y;

    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.player, trashGroup);

    const tags = ["Cloudify", "DataNinjas", "PixelSoft", "LambdaLab", "SprintWorks", "StackLion", "ByteForge", "NodeWave", "Signal42", "BrightAI"];
    const diff = difficultyPresets[runState.difficulty];
    const hrCount = LEVEL1.RECRUITER_COUNT;
    const npcCount = LEVEL1.NPC_COUNT;
    for (let i = 0; i < hrCount; i += 1) {
      const spawn = this.getRecruiterSpawnPoint(i);
      const recruiter = new Recruiter(this, spawn.x, spawn.y, tags[i % tags.length], (i % LEVEL1.RECRUITER_VARIANT_COUNT) + 1);
      recruiter.body.allowGravity = false;
      recruiter.setInteractive({ useHandCursor: true });
      recruiter.on("pointerdown", () => this.tryRecruiterInteraction(recruiter));
      this.recruiterStates.push(this.createRecruiterState(recruiter));
      this.physics.add.collider(recruiter, obstacles);
      this.physics.add.collider(recruiter, trashGroup);
      this.physics.add.collider(this.player, recruiter);
    }

    for (let i = 0; i < npcCount; i += 1) {
      const spawn = this.getNpcSpawnPoint(i);
      const variant = ((i % LEVEL1.NPC_VARIANT_COUNT) + LEVEL1.NPC_VARIANT_MIN) as 1 | 2 | 3;
      const npc = new Npc(this, spawn.x, spawn.y, variant);
      npc.body.allowGravity = false;
      this.npcCouriers.push({
        npc,
        deliveryCooldownMs: 0,
        deliveredRecruiters: new Set<RecruiterState>(),
        lastX: npc.x,
        lastY: npc.y,
        lastMoveCheckAt: this.time.now,
        stuckMs: 0
      });
      this.physics.add.collider(npc, obstacles);
      this.physics.add.collider(npc, trashGroup);
      this.physics.add.collider(this.player, npc);
    }

    const notice = this.add
      .image(scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), "notice_board")
      .setDisplaySize(scaleX(152), scaleY(40))
      .setDepth(90);
    this.targetNoticeText = createDialogText(this, scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), "", {
      maxWidth: LEVEL1.NOTICE_MAX_WIDTH,
      fontSize: LEVEL1.NOTICE_FONT_SIZE,
      color: "#e8eef2"
    }).setDepth(91);
    const initialTarget = rngPick(this.getActiveRecruiterStates());
    this.setTargetRecruiter(initialTarget?.recruiter);

    const waypoints = LEVEL1.WAYPOINTS_1.map((pos) => this.getSafeFloorPoint(scaleX(pos.x), scaleY(pos.y)));
    const waypoints2 = LEVEL1.WAYPOINTS_2.map((pos) => this.getSafeFloorPoint(scaleX(pos.x), scaleY(pos.y)));
    const guardSpeed = scale(diff.l1.guardSpeed);
    const guardStart1 = this.getSafeFloorPoint(scaleX(LEVEL1.GUARD_STARTS[0].x), scaleY(LEVEL1.GUARD_STARTS[0].y));
    const guardStart2 = this.getSafeFloorPoint(scaleX(LEVEL1.GUARD_STARTS[1].x), scaleY(LEVEL1.GUARD_STARTS[1].y));
    this.guards = [
      new Guard(this, guardStart1.x, guardStart1.y, waypoints, guardSpeed),
      new Guard(this, guardStart2.x, guardStart2.y, waypoints2, guardSpeed)
    ];
    this.guardFovs = this.guards.map(() => this.add.graphics());
    this.guards.forEach((guard) => {
      guard.body.allowGravity = false;
      this.physics.add.collider(guard, obstacles);
    });

    this.spawnCv();
    this.updateActorDepths();
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updateTopDown(this.inputManager, scale(PLAYER.TOPDOWN_SPEED));
    this.keepSpriteOnWalkableFloor(this.player);
    this.guards.forEach((guard) => guard.update());
    this.guards.forEach((guard) => this.keepSpriteOnWalkableFloor(guard));
    this.recruiterStates.forEach((state) => {
      if (!state.leaving && state.recruiter.active) {
        state.recruiter.update(delta);
        this.keepSpriteOnWalkableFloor(state.recruiter);
      }
    });
    this.updateNpcCouriers(delta);
    this.npcCouriers.forEach((courier) => this.keepSpriteOnWalkableFloor(courier.npc));
    this.updateRecruiterBars();
    this.checkGuardDetection(delta);
    this.updateActorDepths();

    const confirmPressed = this.inputManager.justPressedConfirm();
    const interactPressed = this.inputManager.justPressedInteract();
    const pickupPressed = this.inputManager.justPressedPickup() || confirmPressed;
    const pickedUp = pickupPressed ? this.tryPickupCvOrTrash() : false;

    if (!pickedUp && (confirmPressed || interactPressed)) {
      const nearest = this.getNearestRecruiter();
      if (nearest) {
        this.tryRecruiterInteraction(nearest);
      }
    }

    this.hud.updateAll();
  }

  private createFairDecor(): void {
    const floor = this.add.graphics().setDepth(2);
    floor.fillStyle(0x2dd4bf, 0.1);
    floor.fillRoundedRect(scaleX(58), scaleY(306), scaleX(524), scaleY(18), scale(5));
    floor.fillStyle(0xffffff, 0.16);
    floor.fillRoundedRect(scaleX(116), scaleY(88), scaleX(408), scaleY(5), scale(3));
    floor.fillRoundedRect(scaleX(86), scaleY(252), scaleX(468), scaleY(4), scale(3));
    floor.lineStyle(scale(2), 0xffffff, 0.24);
    floor.lineBetween(scaleX(70), scaleY(318), scaleX(570), scaleY(318));

    const addPlant = (x: number, y: number): void => {
      const depth = y + scaleY(16);
      this.add.rectangle(x, y + scaleY(13), scaleX(15), scaleY(16), 0xe8eef2, 0.95).setStrokeStyle(scale(1), 0x94a3b8, 0.9).setDepth(depth);
      for (let i = 0; i < 5; i += 1) {
        this.add
          .ellipse(x + scaleX((i - 2) * 4), y + scaleY(2 - i), scaleX(10), scaleY(28), i % 2 === 0 ? 0x22c55e : 0x16a34a, 0.9)
          .setAngle((i - 2) * 16)
          .setDepth(depth + 1);
      }
    };

    const addBarrier = (x: number, y: number, width: number): void => {
      const postColor = 0x475569;
      this.add.rectangle(x - width / 2, y, scaleX(5), scaleY(32), postColor, 1).setDepth(y);
      this.add.rectangle(x + width / 2, y, scaleX(5), scaleY(32), postColor, 1).setDepth(y);
      this.add.rectangle(x, y - scaleY(8), width, scaleY(5), 0xf59e0b, 0.82).setDepth(y + 1);
    };

    addPlant(scaleX(38), scaleY(84));
    addPlant(scaleX(606), scaleY(84));
    addPlant(scaleX(44), scaleY(304));
    addPlant(scaleX(596), scaleY(304));
    addBarrier(scaleX(152), scaleY(286), scaleX(96));
    addBarrier(scaleX(488), scaleY(286), scaleX(96));
  }

  private createLevel1HudBackplates(): void {
    const depth = DEPTH.HUD - 1;
    const panelColor = 0x102033;
    const stage = this.add
      .rectangle(this.scale.width / 2, scaleY(17), scaleX(166), scaleY(25), panelColor, 0.48)
      .setStrokeStyle(scale(1), 0xffffff, 0.13)
      .setDepth(depth)
      .setScrollFactor(0);
    const right = this.add
      .rectangle(this.scale.width - scaleX(58), scaleY(41), scaleX(104), scaleY(70), panelColor, 0.42)
      .setStrokeStyle(scale(1), 0xffffff, 0.11)
      .setDepth(depth)
      .setScrollFactor(0);
    stage.setOrigin(0.5);
    right.setOrigin(0.5);
  }

  private getRecruiterSpawnPoint(index: number): Phaser.Math.Vector2 {
    const spots = [
      { x: 150, y: 154 },
      { x: 490, y: 154 },
      { x: 224, y: 300 },
      { x: 416, y: 300 },
      { x: 322, y: 210 }
    ];
    const spot = spots[index % spots.length];
    return this.getSafeFloorPoint(scaleX(spot.x + rngInt(-9, 9)), scaleY(spot.y + rngInt(-5, 5)));
  }

  private getNpcSpawnPoint(index: number): Phaser.Math.Vector2 {
    const spots = [
      { x: 310, y: 190 },
      { x: 342, y: 212 },
      { x: 116, y: 214 },
      { x: 520, y: 216 },
      { x: 302, y: 292 },
      { x: 338, y: 300 }
    ];
    const spot = spots[index % spots.length];
    return this.getSafeFloorPoint(scaleX(spot.x + rngInt(-16, 16)), scaleY(spot.y + rngInt(-10, 10)));
  }

  private keepSpriteOnWalkableFloor(sprite: Phaser.Physics.Arcade.Sprite): void {
    if (Phaser.Geom.Polygon.Contains(this.walkableFloor, sprite.x, sprite.y)) {
      return;
    }
    const point = this.getSafeFloorPoint(sprite.x, sprite.y);
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      const edge = this.getClosestWalkableFloorPoint(sprite.x, sprite.y);
      const tangent = new Phaser.Math.Vector2(point.y - edge.y, edge.x - point.x);
      if (tangent.lengthSq() > 0) {
        tangent.normalize();
        const tangentSpeed = body.velocity.dot(tangent);
        sprite.setVelocity(tangent.x * tangentSpeed, tangent.y * tangentSpeed);
      } else {
        sprite.setVelocity(0, 0);
      }
    }
    sprite.setPosition(point.x, point.y);
  }

  private getSafeFloorPoint(x: number, y: number): Phaser.Math.Vector2 {
    if (Phaser.Geom.Polygon.Contains(this.walkableFloor, x, y)) {
      return new Phaser.Math.Vector2(x, y);
    }
    const edgePoint = this.getClosestWalkableFloorPoint(x, y);
    const inward = new Phaser.Math.Vector2(this.walkableFloorCenter.x - edgePoint.x, this.walkableFloorCenter.y - edgePoint.y);
    if (inward.lengthSq() === 0) {
      return edgePoint;
    }
    inward.normalize().scale(scale(LEVEL1.WALKABLE_INSET));
    return new Phaser.Math.Vector2(edgePoint.x + inward.x, edgePoint.y + inward.y);
  }

  private getClosestWalkableFloorPoint(x: number, y: number): Phaser.Math.Vector2 {
    const points = this.walkableFloor.points;
    let best = new Phaser.Math.Vector2(points[0].x, points[0].y);
    let bestDist = MATH.LARGE_NUMBER;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const candidate = this.closestPointOnSegment(x, y, a.x, a.y, b.x, b.y);
      const dist = Phaser.Math.Distance.Squared(x, y, candidate.x, candidate.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return best;
  }

  private closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Phaser.Math.Vector2 {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0) {
      return new Phaser.Math.Vector2(ax, ay);
    }
    const t = Phaser.Math.Clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
    return new Phaser.Math.Vector2(ax + dx * t, ay + dy * t);
  }

  private getPolygonCenter(polygon: Phaser.Geom.Polygon): Phaser.Math.Vector2 {
    const total = polygon.points.reduce(
      (sum, point) => {
        sum.x += point.x;
        sum.y += point.y;
        return sum;
      },
      new Phaser.Math.Vector2(0, 0)
    );
    return total.scale(1 / Math.max(1, polygon.points.length));
  }

  private getBoothVisionBlocker(booth: Phaser.Physics.Arcade.Image): VisionBlocker {
    const width = booth.displayWidth * LEVEL1.VISION_BLOCKER_WIDTH_RATIO;
    const height = booth.displayHeight * LEVEL1.VISION_BLOCKER_HEIGHT_RATIO;
    const x = booth.x - width / 2;
    const y = booth.y - height / 2 + booth.displayHeight * LEVEL1.VISION_BLOCKER_OFFSET_Y_RATIO;
    return new Phaser.Geom.Rectangle(x, y, width, height);
  }

  private updateActorDepths(): void {
    this.player.setDepth(this.player.y + scaleY(12));
    this.guards.forEach((guard) => guard.setDepth(guard.y + scaleY(12)));
    this.recruiterStates.forEach((state) => {
      state.recruiter.setDepth(state.recruiter.y + scaleY(12));
      state.barBg.setDepth(state.recruiter.depth + 1);
      state.barFill.setDepth(state.recruiter.depth + 2);
      state.barLabel.setDepth(state.recruiter.depth + 3);
    });
    this.npcCouriers.forEach((courier) => courier.npc.setDepth(courier.npc.y + scaleY(12)));
    this.cvItem?.setDepth((this.cvItem.y ?? 0) + scaleY(4));
    this.cvLabel?.setDepth(900);
  }

  private createRecruiterState(recruiter: Recruiter): RecruiterState {
    const barWidth = scaleX(LEVEL1.RECRUITER_BAR_WIDTH);
    const barHeight = Math.max(2, scaleY(LEVEL1.RECRUITER_BAR_HEIGHT));
    const barY = recruiter.y - scaleY(LEVEL1.RECRUITER_BAR_OFFSET_Y);

    const barBg = this.add
      .rectangle(recruiter.x, barY, barWidth, barHeight, LEVEL1.RECRUITER_BAR_BG_COLOR, 0.9)
      .setDepth(20);
    const barFill = this.add
      .rectangle(
        recruiter.x - barWidth / 2,
        barY,
        barWidth,
        Math.max(2, barHeight - 2),
        LEVEL1.RECRUITER_BAR_FILL_COLOR,
        1
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(21);
    const barLabel = createDialogText(
      this,
      recruiter.x,
      barY - scaleY(LEVEL1.RECRUITER_BAR_LABEL_OFFSET_Y),
      `0/${LEVEL1.RECRUITER_NPC_CV_GOAL}`,
      {
        maxWidth: LEVEL1.RECRUITER_BAR_WIDTH + 30,
        fontSize: 11,
        color: "#e8eef2"
      }
    ).setDepth(22);

    return {
      recruiter,
      npcCvCount: 0,
      leaving: false,
      barBg,
      barFill,
      barLabel
    };
  }

  private updateRecruiterBars(): void {
    const barWidth = scaleX(LEVEL1.RECRUITER_BAR_WIDTH);
    const barYOffset = scaleY(LEVEL1.RECRUITER_BAR_OFFSET_Y);
    const labelYOffset = scaleY(LEVEL1.RECRUITER_BAR_LABEL_OFFSET_Y);
    for (const state of this.recruiterStates) {
      if (!state.recruiter.active) {
        continue;
      }
      const x = state.recruiter.x;
      const y = state.recruiter.y - barYOffset;
      const ratio = Phaser.Math.Clamp(state.npcCvCount / LEVEL1.RECRUITER_NPC_CV_GOAL, 0, 1);
      state.barBg.setPosition(x, y);
      state.barFill.setPosition(x - barWidth / 2, y);
      state.barFill.setScale(ratio, 1);
      state.barFill.setVisible(ratio > 0);
      state.barLabel.setPosition(x, y - labelYOffset);
      setDomText(state.barLabel, `${state.npcCvCount}/${LEVEL1.RECRUITER_NPC_CV_GOAL}`);
    }
  }

  private updateNpcCouriers(delta: number): void {
    const activeRecruiters = this.getActiveRecruiterStates();
    for (const courier of this.npcCouriers) {
      if (!courier.npc.active) {
        continue;
      }

      courier.deliveryCooldownMs = Math.max(0, courier.deliveryCooldownMs - delta);
      if (courier.deliveryCooldownMs > 0) {
        courier.target = undefined;
        courier.npc.clearMoveTarget();
        courier.npc.setVelocity(0, 0);
        this.resetCourierStuckState(courier);
        continue;
      }

      if (!courier.target || courier.target.leaving || !courier.target.recruiter.active) {
        courier.target = this.pickNpcTarget(courier, activeRecruiters);
      }

      if (courier.target) {
        const target = courier.target.recruiter;
        const approach = this.getNpcApproachPoint(courier.npc, target);
        courier.npc.setMoveTarget(approach.x, approach.y);
        const dist = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, target.x, target.y);
        if (dist <= scale(LEVEL1.NPC_DELIVERY_RANGE) && courier.deliveryCooldownMs <= 0) {
          this.handleNpcDelivery(courier, courier.target);
        }
      } else {
        courier.npc.clearMoveTarget();
      }

      courier.npc.update(delta);
      this.updateCourierStuckState(courier);
    }
  }

  private getNpcApproachPoint(npc: Npc, recruiter: Recruiter): Phaser.Math.Vector2 {
    const away = new Phaser.Math.Vector2(npc.x - recruiter.x, npc.y - recruiter.y);
    if (away.lengthSq() === 0) {
      away.set(0, 1);
    }
    away.normalize().scale(scale(LEVEL1.NPC_DELIVERY_RANGE * 0.75));
    return this.getSafeFloorPoint(recruiter.x + away.x, recruiter.y + away.y);
  }

  private updateCourierStuckState(courier: NpcCourierState): void {
    const now = this.time.now;
    const elapsed = now - courier.lastMoveCheckAt;
    if (elapsed < LEVEL1.NPC_STUCK_CHECK_MS) {
      return;
    }
    const moved = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, courier.lastX, courier.lastY);
    if (moved < scale(LEVEL1.NPC_STUCK_MOVE_EPS)) {
      courier.stuckMs += elapsed;
      if (courier.stuckMs >= LEVEL1.NPC_STUCK_LIMIT_MS) {
        this.recoverStuckCourier(courier);
        return;
      }
    } else {
      courier.stuckMs = 0;
    }
    courier.lastX = courier.npc.x;
    courier.lastY = courier.npc.y;
    courier.lastMoveCheckAt = now;
  }

  private recoverStuckCourier(courier: NpcCourierState): void {
    courier.target = undefined;
    courier.npc.clearMoveTarget();
    courier.npc.setVelocity(0, 0);
    const point = this.getSafeFloorPoint(
      courier.npc.x + scale(rngInt(-24, 24)),
      courier.npc.y + scale(rngInt(-18, 18))
    );
    courier.npc.setPosition(point.x, point.y);
    this.resetCourierStuckState(courier);
  }

  private resetCourierStuckState(courier: NpcCourierState): void {
    courier.lastX = courier.npc.x;
    courier.lastY = courier.npc.y;
    courier.lastMoveCheckAt = this.time.now;
    courier.stuckMs = 0;
  }

  private pickNpcTarget(courier: NpcCourierState, candidates: RecruiterState[]): RecruiterState | undefined {
    const openTargets = candidates.filter(
      (state) =>
        !state.leaving &&
        state.recruiter.active &&
        state.npcCvCount < LEVEL1.RECRUITER_NPC_CV_GOAL &&
        !courier.deliveredRecruiters.has(state)
    );
    if (openTargets.length === 0) {
      return undefined;
    }
    return openTargets.sort((a, b) => {
      if (a.npcCvCount !== b.npcCvCount) {
        return a.npcCvCount - b.npcCvCount;
      }
      const distA = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, a.recruiter.x, a.recruiter.y);
      const distB = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, b.recruiter.x, b.recruiter.y);
      return distA - distB;
    })[0];
  }

  private handleNpcDelivery(courier: NpcCourierState, state: RecruiterState): void {
    if (state.leaving || !state.recruiter.active) {
      return;
    }
    state.npcCvCount += 1;
    courier.deliveryCooldownMs = LEVEL1.NPC_POST_DELIVERY_WAIT_MS;
    courier.deliveredRecruiters.add(state);
    courier.target = undefined;
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);

    if (state.npcCvCount >= LEVEL1.RECRUITER_NPC_CV_GOAL) {
      this.retireRecruiter(state);
    }
  }

  private retireRecruiter(state: RecruiterState): void {
    if (state.leaving || !state.recruiter.active) {
      return;
    }
    state.leaving = true;
    state.recruiter.disableInteractive();
    state.recruiter.setVelocity(0, 0);
    if (state.recruiter.body) {
      state.recruiter.body.enable = false;
    }

    this.npcCouriers.forEach((courier) => {
      if (courier.target === state) {
        courier.target = undefined;
      }
    });

    this.showRecruiterSpeech(state.recruiter, "Finished for today!");
    if (this.targetRecruiter === state.recruiter) {
      const nextTarget = rngPick(this.getActiveRecruiterStates());
      this.setTargetRecruiter(nextTarget?.recruiter);
      this.showDialog(
        nextTarget
          ? `Target moved to ${nextTarget.recruiter.companyTag}.`
          : "All recruiters are done for today. Bring CV faster."
      );
    }

    this.time.delayedCall(LEVEL1.RECRUITER_EXIT_DELAY_MS, () => {
      if (!state.recruiter.active) {
        return;
      }
      const exitX = state.recruiter.x < this.scale.width / 2 ? -state.recruiter.displayWidth : this.scale.width + state.recruiter.displayWidth;
      this.tweens.add({
        targets: state.recruiter,
        x: exitX,
        alpha: 0,
        duration: LEVEL1.RECRUITER_EXIT_DURATION_MS,
        ease: "Sine.easeIn",
        onComplete: () => {
          state.recruiter.destroy();
          state.barBg.destroy();
          state.barFill.destroy();
          state.barLabel.destroy();
          this.recruiterStates = this.recruiterStates.filter((entry) => entry !== state);
          if (this.recruiterStates.length === 0) {
            this.onAllRecruitersGone();
          }
        }
      });
    });
  }

  private showRecruiterSpeech(recruiter: Recruiter, text: string): void {
    const bubbleY = recruiter.y - scaleY(LEVEL1.RECRUITER_RETIRE_DIALOG_OFFSET_Y);
    const bubble = this.add.image(recruiter.x, bubbleY, "speech_bubble");
    bubble.setScale(getUiScale() * 0.8);
    const label = createDialogText(this, recruiter.x, bubbleY, text, {
      maxWidth: LEVEL1.DIALOG_MAX_WIDTH,
      fontSize: LEVEL1.DIALOG_FONT_SIZE - 1,
      color: "#1b1f24",
      padding: `${LEVEL1.DIALOG_PADDING_Y}px ${LEVEL1.DIALOG_PADDING_X}px`,
      align: "center"
    });
    this.time.delayedCall(LEVEL1.RECRUITER_RETIRE_DIALOG_DURATION_MS, () => {
      bubble.destroy();
      label.destroy();
    });
  }

  private getActiveRecruiterStates(): RecruiterState[] {
    return this.recruiterStates.filter((state) => !state.leaving && state.recruiter.active);
  }

  private getRecruiterState(recruiter: Recruiter): RecruiterState | undefined {
    return this.recruiterStates.find((state) => state.recruiter === recruiter);
  }

  private setTargetRecruiter(recruiter?: Recruiter): void {
    this.getActiveRecruiterStates().forEach((state) => state.recruiter.clearTint());
    this.targetRecruiter = recruiter;
    if (recruiter) {
      recruiter.setTint(LEVEL1.TARGET_TINT);
      this.targetCompany = recruiter.companyTag;
    } else {
      this.targetCompany = "None";
    }
    if (this.targetNoticeText) {
      setDomText(this.targetNoticeText, `Target: ${this.targetCompany}`);
    }
  }

  private onAllRecruitersGone(): void {
    if (this.levelCompleted || this.allRecruitersGoneHandled) {
      return;
    }
    this.allRecruitersGoneHandled = true;
    const nextHearts = runState.hearts - 1;
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    FloatingText.spawn(
      this,
      scaleX(LEVEL1.COMPLETE_TEXT_X),
      scaleY(LEVEL1.COMPLETE_TEXT_Y),
      "-1 HEART",
      "#ff6b6b"
    );

    if (nextHearts <= 0) {
      runState.hearts = 0;
      this.scene.start("GameOverScene");
      return;
    }

    this.time.delayedCall(LEVEL1.ALL_HR_GONE_RESTART_DELAY_MS, () => {
      this.scene.restart({ heartsOverride: nextHearts });
    });
  }

  private getNearestRecruiter(): Recruiter | null {
    let best: Recruiter | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const recruiter of this.getActiveRecruiterStates().map((state) => state.recruiter)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
      if (dist < scale(LEVEL1.NEAR_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = recruiter;
      }
    }
    return best;
  }

  private tryRecruiterInteraction(recruiter: Recruiter): void {
    const state = this.getRecruiterState(recruiter);
    if (!state || state.leaving || !recruiter.active) {
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
    if (dist > scale(LEVEL1.RECRUITER_INTERACT_RANGE)) {
      return;
    }
    if (!this.targetRecruiter) {
      this.showDialog("No open target at the moment.");
      return;
    }
    if (!this.hasCV) {
      this.showDialog("Pick up your CV first.");
      return;
    }
    if (this.targetRecruiter === recruiter) {
      this.showDialog("Thank you for applying, but you still don't have enough experience.");
      this.hasCV = false;
      this.player.setCarrying(false);
      this.completeLevel();
    } else {
      this.wrongInteractions += 1;
      const line = rngPick([
        "Send it by email.",
        "We're hiring seniors.",
        "Try the booth next door."
      ]);
      this.showDialog(line);
      this.scoreSystem.addPenalty(LEVEL1.WRONG_INTERACTION_PENALTY);
      this.scoreSystem.breakCombo();
      this.hasCV = false;
      this.player.setCarrying(false);
      this.placeCvInTrash();
    }
  }

  private spawnCv(): void {
    this.cvItem?.destroy();
    this.cvLabel?.destroy();
    this.cvItem = this.physics.add.staticImage(this.cvStartX, this.cvStartY, "cv");
    this.cvItem.setScale(scale(LEVEL1.CV_ICON_SIZE) / LEVEL1.CV_ICON_SIZE);
    this.cvItem.refreshBody();
    this.cvLabel = createDialogText(this, this.cvStartX + scaleX(LEVEL1.CV_LABEL_OFFSET_X), this.cvStartY, "Pick up CV", {
      maxWidth: LEVEL1.CV_LABEL_MAX_WIDTH,
      fontSize: LEVEL1.CV_LABEL_FONT_SIZE,
      color: "#e8eef2",
      align: "left",
      originX: DOM_TEXT.ORIGIN_LEFT
    });
  }

  private pickupCv(): void {
    if (this.hasCV) {
      return;
    }
    this.hasCV = true;
    this.player.setCarrying(true);
    this.cvItem?.destroy();
    this.cvItem = undefined;
    this.cvLabel?.destroy();
    this.cvLabel = undefined;
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_LIGHT);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "CV COLLECTED", "#8fe388");
  }

  private tryPickupCvOrTrash(): boolean {
    if (this.hasCV) {
      return false;
    }
    if (this.cvItem && this.isNear(this.cvItem.x, this.cvItem.y, scale(LEVEL1.NEAR_RANGE))) {
      this.pickupCv();
      return true;
    }
    const bin = this.getNearestFullTrash();
    if (bin && this.isNear(bin.sprite.x, bin.sprite.y, scale(LEVEL1.NEAR_RANGE))) {
      this.takeCvFromTrash(bin);
      return true;
    }
    return false;
  }

  private getNearestFullTrash(): TrashBinState | null {
    let best: TrashBinState | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const bin of this.trashBins) {
      if (!bin.full) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bin.sprite.x, bin.sprite.y);
      if (dist < scale(LEVEL1.TRASH_FULL_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = bin;
      }
    }
    return best;
  }

  private takeCvFromTrash(bin: TrashBinState): void {
    if (this.hasCV) {
      return;
    }
    bin.full = false;
    bin.sprite.setTexture("trash-empty-crisp");
    this.hideTrashWarning(bin);
    this.hasCV = true;
    this.player.setCarrying(true);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_LIGHT);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "CV RECOVERED", "#8fe388");
  }

  private placeCvInTrash(): void {
    const emptyBin = this.trashBins.find((bin) => !bin.full);
    const target = emptyBin ?? this.trashBins[0];
    if (!target) {
      return;
    }
    target.full = true;
    target.sprite.setTexture("trash-full-crisp");
    this.showTrashWarning(target);
  }

  private showTrashWarning(bin: TrashBinState): void {
    this.hideTrashWarning();
    const arrowY = bin.sprite.y - scaleY(LEVEL1.TRASH_WARNING_ARROW_OFFSET_Y);
    const messageY = bin.sprite.y - scaleY(LEVEL1.TRASH_WARNING_OFFSET_Y);
    const arrow = this.add
      .triangle(
        bin.sprite.x,
        arrowY,
        0,
        0,
        scaleX(LEVEL1.TRASH_WARNING_ARROW_WIDTH),
        0,
        scaleX(LEVEL1.TRASH_WARNING_ARROW_WIDTH / 2),
        scaleY(LEVEL1.TRASH_WARNING_ARROW_HEIGHT),
        0xffd166
      )
      .setOrigin(0.5)
      .setDepth(120);
    const message = createDialogText(
      this,
      bin.sprite.x,
      messageY,
      "אוי לא, זרקו את קורות החיים שלך. אנא אסוף אותם בחזרה",
      {
        maxWidth: LEVEL1.TRASH_WARNING_MAX_WIDTH,
        fontSize: LEVEL1.TRASH_WARNING_FONT_SIZE,
        color: "#ffd166",
        align: "center"
      }
    ).setDepth(121);
    const tween = this.tweens.add({
      targets: arrow,
      y: arrowY + scaleY(LEVEL1.TRASH_WARNING_BOB_Y),
      duration: LEVEL1.TRASH_WARNING_BOB_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.cvTrashWarning = { bin, arrow, message, tween };
  }

  private hideTrashWarning(bin?: TrashBinState): void {
    if (!this.cvTrashWarning || (bin && this.cvTrashWarning.bin !== bin)) {
      return;
    }
    this.cvTrashWarning.tween.stop();
    this.cvTrashWarning.arrow.destroy();
    this.cvTrashWarning.message.destroy();
    this.cvTrashWarning = undefined;
  }

  private isNear(x: number, y: number, range: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    return dist <= range;
  }

  private showDialog(text: string): void {
    if (this.dialog) {
      this.dialog.bubble.destroy();
      this.dialog.label.destroy();
      this.dialog = undefined;
    }
    const bubble = this.add.image(scaleX(LEVEL1.DIALOG_X), scaleY(LEVEL1.DIALOG_Y), "speech_bubble");
    bubble.setScale(getUiScale());
    const label = createDialogText(this, scaleX(LEVEL1.DIALOG_X), scaleY(LEVEL1.DIALOG_Y), text, {
      maxWidth: LEVEL1.DIALOG_MAX_WIDTH,
      fontSize: LEVEL1.DIALOG_FONT_SIZE,
      color: "#1b1f24",
      padding: `${LEVEL1.DIALOG_PADDING_Y}px ${LEVEL1.DIALOG_PADDING_X}px`,
      align: "center"
    });
    this.dialog = { bubble, label };
    this.time.delayedCall(LEVEL1.DIALOG_DURATION_MS, () => {
      if (this.dialog) {
        this.dialog.bubble.destroy();
        this.dialog.label.destroy();
        this.dialog = undefined;
      }
    });
  }

  private checkGuardDetection(delta: number): void {
    const diff = difficultyPresets[runState.difficulty];
    const range = scale(LEVEL1.GUARD_DETECTION_RANGE);
    const fovRad = Phaser.Math.DegToRad(diff.l1.guardFovDeg);
    let hottestRate = 0;
    let catchingGuard: Guard | undefined;
    this.guards.forEach((guard, index) => {
      const facing = guard.getFacingAngle();
      const angleToPlayer = Phaser.Math.Angle.Between(guard.x, guard.y, this.player.x, this.player.y);
      const dist = Phaser.Math.Distance.Between(guard.x, guard.y, this.player.x, this.player.y);
      const angleDiff = Phaser.Math.Angle.Wrap(angleToPlayer - facing);
      const guardSees = dist < range && Math.abs(angleDiff) < fovRad / 2 && !this.isVisionBlocked(guard.x, guard.y, this.player.x, this.player.y);
      if (guardSees) {
        const proximity = Phaser.Math.Clamp(1 - dist / range, 0, 1);
        const rate = Phaser.Math.Linear(LEVEL1.EXPOSURE_MIN_RATE, LEVEL1.EXPOSURE_MAX_RATE, proximity);
        if (rate > hottestRate) {
          hottestRate = rate;
          catchingGuard = guard;
        }
      }
      this.drawGuardFov(this.guardFovs[index], guard, range, fovRad, facing);
    });

    if (hottestRate > 0) {
      this.exposureHeat = Phaser.Math.Clamp(this.exposureHeat + (delta / diff.l1.detectionHoldMs) * hottestRate, 0, 1);
    } else {
      this.exposureHeat = Phaser.Math.Clamp(this.exposureHeat - delta / LEVEL1.EXPOSURE_COOL_MS, 0, 1);
    }
    this.updateExposureMeter();

    if (this.exposureHeat >= 1) {
      this.exposureHeat = 0;
      this.updateExposureMeter();
      this.scoreSystem.addPenalty(LEVEL1.DETECTION_PENALTY);
      this.scoreSystem.breakCombo();
      if (catchingGuard) {
        this.showGuardCaughtSpeech(catchingGuard);
      }
      this.applyDamage(() => {
        const respawn = this.getSafeFloorPoint(scaleX(LEVEL1.PLAYER_START.x), scaleY(LEVEL1.PLAYER_START.y));
        this.player.setPosition(respawn.x, respawn.y);
      });
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "-1 HEART", "#ff6b6b");
    }
  }

  private updateExposureMeter(): void {
    if (this.exposureHeat <= 0) {
      this.destroyExposureMeter();
      return;
    }
    if (!this.exposureMeter) {
      const width = scaleX(LEVEL1.EXPOSURE_METER_WIDTH);
      const height = scaleY(LEVEL1.EXPOSURE_METER_HEIGHT);
      const bg = this.add.rectangle(0, 0, width, height, 0x101820, 0.72).setDepth(210);
      const fill = this.add.rectangle(0, 0, width - scaleX(3), height, 0x22c55e, 1).setOrigin(0.5, 1).setDepth(211);
      const bulb = this.add.ellipse(0, 0, width * 1.45, width * 1.45, 0x22c55e, 1).setDepth(211);
      const outline = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setStrokeStyle(scale(1), 0xe8eef2, 0.92).setDepth(212);
      bulb.setStrokeStyle(scale(1), 0xe8eef2, 0.92);
      this.exposureMeter = { bg, fill, bulb, outline };
    }
    const width = scaleX(LEVEL1.EXPOSURE_METER_WIDTH);
    const height = scaleY(LEVEL1.EXPOSURE_METER_HEIGHT);
    const x = this.player.x + scaleX(LEVEL1.EXPOSURE_METER_OFFSET_X);
    const y = this.player.y - scaleY(LEVEL1.EXPOSURE_METER_OFFSET_Y);
    const green = Phaser.Display.Color.ValueToColor(0x22c55e);
    const red = Phaser.Display.Color.ValueToColor(0xef4444);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(green, red, 100, Math.round(this.exposureHeat * 100));
    const color = Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
    this.exposureMeter.bg.setPosition(x, y);
    this.exposureMeter.outline.setPosition(x, y);
    this.exposureMeter.bulb.setPosition(x, y + height / 2 + scaleY(5)).setFillStyle(color, 1);
    this.exposureMeter.fill
      .setPosition(x, y + height / 2 - scaleY(2))
      .setDisplaySize(width - scaleX(3), Math.max(scaleY(2), (height - scaleY(4)) * this.exposureHeat))
      .setFillStyle(color, 1);
  }

  private destroyExposureMeter(): void {
    if (!this.exposureMeter) {
      return;
    }
    this.exposureMeter.bg.destroy();
    this.exposureMeter.fill.destroy();
    this.exposureMeter.bulb.destroy();
    this.exposureMeter.outline.destroy();
    this.exposureMeter = undefined;
  }

  private showGuardCaughtSpeech(guard: Guard): void {
    const bubbleY = guard.y - scaleY(LEVEL1.RECRUITER_RETIRE_DIALOG_OFFSET_Y);
    const bubble = this.add.image(guard.x, bubbleY, "speech_bubble").setDepth(220);
    bubble.setScale(getUiScale() * 0.9);
    const label = createDialogText(this, guard.x, bubbleY, "היי אתה לא שייך לכאן, תעוף מפה", {
      maxWidth: LEVEL1.DIALOG_MAX_WIDTH,
      fontSize: LEVEL1.DIALOG_FONT_SIZE - 1,
      color: "#1b1f24",
      padding: `${LEVEL1.DIALOG_PADDING_Y}px ${LEVEL1.DIALOG_PADDING_X}px`,
      align: "center"
    }).setDepth(221);
    this.time.delayedCall(LEVEL1.CAUGHT_DIALOG_DURATION_MS, () => {
      bubble.destroy();
      label.destroy();
    });
  }

  private drawGuardFov(
    graphics: Phaser.GameObjects.Graphics | undefined,
    guard: Guard,
    range: number,
    fovRad: number,
    facing: number
  ): void {
    if (!graphics) {
      return;
    }
    graphics.clear();
    graphics.fillStyle(LEVEL1.FOV_COLOR, LEVEL1.FOV_ALPHA);
    graphics.beginPath();
    graphics.moveTo(guard.x, guard.y);
    for (let i = 0; i <= LEVEL1.FOV_RAY_COUNT; i += 1) {
      const t = i / LEVEL1.FOV_RAY_COUNT;
      const angle = facing - fovRad / 2 + fovRad * t;
      const end = this.getGuardFovRayEnd(guard.x, guard.y, angle, range);
      graphics.lineTo(end.x, end.y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  private isVisionBlocked(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const end = new Phaser.Math.Vector2(toX, toY);
    for (const blocker of this.visionBlockers) {
      const hit = this.getSegmentRectIntersection(fromX, fromY, toX, toY, blocker);
      if (hit && Phaser.Math.Distance.Squared(fromX, fromY, hit.x, hit.y) < Phaser.Math.Distance.Squared(fromX, fromY, end.x, end.y)) {
        return true;
      }
    }
    return false;
  }

  private getGuardFovRayEnd(x: number, y: number, angle: number, range: number): Phaser.Math.Vector2 {
    const rayEnd = new Phaser.Math.Vector2(x + Math.cos(angle) * range, y + Math.sin(angle) * range);
    let best = rayEnd;
    let bestDist = Phaser.Math.Distance.Squared(x, y, rayEnd.x, rayEnd.y);
    for (const blocker of this.visionBlockers) {
      const hit = this.getSegmentRectIntersection(x, y, rayEnd.x, rayEnd.y, blocker);
      if (!hit) {
        continue;
      }
      const dist = Phaser.Math.Distance.Squared(x, y, hit.x, hit.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = hit;
      }
    }
    return best;
  }

  private getSegmentRectIntersection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    rect: Phaser.Geom.Rectangle
  ): Phaser.Math.Vector2 | null {
    const edges = [
      [rect.left, rect.top, rect.right, rect.top],
      [rect.right, rect.top, rect.right, rect.bottom],
      [rect.right, rect.bottom, rect.left, rect.bottom],
      [rect.left, rect.bottom, rect.left, rect.top]
    ];
    let best: Phaser.Math.Vector2 | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const [ax, ay, bx, by] of edges) {
      const hit = this.getSegmentIntersection(fromX, fromY, toX, toY, ax, ay, bx, by);
      if (!hit) {
        continue;
      }
      const dist = Phaser.Math.Distance.Squared(fromX, fromY, hit.x, hit.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = hit;
      }
    }
    return best;
  }

  private getSegmentIntersection(
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number
  ): Phaser.Math.Vector2 | null {
    const s1x = p1x - p0x;
    const s1y = p1y - p0y;
    const s2x = p3x - p2x;
    const s2y = p3y - p2y;
    const denom = -s2x * s1y + s1x * s2y;
    if (Math.abs(denom) < 0.0001) {
      return null;
    }
    const s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / denom;
    const t = (s2x * (p0y - p2y) - s2y * (p0x - p2x)) / denom;
    if (s < 0 || s > 1 || t < 0 || t > 1) {
      return null;
    }
    return new Phaser.Math.Vector2(p0x + t * s1x, p0y + t * s1y);
  }

  private completeLevel(): void {
    if (this.levelCompleted) {
      return;
    }
    this.levelCompleted = true;
    this.scoreSystem.addBase(LEVEL1.LEVEL_COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL1.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL1.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL1.COMPLETE_TEXT_X),
      scaleY(LEVEL1.COMPLETE_TEXT_Y),
      `+${LEVEL1.LEVEL_COMPLETE_SCORE}`,
      "#8fe388"
    );
    this.hud.updateAll();

    this.time.delayedCall(LEVEL1.LEVEL_COMPLETE_DELAY_MS, () => {
      this.scene.start("Level2Scene");
    });
  }
}

import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Rival } from "../entities/Rival";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, FLOATING_TEXT, LEVEL4, MATH, RUN, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createTranslatedText } from "../utils/domText";
import { t } from "../i18n/i18n";
import { rngInt } from "../utils/rng";
import { scale, scaleX, scaleY } from "../utils/layout";
import { scaleSpriteToHeight } from "../utils/spriteScale";

type TowerPlatform = {
  index: number;
  image: Phaser.Physics.Arcade.Image;
  x: number;
  y: number;
  width: number;
};

type Professional = {
  sprite: Phaser.GameObjects.Image;
  used: boolean;
};

type MovingHazard = {
  sprite: Phaser.Physics.Arcade.Image;
  kind: "octocat" | "python";
  left: number;
  right: number;
  speed: number;
  dir: -1 | 1;
};

type TripHazard = {
  visual: Phaser.GameObjects.Rectangle;
  expiresAt: number;
  owner: Rival;
};

type Level4RestartData = {
  heartsOverride?: number;
};

export class Level4Scene extends BaseLevelScene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private dockerGroup!: Phaser.Physics.Arcade.StaticGroup;
  private towerPlatforms: TowerPlatform[] = [];
  private professionals: Professional[] = [];
  private rivals: Rival[] = [];
  private movingHazards: MovingHazard[] = [];
  private tripHazards: TripHazard[] = [];
  private doorZone!: Phaser.GameObjects.Rectangle;
  private cameraScrollY = 0;
  private maxCameraScrollY = 0;
  private pushStrength = scale(LEVEL4.DEFAULT_PUSH_STRENGTH);
  private lastHazardHitAt = 0;
  private lastDockerBoostAt = 0;
  private levelCompleted = false;

  constructor() {
    super("Level4Scene");
  }

  create(data?: Level4RestartData): void {
    this.resetSceneState();
    this.initLevel(STAGE.LEVEL4);
    if (typeof data?.heartsOverride === "number") {
      runState.hearts = data.heartsOverride;
      this.hud.updateAll();
    }
    this.ensureLevel4Textures();
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSceneState());
    this.physics.world.gravity.y = LEVEL4.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, scaleY(LEVEL4.WORLD_HEIGHT));
    this.cameras.main.setBounds(0, 0, this.scale.width, scaleY(LEVEL4.WORLD_HEIGHT));
    this.maxCameraScrollY = Math.max(0, scaleY(LEVEL4.WORLD_HEIGHT) - this.scale.height);
    this.cameraScrollY = this.maxCameraScrollY;
    this.cameras.main.setScroll(0, this.cameraScrollY);

    this.createOfficeTowerBackground();
    this.createPlatforms();
    this.createFinishGate();

    this.player = new Player(this, scaleX(LEVEL4.PLAYER_START.x), scaleY(LEVEL4.PLAYER_START.y));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, this.platforms);

    const diff = difficultyPresets[runState.difficulty];
    this.pushStrength = scale(diff.l4.pushStrength);
    this.createProfessionals();
    this.createBoostsAndHazards();
    this.createRivals(diff.l4.rivalsCount);

    createTranslatedText(this, this.scale.width / 2, scaleY(18), "level4.title", {
      maxWidth: LEVEL4.TITLE_MAX_WIDTH,
      fontSize: LEVEL4.TITLE_FONT_SIZE,
      color: "#d9f99d"
    })
      .setScrollFactor(0)
      .setDepth(950);

    this.physics.add.overlap(this.player, this.doorZone, () => this.completeLevel());
  }

  update(_: number, _delta: number): void {
    this.handlePauseToggle();
    if (this.paused || this.levelCompleted) {
      return;
    }

    this.updateIcyTowerCamera();
    this.player.updatePlatformer(this.inputManager, scale(LEVEL4.PLAYER_SPEED), scale(LEVEL4.JUMP_SPEED));
    this.updatePlatformerPose(this.player);
    this.tryProfessionalInteraction();
    this.updateRivals();
    this.updateMovingHazards();
    this.updateTripHazards();
    this.checkFallReset();
    this.hud.updateAll();
  }

  private resetSceneState(): void {
    this.towerPlatforms = [];
    this.professionals = [];
    this.rivals = [];
    this.movingHazards = [];
    this.tripHazards = [];
    this.cameraScrollY = 0;
    this.maxCameraScrollY = 0;
    this.lastHazardHitAt = 0;
    this.lastDockerBoostAt = 0;
    this.levelCompleted = false;
  }

  private ensureLevel4Textures(): void {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 3;

    if (!this.textures.exists("docker-whale-smooth")) {
      g.clear();
      g.fillStyle(0x0ea5e9, 1);
      g.fillEllipse(42 * s, 28 * s, 62 * s, 28 * s);
      g.fillTriangle(68 * s, 21 * s, 88 * s, 11 * s, 79 * s, 32 * s);
      g.fillTriangle(68 * s, 35 * s, 90 * s, 45 * s, 78 * s, 28 * s);
      g.fillStyle(0x38bdf8, 1);
      g.fillEllipse(33 * s, 22 * s, 36 * s, 18 * s);
      g.fillStyle(0xf8fafc, 1);
      g.fillCircle(23 * s, 24 * s, 2 * s);
      for (let i = 0; i < 4; i += 1) {
        g.fillStyle(i % 2 === 0 ? 0x2563eb : 0x60a5fa, 1);
        g.fillRoundedRect((36 + i * 8) * s, (8 - (i % 2) * 2) * s, 7 * s, 12 * s, 1.5 * s);
      }
      g.lineStyle(2 * s, 0x075985, 1);
      g.strokeEllipse(42 * s, 28 * s, 62 * s, 28 * s);
      g.generateTexture("docker-whale-smooth", 96 * s, 54 * s);
    }

    if (!this.textures.exists("octocat-lurker")) {
      g.clear();
      g.fillStyle(0x111827, 1);
      g.fillCircle(26 * s, 22 * s, 15 * s);
      g.fillTriangle(14 * s, 14 * s, 19 * s, 2 * s, 24 * s, 13 * s);
      g.fillTriangle(29 * s, 13 * s, 36 * s, 2 * s, 40 * s, 15 * s);
      g.fillStyle(0xf8fafc, 1);
      g.fillCircle(21 * s, 20 * s, 2.5 * s);
      g.fillCircle(31 * s, 20 * s, 2.5 * s);
      g.lineStyle(3 * s, 0x111827, 1);
      for (const dx of [-18, -9, 9, 18]) {
        g.lineBetween(26 * s, 34 * s, (26 + dx) * s, 47 * s);
      }
      g.lineStyle(1.5 * s, 0x38bdf8, 0.95);
      g.strokeCircle(26 * s, 22 * s, 17 * s);
      g.generateTexture("octocat-lurker", 56 * s, 52 * s);
    }

    if (!this.textures.exists("python-hazard")) {
      g.clear();
      g.lineStyle(11 * s, 0x16a34a, 1);
      g.beginPath();
      g.moveTo(7 * s, 30 * s);
      for (let i = 0; i <= 22; i += 1) {
        const t = i / 22;
        const x = (7 + t * 70) * s;
        const y = (26 + Math.sin(t * Math.PI * 2.2) * 12) * s;
        g.lineTo(x, y);
      }
      g.strokePath();
      g.lineStyle(5 * s, 0xfacc15, 0.9);
      g.beginPath();
      g.moveTo(10 * s, 30 * s);
      for (let i = 0; i <= 22; i += 1) {
        const t = i / 22;
        const x = (10 + t * 62) * s;
        const y = (27 + Math.sin(t * Math.PI * 2.2) * 7) * s;
        g.lineTo(x, y);
      }
      g.strokePath();
      g.fillStyle(0x166534, 1);
      g.fillCircle(76 * s, 18 * s, 8 * s);
      g.fillStyle(0xf8fafc, 1);
      g.fillCircle(78 * s, 16 * s, 1.6 * s);
      g.fillCircle(72 * s, 17 * s, 1.6 * s);
      g.lineStyle(1 * s, 0xef4444, 1);
      g.lineBetween(83 * s, 19 * s, 91 * s, 15 * s);
      g.lineBetween(83 * s, 19 * s, 91 * s, 23 * s);
      g.generateTexture("python-hazard", 96 * s, 54 * s);
    }

    if (!this.textures.exists("trip-hazard-smooth")) {
      g.clear();
      g.fillStyle(0xef4444, 0.92);
      g.fillRoundedRect(0, 0, 52 * s, 10 * s, 3 * s);
      g.lineStyle(2 * s, 0xfacc15, 1);
      g.lineBetween(4 * s, 5 * s, 48 * s, 5 * s);
      g.generateTexture("trip-hazard-smooth", 52 * s, 10 * s);
    }

    g.destroy();
  }

  private createOfficeTowerBackground(): void {
    this.add
      .image(this.scale.width / 2, this.scale.height / 2, "level4-hitech-tower-bg")
      .setDisplaySize(this.scale.width, this.scale.height)
      .setScrollFactor(0)
      .setDepth(-100);
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    const ground = this.platforms
      .create(scaleX(LEVEL4.GROUND_X), scaleY(LEVEL4.GROUND_Y), "level4-platform")
      .setDisplaySize(scaleX(LEVEL4.GROUND_WIDTH), scaleY(LEVEL4.PLATFORM_HEIGHT * 2.2))
      .refreshBody() as Phaser.Physics.Arcade.Image;
    this.configureTopOnlyPlatform(ground);

    const lanes = [92, 202, 320, 438, 548];
    const lanePattern = [2, 1, 3, 2, 4, 3, 2, 0, 1, 2, 3, 4, 2, 1, 0, 2, 3, 1, 2, 4];
    for (let i = 0; i < LEVEL4.PLATFORM_COUNT; i += 1) {
      const stepNumber = i + 1;
      const lane = lanePattern[i % lanePattern.length];
      const y = scaleY(LEVEL4.TOP_PLATFORM_Y + (LEVEL4.PLATFORM_COUNT - stepNumber) * LEVEL4.PLATFORM_STEP_Y);
      const width = stepNumber % 10 === 0 ? LEVEL4.WIDE_PLATFORM_WIDTH : LEVEL4.PLATFORM_WIDTH;
      const x = scaleX(lanes[lane] + ((i % 3) - 1) * 8);
      const platform = this.platforms
        .create(x, y, "level4-platform")
        .setDisplaySize(scaleX(width), scaleY(LEVEL4.PLATFORM_HEIGHT * 2))
        .refreshBody() as Phaser.Physics.Arcade.Image;
      platform.setAlpha(stepNumber % 10 === 0 ? 0.98 : 0.92);
      platform.setDepth(2);
      this.configureTopOnlyPlatform(platform);
      this.towerPlatforms.push({ index: stepNumber, image: platform, x, y, width: scaleX(width) });

      if (stepNumber % 10 === 0) {
        this.add
          .text(x + scaleX(width / 2 + 8), y - scaleY(12), String(stepNumber), {
            fontFamily: '"Courier New", monospace',
            fontSize: `${Math.round(scale(10))}px`,
            color: "#8fe388"
          })
          .setDepth(3);
      }
    }
  }

  private configureTopOnlyPlatform(platform: Phaser.Physics.Arcade.Image): void {
    const body = platform.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (!body) {
      return;
    }
    body.checkCollision.up = true;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
    body.updateFromGameObject();
  }

  private createFinishGate(): void {
    this.doorZone = this.add
      .rectangle(
        scaleX(LEVEL4.DOOR_X),
        scaleY(LEVEL4.DOOR_Y),
        scaleX(LEVEL4.DOOR_WIDTH),
        scaleY(LEVEL4.DOOR_HEIGHT),
        LEVEL4.DOOR_COLOR,
        LEVEL4.DOOR_ALPHA
      )
      .setDepth(6)
      .setStrokeStyle(scale(2), 0xd9f99d, 1);
    this.physics.add.existing(this.doorZone, true);
    createTranslatedText(this, scaleX(LEVEL4.DOOR_X), scaleY(LEVEL4.DOOR_Y - 32), "level4.finish", {
      maxWidth: 120,
      fontSize: 12,
      color: "#d9f99d"
    }).setDepth(7);
  }

  private createProfessionals(): void {
    for (const step of LEVEL4.PROFESSIONAL_STEPS) {
      const platform = this.getPlatform(step);
      if (!platform) {
        continue;
      }
      const sprite = this.add.image(platform.x - platform.width * 0.32, platform.y - scaleY(24), `hr-v${(step % 5) + 1}-stand`);
      scaleSpriteToHeight(sprite, scaleY(44));
      sprite.setDepth(8);
      sprite.setInteractive({ useHandCursor: true });
      const professional = { sprite, used: false };
      sprite.on("pointerdown", () => this.activateProfessional(professional));
      this.professionals.push(professional);
    }
  }

  private createBoostsAndHazards(): void {
    this.dockerGroup = this.physics.add.staticGroup();
    for (const step of LEVEL4.DOCKER_STEPS) {
      const platform = this.getPlatform(step);
      if (!platform) {
        continue;
      }
      const whale = this.dockerGroup
        .create(platform.x + platform.width * 0.22, platform.y - scaleY(28), "docker-whale-smooth")
        .setDisplaySize(scaleX(62), scaleY(34))
        .refreshBody() as Phaser.Physics.Arcade.Image;
      whale.setDepth(7);
    }
    this.physics.add.collider(this.player, this.dockerGroup, (_, whale) => this.handleDockerBounce(whale as Phaser.Physics.Arcade.Image));

    for (const step of LEVEL4.OCTOCAT_STEPS) {
      const platform = this.getPlatform(step);
      if (platform) {
        this.addMovingHazard(platform, "octocat");
      }
    }
    for (const step of LEVEL4.PYTHON_STEPS) {
      const platform = this.getPlatform(step);
      if (platform) {
        this.addMovingHazard(platform, "python");
      }
    }
  }

  private createRivals(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const rival = new Rival(
        this,
        scaleX(LEVEL4.RIVAL_SPAWN_X_START + i * LEVEL4.RIVAL_SPAWN_X_STEP),
        scaleY(LEVEL4.RIVAL_SPAWN_Y),
        ((i % 3) + 1) as 1 | 2 | 3
      );
      this.rivals.push(rival);
      this.physics.add.collider(rival, this.platforms);
      this.physics.add.collider(rival, this.dockerGroup, (_, whale) => this.handleDockerBounce(whale as Phaser.Physics.Arcade.Image, rival));
      this.physics.add.collider(this.player, rival, () => this.handleRivalBodyCheck(rival));
      rival.setData("nextAttackAt", this.time.now + rngInt(700, 1800));
      rival.setData("nextTripAt", this.time.now + rngInt(1800, 3200));
      rival.setData("retargetAt", this.time.now);
    }

    for (let i = 0; i < this.rivals.length; i += 1) {
      for (let j = i + 1; j < this.rivals.length; j += 1) {
        this.physics.add.collider(this.rivals[i], this.rivals[j], () => {
          if (Phaser.Math.Between(0, 100) < 18) {
            this.pushSprite(this.rivals[i], this.rivals[j], 0.74);
          }
        });
      }
    }
  }

  private addMovingHazard(platform: TowerPlatform, kind: "octocat" | "python"): void {
    const key = kind === "octocat" ? "octocat-lurker" : "python-hazard";
    const sprite = this.physics.add.image(platform.x, platform.y - scaleY(kind === "octocat" ? 25 : 18), key);
    sprite.setDisplaySize(scaleX(kind === "octocat" ? 36 : 64), scaleY(kind === "octocat" ? 34 : 28));
    sprite.setDepth(8);
    sprite.setImmovable(true);
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = false;
      body.setSize(sprite.displayWidth * 0.72, sprite.displayHeight * 0.64, true);
    }
    this.physics.add.overlap(this.player, sprite, () => {
      if (kind === "octocat") {
        this.dropPlayerFloors(LEVEL4.OCTOCAT_DROP_FLOORS, t("level4.mergeConflict"), "#fca5a5");
      } else {
        this.dropPlayerFloors(LEVEL4.PYTHON_DROP_FLOORS, t("level4.indentationError"), "#facc15");
      }
    });
    this.movingHazards.push({
      sprite,
      kind,
      left: platform.x - platform.width * 0.38,
      right: platform.x + platform.width * 0.38,
      speed: scaleX(kind === "octocat" ? LEVEL4.OCTOCAT_SPEED : LEVEL4.PYTHON_SPEED),
      dir: Phaser.Math.Between(0, 1) === 0 ? -1 : 1
    });
  }

  private updateIcyTowerCamera(): void {
    const targetY = Phaser.Math.Clamp(
      this.player.y - this.scale.height * LEVEL4.CAMERA_PLAYER_LEAD_RATIO,
      0,
      this.maxCameraScrollY
    );
    this.cameraScrollY = Phaser.Math.Linear(this.cameraScrollY, targetY, LEVEL4.CAMERA_LERP);
    if (Math.abs(this.cameraScrollY - targetY) < scaleY(1)) {
      this.cameraScrollY = targetY;
    }
    this.cameras.main.setScroll(0, this.cameraScrollY);
  }

  private updateRivals(): void {
    for (const rival of this.rivals) {
      if (!rival.active) {
        continue;
      }
      if (rival.y > this.cameras.main.scrollY + this.scale.height + scaleY(120)) {
        this.respawnRival(rival);
        continue;
      }
      const target = this.getRivalTarget(rival);
      rival.updateAI(target.x);
      this.updatePlatformerPose(rival);
      this.maybeRivalAttack(rival, target);
      this.maybeRivalTrip(rival);
      if (this.player.y < rival.y - scaleY(LEVEL4.RIVAL_OVERTAKE_GAP) && !rival.getData("overtaken")) {
        rival.setData("overtaken", true);
        this.scoreSystem.addSkill(LEVEL4.RIVAL_OVERTAKE_SCORE);
        FloatingText.spawn(rival.scene, rival.x, rival.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("common.points", { points: LEVEL4.RIVAL_OVERTAKE_SCORE }), "#8fe388");
      }
    }
  }

  private getRivalTarget(rival: Rival): Phaser.Physics.Arcade.Sprite {
    const retargetAt = (rival.getData("retargetAt") as number | undefined) ?? 0;
    const current = rival.getData("target") as Phaser.Physics.Arcade.Sprite | undefined;
    if (current?.active && this.time.now < retargetAt) {
      return current;
    }
    const candidates: Phaser.Physics.Arcade.Sprite[] = [this.player, ...this.rivals.filter((candidate) => candidate !== rival && candidate.active)];
    const target = candidates[rngInt(0, Math.max(0, candidates.length - 1))] ?? this.player;
    rival.setData("target", target);
    rival.setData("retargetAt", this.time.now + rngInt(900, 2200));
    return target;
  }

  private maybeRivalAttack(rival: Rival, target: Phaser.Physics.Arcade.Sprite): void {
    const nextAttackAt = (rival.getData("nextAttackAt") as number | undefined) ?? 0;
    if (this.time.now < nextAttackAt) {
      return;
    }
    rival.setData("nextAttackAt", this.time.now + rngInt(900, 1900));
    if (Phaser.Math.Distance.Between(rival.x, rival.y, target.x, target.y) > scale(LEVEL4.RIVAL_ATTACK_RANGE)) {
      return;
    }
    this.pushSprite(rival, target, target === this.player ? 1 : 0.82);
    FloatingText.spawn(this, target.x, target.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), t("level4.push"), "#fca5a5");
  }

  private maybeRivalTrip(rival: Rival): void {
    const nextTripAt = (rival.getData("nextTripAt") as number | undefined) ?? 0;
    const body = rival.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.blocked.down || this.time.now < nextTripAt) {
      return;
    }
    rival.setData("nextTripAt", this.time.now + rngInt(2200, 4200));
    if (Phaser.Math.Between(0, 100) > LEVEL4.RIVAL_TRIP_CHANCE) {
      return;
    }
    const visual = this.add
      .rectangle(rival.x + (rival.body.velocity.x >= 0 ? scaleX(18) : -scaleX(18)), rival.y + scaleY(17), scaleX(48), scaleY(8), 0xef4444, 0.82)
      .setStrokeStyle(scale(1), 0xfacc15, 0.9)
      .setDepth(9);
    this.tripHazards.push({ visual, expiresAt: this.time.now + LEVEL4.TRIP_HAZARD_MS, owner: rival });
  }

  private updateTripHazards(): void {
    const active: TripHazard[] = [];
    for (const hazard of this.tripHazards) {
      if (this.time.now >= hazard.expiresAt || !hazard.visual.active) {
        hazard.visual.destroy();
        continue;
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(hazard.visual.getBounds(), this.player.getBounds())) {
        hazard.visual.destroy();
        this.dropPlayerFloors(LEVEL4.TRIP_DROP_FLOORS, t("level4.trip"), "#fca5a5");
        continue;
      }
      for (const rival of this.rivals) {
        if (rival === hazard.owner || !rival.active) {
          continue;
        }
        if (Phaser.Geom.Intersects.RectangleToRectangle(hazard.visual.getBounds(), rival.getBounds())) {
          rival.setVelocityY(scaleY(LEVEL4.RIVAL_ATTACK_DOWN_VELOCITY));
          rival.setVelocityX((rival.x < hazard.visual.x ? -1 : 1) * this.pushStrength * 0.8);
          hazard.visual.destroy();
          break;
        }
      }
      if (hazard.visual.active) {
        active.push(hazard);
      }
    }
    this.tripHazards = active;
  }

  private updateMovingHazards(): void {
    for (const hazard of this.movingHazards) {
      if (!hazard.sprite.active) {
        continue;
      }
      if (hazard.sprite.x <= hazard.left) {
        hazard.dir = 1;
      } else if (hazard.sprite.x >= hazard.right) {
        hazard.dir = -1;
      }
      hazard.sprite.setVelocityX(hazard.dir * hazard.speed);
      hazard.sprite.setFlipX(hazard.dir < 0);
      if (hazard.kind === "python") {
        hazard.sprite.setAngle(Math.sin(this.time.now / 160) * 4);
      }
    }
  }

  private tryProfessionalInteraction(): void {
    if (!(this.inputManager.justPressedPickup() || this.inputManager.justPressedInteract() || this.inputManager.justPressedConfirm())) {
      return;
    }
    const professional = this.getNearestProfessional();
    if (professional) {
      this.activateProfessional(professional);
    }
  }

  private getNearestProfessional(): Professional | null {
    let best: Professional | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const professional of this.professionals) {
      if (professional.used) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, professional.sprite.x, professional.sprite.y);
      if (dist < scale(LEVEL4.PROFESSIONAL_RANGE) && dist < bestDist) {
        best = professional;
        bestDist = dist;
      }
    }
    return best;
  }

  private activateProfessional(professional: Professional): void {
    if (professional.used || Phaser.Math.Distance.Between(this.player.x, this.player.y, professional.sprite.x, professional.sprite.y) > scale(LEVEL4.PROFESSIONAL_RANGE)) {
      return;
    }
    professional.used = true;
    professional.sprite.setTint(0x8fe388);
    this.boostPlayer(LEVEL4.NETWORK_BOOST_FLOORS, t("level4.referralBoost"), "#8fe388");
  }

  private handleDockerBounce(_: Phaser.Physics.Arcade.Image, target: Phaser.Physics.Arcade.Sprite = this.player): void {
    if (this.time.now - this.lastDockerBoostAt < LEVEL4.DOCKER_COOLDOWN_MS) {
      return;
    }
    const body = target.body as Phaser.Physics.Arcade.Body | null;
    if (!body || body.velocity.y < -scaleY(40)) {
      return;
    }
    this.lastDockerBoostAt = this.time.now;
    this.boostSprite(target, LEVEL4.DOCKER_BOOST_FLOORS);
    if (target === this.player) {
      this.boostPlayer(LEVEL4.DOCKER_BOOST_FLOORS, t("level4.dockerBoost"), "#9bdcff", false);
    }
  }

  private boostPlayer(floors: number, message: string, color: string, applyVelocity = true): void {
    if (applyVelocity) {
      this.boostSprite(this.player, floors);
    }
    this.scoreSystem.addSkill(LEVEL4.BOOST_SCORE);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    this.cameras.main.flash(120, 56, 189, 248, false);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), message, color);
  }

  private boostSprite(sprite: Phaser.Physics.Arcade.Sprite, floors: number): void {
    const velocity = -Math.sqrt(2 * LEVEL4.WORLD_GRAVITY_Y * scaleY(LEVEL4.PLATFORM_STEP_Y * floors)) * 1.06;
    sprite.setVelocityY(velocity);
    sprite.setVelocityX(sprite.body.velocity.x * 0.6);
  }

  private dropPlayerFloors(floors: number, message: string, color: string): void {
    if (this.invulnerable || this.levelCompleted || this.time.now - this.lastHazardHitAt < LEVEL4.HAZARD_COOLDOWN_MS) {
      return;
    }
    this.lastHazardHitAt = this.time.now;
    this.invulnerable = true;
    this.time.delayedCall(LEVEL4.HAZARD_COOLDOWN_MS, () => {
      this.invulnerable = false;
    });
    this.scoreSystem.addPenalty(LEVEL4.HAZARD_PENALTY);
    this.scoreSystem.breakCombo();
    const y = Phaser.Math.Clamp(
      this.player.y + scaleY(LEVEL4.PLATFORM_STEP_Y * floors),
      scaleY(LEVEL4.DOOR_Y),
      scaleY(LEVEL4.WORLD_HEIGHT - 24)
    );
    this.player.setPosition(this.player.x, y);
    this.player.setVelocityY(scaleY(LEVEL4.HAZARD_DROP_VELOCITY));
    this.player.setVelocityX(scaleX(rngInt(-60, 60)));
    this.cameras.main.shake(180, 0.006);
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), message, color);
  }

  private handleRivalBodyCheck(rival: Rival): void {
    if (this.invulnerable || Phaser.Math.Between(0, 100) < 42) {
      const pushDir = this.player.x < rival.x ? -1 : 1;
      this.player.setVelocityX(pushDir * this.pushStrength * 0.72);
      this.player.setVelocityY(scaleY(LEVEL4.RIVAL_ATTACK_DOWN_VELOCITY * 0.55));
    }
  }

  private pushSprite(attacker: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, multiplier: number): void {
    const dir = target.x < attacker.x ? -1 : 1;
    target.setVelocityX(dir * this.pushStrength * multiplier);
    target.setVelocityY(scaleY(LEVEL4.RIVAL_ATTACK_DOWN_VELOCITY));
  }

  private respawnRival(rival: Rival): void {
    const visible = this.towerPlatforms.filter((platform) => platform.y > this.cameras.main.scrollY + scaleY(60) && platform.y < this.cameras.main.scrollY + this.scale.height - scaleY(50));
    const platform = visible[rngInt(0, Math.max(0, visible.length - 1))] ?? this.towerPlatforms[0];
    rival.setPosition(platform.x, platform.y - scaleY(36));
    rival.setVelocity(0, -scaleY(LEVEL4.JUMP_SPEED * 0.55));
    rival.setData("overtaken", false);
  }

  private updatePlatformerPose(sprite: Phaser.Physics.Arcade.Sprite): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    const tilt = Phaser.Math.Clamp(body.velocity.x / scaleX(24), -10, 10);
    if (body.velocity.y < -scaleY(50)) {
      sprite.setAngle(tilt);
      sprite.setTint(0xe0f2fe);
      return;
    }
    if (body.velocity.y > scaleY(120)) {
      sprite.setAngle(-tilt * 0.7);
      sprite.setTint(0xfef3c7);
      return;
    }
    sprite.setAngle(0);
    sprite.clearTint();
  }

  private checkFallReset(): void {
    if (this.player.y <= this.cameras.main.scrollY + this.scale.height + scaleY(LEVEL4.FALL_RESET_BUFFER_Y)) {
      return;
    }
    this.levelCompleted = true;
    this.physics.world.isPaused = false;
    this.time.timeScale = 1;
    runState.hearts -= 1;
    runState.mistakes += 1;
    this.scoreSystem.addPenalty(LEVEL4.FALL_PENALTY);
    this.scoreSystem.breakCombo();
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    this.hud.updateAll();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("common.heartLost"), "#ff6b6b");

    if (runState.hearts <= 0) {
      runState.hearts = 0;
      this.audio.playSfx("sfx-gameover", AUDIO.SFX.GAME_OVER);
      this.scene.start("GameOverScene");
      return;
    }

    const nextHearts = runState.hearts;
    this.time.delayedCall(LEVEL4.FALL_RESTART_DELAY_MS, () => {
      this.scene.restart({ heartsOverride: nextHearts });
    });
  }

  private cleanupSceneState(): void {
    if (this.physics?.world) {
      this.physics.world.isPaused = false;
    }
    if (this.time) {
      this.time.timeScale = 1;
    }
    this.tripHazards.forEach((hazard) => hazard.visual.destroy());
    this.tripHazards = [];
    this.movingHazards = [];
    this.rivals = [];
  }

  private getPlatform(step: number): TowerPlatform | undefined {
    return this.towerPlatforms.find((platform) => platform.index === step);
  }

  private completeLevel(): void {
    if (this.levelCompleted) {
      return;
    }
    this.levelCompleted = true;
    this.scoreSystem.addBase(LEVEL4.COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL4.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL4.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL4.COMPLETE_TEXT_X),
      this.cameras.main.scrollY + scaleY(LEVEL4.COMPLETE_TEXT_Y_OFFSET),
      t("common.points", { points: LEVEL4.COMPLETE_SCORE }),
      "#8fe388"
    );
    this.hud.updateAll();
    this.time.delayedCall(LEVEL4.COMPLETE_DELAY_MS, () => this.scene.start("Level5Scene"));
  }
}

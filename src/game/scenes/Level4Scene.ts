import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Rival } from "../entities/Rival";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, FLOATING_TEXT, LEVEL4, MATH, RUN, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText, createTranslatedText, setTranslatedText } from "../utils/domText";
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
  baseY: number;
  speed: number;
  dir: -1 | 1;
  phase: number;
};

type TripHazard = {
  text: Phaser.GameObjects.DOMElement;
  expiresAt: number;
  damageAt: number;
  owner: Rival;
  applied: boolean;
};

type JetpackPickup = {
  sprite: Phaser.Physics.Arcade.Image;
  label: Phaser.GameObjects.DOMElement;
  used: boolean;
};

type CoffeePickup = {
  sprite: Phaser.Physics.Arcade.Image;
  used: boolean;
};

type RivalBehavior = {
  speedMultiplier: number;
  jumpMinMs: number;
  jumpMaxMs: number;
  pushChance: number;
};

type RivalClimbIntent = {
  targetX: number;
  jump: boolean;
  stopDistance: number;
};

type RivalBoostTarget = {
  x: number;
  priority: number;
};

type Level4RestartData = {
  heartsOverride?: number;
};

export class Level4Scene extends BaseLevelScene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private dockerGroup!: Phaser.Physics.Arcade.StaticGroup;
  private jetpackGroup!: Phaser.Physics.Arcade.StaticGroup;
  private coffeeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private coffeeProjectiles!: Phaser.Physics.Arcade.Group;
  private towerPlatforms: TowerPlatform[] = [];
  private professionals: Professional[] = [];
  private dockerBoosts: Phaser.Physics.Arcade.Image[] = [];
  private jetpacks: JetpackPickup[] = [];
  private coffeePickups: CoffeePickup[] = [];
  private coffeeAmmoIcons: Phaser.GameObjects.Image[] = [];
  private rivals: Rival[] = [];
  private rivalBehaviors = new Map<Rival, RivalBehavior>();
  private movingHazards: MovingHazard[] = [];
  private tripHazards: TripHazard[] = [];
  private rankText!: Phaser.GameObjects.DOMElement;
  private doorZone!: Phaser.GameObjects.Rectangle;
  private finishDoorLeft!: Phaser.GameObjects.Image;
  private finishDoorRight!: Phaser.GameObjects.Image;
  private finishDoorGlow!: Phaser.GameObjects.Rectangle;
  private finishDoorOpening = false;
  private cameraScrollY = 0;
  private maxCameraScrollY = 0;
  private pushStrength = scale(LEVEL4.DEFAULT_PUSH_STRENGTH);
  private lastHazardHitAt = 0;
  private lastDockerBoostAt = 0;
  private playerJetpackUntil = 0;
  private nextPlayerSmokeAt = 0;
  private coffeeAmmo = 0;
  private lastPlayerAxisX: -1 | 1 = 1;
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
    this.audio.playMusic("music-level4-race", AUDIO.MUSIC.LEVEL4_RACE);
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
    this.createCoffeeAmmoIcons();
    this.createRankText();

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
    const axisX = this.inputManager.getAxisX();
    if (Math.abs(axisX) > 0.01) {
      this.lastPlayerAxisX = axisX < 0 ? -1 : 1;
    }
    if (this.isPlayerJetpackActive()) {
      this.updatePlayerJetpackFlight();
    } else {
      this.updatePlatformerPose(this.player);
    }
    const xPressed = this.inputManager.justPressedPickup();
    const interacted = this.tryProfessionalInteraction(xPressed);
    if (xPressed && !interacted) {
      if (!this.tryShootCoffee()) {
        this.pushNearbyRivals();
      }
    }
    this.updateRivals();
    this.updateDockerBoosts();
    this.updateCoffeeProjectiles();
    this.updateMovingHazards();
    this.updateTripHazards();
    this.updateRankText();
    this.checkFallReset();
    this.hud.updateAll();
  }

  private resetSceneState(): void {
    this.towerPlatforms = [];
    this.professionals = [];
    this.dockerBoosts = [];
    this.jetpacks = [];
    this.coffeePickups = [];
    this.coffeeAmmoIcons = [];
    this.rivals = [];
    this.rivalBehaviors.clear();
    this.movingHazards = [];
    this.tripHazards = [];
    this.cameraScrollY = 0;
    this.maxCameraScrollY = 0;
    this.lastHazardHitAt = 0;
    this.lastDockerBoostAt = 0;
    this.playerJetpackUntil = 0;
    this.nextPlayerSmokeAt = 0;
    this.coffeeAmmo = 0;
    this.lastPlayerAxisX = 1;
    this.finishDoorOpening = false;
    this.levelCompleted = false;
  }

  private ensureLevel4Textures(): void {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 3;

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
    this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xdbeafe, LEVEL4.BG_LIGHTEN_ALPHA)
      .setScrollFactor(0)
      .setDepth(-99);
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
    const doorX = scaleX(LEVEL4.DOOR_X);
    const doorY = scaleY(LEVEL4.DOOR_Y + 38);
    const doorW = scaleX(140);
    const doorH = scaleY(196);
    const source = this.textures.get("level4-finish-door").getSourceImage() as HTMLImageElement;
    const halfW = Math.floor(source.width / 2);
    this.finishDoorGlow = this.add
      .rectangle(doorX, doorY + scaleY(18), scaleX(70), scaleY(112), 0xdffbff, 0)
      .setDepth(6.5);
    this.finishDoorLeft = this.add
      .image(doorX, doorY, "level4-finish-door")
      .setDisplaySize(doorW, doorH)
      .setCrop(0, 0, halfW, source.height)
      .setDepth(7);
    this.finishDoorRight = this.add
      .image(doorX, doorY, "level4-finish-door")
      .setDisplaySize(doorW, doorH)
      .setCrop(halfW, 0, source.width - halfW, source.height)
      .setDepth(7);
    this.doorZone = this.add
      .rectangle(
        doorX,
        scaleY(LEVEL4.DOOR_Y + 44),
        scaleX(LEVEL4.DOOR_WIDTH * 1.35),
        scaleY(LEVEL4.DOOR_HEIGHT * 2.5),
        LEVEL4.DOOR_COLOR,
        0
      )
      .setDepth(6);
    this.physics.add.existing(this.doorZone, true);
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
    this.jetpackGroup = this.physics.add.staticGroup();
    this.coffeeGroup = this.physics.add.staticGroup();
    this.coffeeProjectiles = this.physics.add.group({ allowGravity: false });
    for (const step of LEVEL4.DOCKER_STEPS) {
      const platform = this.getPlatform(step);
      if (!platform) {
        continue;
      }
      const whale = this.dockerGroup
        .create(platform.x + platform.width * 0.22, platform.y - scaleY(29), "level4-docker-whale")
        .setDisplaySize(scaleX(66), scaleY(43))
        .refreshBody() as Phaser.Physics.Arcade.Image;
      whale.setDepth(7);
      this.dockerBoosts.push(whale);
    }
    this.physics.add.collider(this.player, this.dockerGroup, (_, whale) => this.handleDockerBounce(whale as Phaser.Physics.Arcade.Image));
    this.createJetpacks();
    this.physics.add.overlap(this.player, this.jetpackGroup, (_, jetpack) => this.handleJetpackPickup(this.player, jetpack as Phaser.Physics.Arcade.Image));
    this.createCoffeePickups();
    this.physics.add.overlap(this.player, this.coffeeGroup, (_, coffee) => this.handleCoffeePickup(this.player, coffee as Phaser.Physics.Arcade.Image));

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

  private createJetpacks(): void {
    for (const step of LEVEL4.JETPACK_STEPS) {
      const platform = this.getPlatform(step);
      if (!platform) {
        continue;
      }
      const sprite = this.jetpackGroup
        .create(platform.x - platform.width * 0.24, platform.y - scaleY(36), "level4-jetpack")
        .setDisplaySize(scaleX(74), scaleY(72))
        .refreshBody() as Phaser.Physics.Arcade.Image;
      sprite.setDepth(8);
      const label = createDialogText(this, sprite.x, sprite.y - scaleY(52), "פרוטקציות", {
        maxWidth: 120,
        fontSize: 12,
        color: "#fef08a",
        align: "center",
        direction: "rtl",
        weight: 800
      }).setDepth(9);
      this.jetpacks.push({ sprite, label, used: false });
    }
  }

  private createCoffeePickups(): void {
    for (const step of LEVEL4.JAVA_COFFEE_STEPS) {
      const platform = this.getPlatform(step);
      if (!platform) {
        continue;
      }
      const sprite = this.coffeeGroup
        .create(platform.x + platform.width * 0.28, platform.y - scaleY(25), "level4-java-coffee")
        .setDisplaySize(scaleX(25), scaleY(30))
        .refreshBody() as Phaser.Physics.Arcade.Image;
      sprite.setDepth(8);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - scaleY(5),
        angle: 4,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.coffeePickups.push({ sprite, used: false });
    }
  }

  private createCoffeeAmmoIcons(): void {
    const startX = this.scale.width - scaleX(8);
    const y = scaleY(26);
    for (let i = 0; i < LEVEL4.JAVA_COFFEE_MAX_AMMO; i += 1) {
      const icon = this.add
        .image(startX - scaleX(i * 18), y, "level4-java-coffee")
        .setDisplaySize(scaleX(12), scaleY(15))
        .setScrollFactor(0)
        .setDepth(1001)
        .setAlpha(0.25);
      this.coffeeAmmoIcons.push(icon);
    }
    this.updateCoffeeAmmoIcons();
  }

  private updateCoffeeAmmoIcons(): void {
    this.coffeeAmmoIcons.forEach((icon, index) => {
      icon.setAlpha(index < this.coffeeAmmo ? 1 : 0.25);
    });
  }

  private createRankText(): void {
    this.rankText = createTranslatedText(this, scaleX(12), scaleY(48), "level4.rank", {
      params: { rank: 1, total: this.rivals.length + 1 },
      maxWidth: 120,
      fontSize: 13,
      color: "#fef08a",
      align: "left",
      originX: 0,
      originY: 0,
      weight: 800
    })
      .setScrollFactor(0)
      .setDepth(1001);
    this.updateRankText();
  }

  private updateRankText(): void {
    if (!this.rankText) {
      return;
    }
    const competitors = [this.player, ...this.rivals.filter((rival) => rival.active)].sort((a, b) => a.y - b.y);
    const rank = competitors.findIndex((sprite) => sprite === this.player) + 1;
    setTranslatedText(this.rankText, "level4.rank", { rank: Math.max(1, rank), total: competitors.length });
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
      this.rivalBehaviors.set(rival, this.createRivalBehavior(i));
      this.physics.add.collider(rival, this.platforms);
      this.physics.add.collider(rival, this.dockerGroup, (_, whale) => this.handleDockerBounce(whale as Phaser.Physics.Arcade.Image, rival));
      this.physics.add.overlap(rival, this.jetpackGroup, (_, jetpack) => this.handleJetpackPickup(rival, jetpack as Phaser.Physics.Arcade.Image));
      this.physics.add.overlap(rival, this.coffeeGroup, (_, coffee) => this.handleCoffeePickup(rival, coffee as Phaser.Physics.Arcade.Image));
      this.physics.add.overlap(this.coffeeProjectiles, rival, (projectile) => this.handleCoffeeRivalHit(projectile as Phaser.Physics.Arcade.Sprite, rival));
      this.physics.add.overlap(rival, this.doorZone, () => this.handleRivalFinish(rival));
      rival.setData("nextAttackAt", this.time.now + rngInt(700, 1800));
      rival.setData("nextTripAt", this.time.now + rngInt(1800, 3200));
      rival.setData("retargetAt", this.time.now);
      rival.setData("targetOffset", rngInt(-80, 80));
      rival.setData("nextJumpAt", this.time.now + rngInt(120, 900 + i * 120));
      rival.setData("nextPushAt", this.time.now + rngInt(1200, 2600));
      rival.setData("checkpointY", rival.y);
      rival.setData("climbOffset", rngInt(-LEVEL4.RIVAL_CLIMB_LANE_OFFSET_X, LEVEL4.RIVAL_CLIMB_LANE_OFFSET_X));
      rival.setData("coffeeAmmo", 0);
      rival.setData("nextCoffeeShotAt", this.time.now + rngInt(LEVEL4.RIVAL_COFFEE_SHOOT_MIN_MS, LEVEL4.RIVAL_COFFEE_SHOOT_MAX_MS));
    }
  }

  private createRivalBehavior(index: number): RivalBehavior {
    const variants: RivalBehavior[] = [
      { speedMultiplier: 1.28, jumpMinMs: 120, jumpMaxMs: 360, pushChance: 28 },
      { speedMultiplier: 1.46, jumpMinMs: 180, jumpMaxMs: 460, pushChance: 18 },
      { speedMultiplier: 1.36, jumpMinMs: 260, jumpMaxMs: 620, pushChance: 38 },
      { speedMultiplier: 1.62, jumpMinMs: 140, jumpMaxMs: 420, pushChance: 24 }
    ];
    return variants[index % variants.length];
  }

  private addMovingHazard(platform: TowerPlatform, kind: "octocat" | "python"): void {
    const key = kind === "octocat" ? "level4-octocat" : "level4-python-snake";
    const sprite = this.physics.add.image(platform.x, platform.y - scaleY(kind === "octocat" ? 25 : 18), key);
    sprite.setDisplaySize(scaleX(kind === "octocat" ? 42 : 74), scaleY(kind === "octocat" ? 46 : 37));
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
    this.physics.add.overlap(this.coffeeProjectiles, sprite, (projectile) => this.handleCoffeeHazardHit(projectile as Phaser.Physics.Arcade.Sprite, sprite));
    this.movingHazards.push({
      sprite,
      kind,
      left: platform.x - platform.width * 0.38,
      right: platform.x + platform.width * 0.38,
      baseY: sprite.y,
      speed: scaleX(kind === "octocat" ? LEVEL4.OCTOCAT_SPEED : LEVEL4.PYTHON_SPEED),
      dir: Phaser.Math.Between(0, 1) === 0 ? -1 : 1,
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2)
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
      this.updateRivalCheckpoint(rival);
      if (this.shouldRespawnRivalFromFall(rival)) {
        this.respawnRival(rival);
        continue;
      }
      const behavior = this.rivalBehaviors.get(rival) ?? this.createRivalBehavior(0);
      const climb = this.getRivalClimbIntent(rival, behavior);
      rival.updateAI(climb.targetX, {
        speedMultiplier: behavior.speedMultiplier,
        jump: climb.jump,
        jumpMultiplier: LEVEL4.RIVAL_CLIMB_JUMP_MULTIPLIER,
        stopDistance: climb.stopDistance
      });
      if (this.isRivalJetpackActive(rival)) {
        this.updateRivalJetpackFlight(rival);
      } else {
        this.updatePlatformerPose(rival);
      }
      this.maybeRivalTrip(rival);
      this.maybeRivalPushPlayer(rival);
      this.maybeRivalShootCoffee(rival);
      if (this.player.y < rival.y - scaleY(LEVEL4.RIVAL_OVERTAKE_GAP) && !rival.getData("overtaken")) {
        rival.setData("overtaken", true);
        this.scoreSystem.addSkill(LEVEL4.RIVAL_OVERTAKE_SCORE);
        FloatingText.spawn(rival.scene, rival.x, rival.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("common.points", { points: LEVEL4.RIVAL_OVERTAKE_SCORE }), "#8fe388");
      }
    }
  }

  private getRivalClimbIntent(rival: Rival, behavior: RivalBehavior): RivalClimbIntent {
    const body = rival.body as Phaser.Physics.Arcade.Body | null;
    const airborneTarget = this.getPlatform(rival.getData("climbTargetStep") as number);
    if (!body?.blocked.down) {
      return {
        targetX: this.getRivalPlatformTargetX(rival, airborneTarget) ?? Phaser.Math.Clamp(rival.x, scaleX(44), this.scale.width - scaleX(44)),
        jump: false,
        stopDistance: scaleX(2)
      };
    }

    const currentPlatform = this.getRivalStandingPlatform(rival);
    const nextPlatform = this.getNextRivalClimbPlatform(rival, currentPlatform);
    if (!nextPlatform) {
      return { targetX: rival.x, jump: false, stopDistance: scaleX(12) };
    }

    const currentBoost = currentPlatform ? this.getBestBoostTargetForPlatform(currentPlatform, rival) : undefined;
    if (currentBoost && Math.abs(rival.x - currentBoost.x) > scaleX(12)) {
      return {
        targetX: currentBoost.x,
        jump: false,
        stopDistance: scaleX(8)
      };
    }

    rival.setData("climbTargetStep", nextPlatform.index);
    const targetX = this.getRivalPlatformTargetX(rival, nextPlatform) ?? nextPlatform.x;
    const launchX = currentPlatform ? this.getRivalLaunchX(currentPlatform, targetX) : targetX;
    const alignDistance = scaleX(LEVEL4.RIVAL_CLIMB_ALIGN_X);
    const nextJumpAt = (rival.getData("nextJumpAt") as number | undefined) ?? 0;
    const alignedForJump = Math.abs(rival.x - launchX) <= alignDistance;
    const jump = alignedForJump && this.time.now >= nextJumpAt;
    if (jump) {
      rival.setData("nextJumpAt", this.time.now + rngInt(behavior.jumpMinMs, behavior.jumpMaxMs));
    }

    return {
      targetX: jump ? targetX : launchX,
      jump,
      stopDistance: jump ? scaleX(2) : alignDistance * 0.65
    };
  }

  private getRivalStandingPlatform(rival: Rival): TowerPlatform | undefined {
    const yMin = scaleY(18);
    const yMax = scaleY(64);
    return this.towerPlatforms.find((platform) => {
      const dy = platform.y - rival.y;
      const withinY = dy >= yMin && dy <= yMax;
      const withinX = Math.abs(platform.x - rival.x) <= platform.width * 0.5 + rival.displayWidth * 0.45;
      return withinY && withinX;
    });
  }

  private getNextRivalClimbPlatform(rival: Rival, currentPlatform?: TowerPlatform): TowerPlatform | undefined {
    if (currentPlatform) {
      return this.getPlatform(currentPlatform.index + 1);
    }
    const candidates = this.towerPlatforms.filter((platform) => platform.y < rival.y - scaleY(20));
    return candidates.sort((a, b) => b.y - a.y)[0];
  }

  private getRivalPlatformTargetX(rival: Rival, platform?: TowerPlatform): number | undefined {
    if (!platform) {
      return undefined;
    }
    const boost = this.getBestBoostTargetForPlatform(platform, rival);
    if (boost) {
      return boost.x;
    }
    const offset = scaleX((rival.getData("climbOffset") as number | undefined) ?? 0);
    const margin = scaleX(LEVEL4.RIVAL_CLIMB_PLATFORM_MARGIN_X);
    return Phaser.Math.Clamp(platform.x + offset, platform.x - platform.width * 0.5 + margin, platform.x + platform.width * 0.5 - margin);
  }

  private getBestBoostTargetForPlatform(platform: TowerPlatform, rival: Rival): RivalBoostTarget | undefined {
    const targets: RivalBoostTarget[] = [];
    const docker = this.dockerBoosts.find((whale) => whale.active && Math.abs(whale.y - (platform.y - scaleY(29))) <= scaleY(8));
    if (docker) {
      targets.push({ x: docker.x, priority: 3 });
    }
    const jetpack = this.jetpacks.find((pickup) => !pickup.used && pickup.sprite.active && Math.abs(pickup.sprite.y - (platform.y - scaleY(36))) <= scaleY(10));
    if (jetpack) {
      targets.push({ x: jetpack.sprite.x, priority: 4 });
    }
    const needsCoffee = ((rival.getData("coffeeAmmo") as number | undefined) ?? 0) < LEVEL4.JAVA_COFFEE_MAX_AMMO;
    const coffee = needsCoffee
      ? this.coffeePickups.find((pickup) => !pickup.used && pickup.sprite.active && Math.abs(pickup.sprite.y - (platform.y - scaleY(25))) <= scaleY(10))
      : undefined;
    if (coffee) {
      targets.push({ x: coffee.sprite.x, priority: 2 });
    }
    return targets.sort((a, b) => b.priority - a.priority || Math.abs(rival.x - a.x) - Math.abs(rival.x - b.x))[0];
  }

  private getRivalLaunchX(currentPlatform: TowerPlatform, targetX: number): number {
    const margin = scaleX(LEVEL4.RIVAL_CLIMB_PLATFORM_MARGIN_X);
    const left = currentPlatform.x - currentPlatform.width * 0.5 + margin;
    const right = currentPlatform.x + currentPlatform.width * 0.5 - margin;
    if (targetX >= left && targetX <= right) {
      return targetX;
    }
    return targetX > currentPlatform.x ? right : left;
  }

  private updateRivalCheckpoint(rival: Rival): void {
    const body = rival.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.blocked.down) {
      return;
    }
    const platform = this.getRivalStandingPlatform(rival);
    if (platform) {
      rival.setData("currentPlatformStep", platform.index);
    }
    const checkpointY = (rival.getData("checkpointY") as number | undefined) ?? rival.y;
    if (rival.y < checkpointY - scaleY(LEVEL4.PLATFORM_STEP_Y * 0.7)) {
      rival.setData("checkpointY", rival.y);
    }
  }

  private shouldRespawnRivalFromFall(rival: Rival): boolean {
    const checkpointY = (rival.getData("checkpointY") as number | undefined) ?? rival.y;
    const dropDistance = scaleY(LEVEL4.PLATFORM_STEP_Y * LEVEL4.RIVAL_RESPAWN_DROP_FLOORS);
    return rival.y > checkpointY + dropDistance || rival.y > scaleY(LEVEL4.WORLD_HEIGHT - 16);
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
    rival.setData("targetOffset", rngInt(-80, 80));
    return target;
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
    const tauntKey = `level4.attackTaunt${rngInt(1, 4)}`;
    const text = createTranslatedText(this, rival.x, rival.y - scaleY(52), tauntKey, {
      maxWidth: 150,
      fontSize: 11,
      color: "#fef3c7",
      align: "center",
      weight: 800
    }).setDepth(14);
    this.tripHazards.push({
      text,
      expiresAt: this.time.now + LEVEL4.TRIP_HAZARD_MS,
      damageAt: this.time.now + 260,
      owner: rival,
      applied: false
    });
  }

  private maybeRivalPushPlayer(rival: Rival): void {
    const nextPushAt = (rival.getData("nextPushAt") as number | undefined) ?? 0;
    if (this.time.now < nextPushAt) {
      return;
    }
    const behavior = this.rivalBehaviors.get(rival) ?? this.createRivalBehavior(0);
    rival.setData("nextPushAt", this.time.now + rngInt(1500, 3300));
    if (Phaser.Math.Between(0, 100) > behavior.pushChance) {
      return;
    }
    if (Phaser.Math.Distance.Between(rival.x, rival.y, this.player.x, this.player.y) > scale(LEVEL4.RIVAL_ATTACK_RANGE)) {
      return;
    }
    this.pushSprite(rival, this.player, 0.78);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), t("level4.push"), "#fca5a5");
  }

  private maybeRivalShootCoffee(rival: Rival): void {
    const ammo = (rival.getData("coffeeAmmo") as number | undefined) ?? 0;
    const nextShotAt = (rival.getData("nextCoffeeShotAt") as number | undefined) ?? 0;
    if (ammo <= 0 || this.time.now < nextShotAt) {
      return;
    }
    const target = this.getRivalCoffeeTarget(rival);
    if (!target) {
      rival.setData("nextCoffeeShotAt", this.time.now + rngInt(350, 800));
      return;
    }
    const dir: -1 | 1 = target.x < rival.x ? -1 : 1;
    const velocityY = Phaser.Math.Clamp((target.y - rival.y) / scaleY(1) * 0.35, -70, 70);
    rival.setData("coffeeAmmo", ammo - 1);
    rival.setData("nextCoffeeShotAt", this.time.now + rngInt(LEVEL4.RIVAL_COFFEE_SHOOT_MIN_MS, LEVEL4.RIVAL_COFFEE_SHOOT_MAX_MS));
    this.spawnCoffeeProjectile(rival, dir, velocityY);
  }

  private getRivalCoffeeTarget(rival: Rival): Phaser.Physics.Arcade.Sprite | undefined {
    const candidates: Phaser.Physics.Arcade.Sprite[] = [this.player, ...this.rivals.filter((candidate) => candidate !== rival && candidate.active)];
    return candidates
      .filter((candidate) => {
        return (
          Math.abs(candidate.x - rival.x) <= scaleX(LEVEL4.RIVAL_COFFEE_SHOOT_RANGE_X) &&
          Math.abs(candidate.y - rival.y) <= scaleY(LEVEL4.RIVAL_COFFEE_SHOOT_RANGE_Y)
        );
      })
      .sort((a, b) => {
        const aPlayerBias = a === this.player ? -scaleX(80) : 0;
        const bPlayerBias = b === this.player ? -scaleX(80) : 0;
        return Phaser.Math.Distance.Between(rival.x, rival.y, a.x, a.y) + aPlayerBias - (Phaser.Math.Distance.Between(rival.x, rival.y, b.x, b.y) + bPlayerBias);
      })[0];
  }

  private updateTripHazards(): void {
    const active: TripHazard[] = [];
    for (const hazard of this.tripHazards) {
      if (this.time.now >= hazard.expiresAt || !hazard.text.active || !hazard.owner.active) {
        hazard.text.destroy();
        continue;
      }
      hazard.text.setPosition(hazard.owner.x, hazard.owner.y - scaleY(52));
      const attackX = hazard.owner.x + (hazard.owner.body.velocity.x >= 0 ? scaleX(26) : -scaleX(26));
      const attackY = hazard.owner.y + scaleY(4);
      if (!hazard.applied && this.time.now >= hazard.damageAt && Phaser.Math.Distance.Between(attackX, attackY, this.player.x, this.player.y) <= scale(LEVEL4.RIVAL_ATTACK_RANGE * 1.05)) {
        hazard.applied = true;
        this.dropPlayerFloors(LEVEL4.TRIP_DROP_FLOORS, t("level4.trip"), "#fca5a5");
      }
      for (const rival of this.rivals) {
        if (hazard.applied || rival === hazard.owner || !rival.active) {
          continue;
        }
        if (this.time.now >= hazard.damageAt && Phaser.Math.Distance.Between(attackX, attackY, rival.x, rival.y) <= scale(LEVEL4.RIVAL_ATTACK_RANGE * 0.92)) {
          hazard.applied = true;
          rival.setVelocityY(scaleY(LEVEL4.RIVAL_ATTACK_DOWN_VELOCITY));
          rival.setVelocityX((rival.x < hazard.owner.x ? -1 : 1) * this.pushStrength * 0.8);
          break;
        }
      }
      active.push(hazard);
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
      hazard.sprite.setFlipX(hazard.dir > 0);
      const bobY = hazard.kind === "octocat" ? 3 : 2;
      hazard.sprite.setY(hazard.baseY + Math.sin(this.time.now / 220 + hazard.phase) * scaleY(bobY));
      if (hazard.kind === "python") {
        hazard.sprite.setAngle(Math.sin(this.time.now / 160 + hazard.phase) * 5);
      } else {
        hazard.sprite.setAngle(Math.sin(this.time.now / 180 + hazard.phase) * 6);
      }
    }
  }

  private updateDockerBoosts(): void {
    this.dockerBoosts.forEach((whale, index) => {
      if (!whale.active) {
        return;
      }
      whale.setAngle(Math.sin(this.time.now / 260 + index) * 4);
      whale.setAlpha(0.9 + Math.sin(this.time.now / 300 + index) * 0.08);
    });
  }

  private updateCoffeeProjectiles(): void {
    const projectiles = this.coffeeProjectiles?.getChildren() ?? [];
    for (const child of projectiles) {
      const projectile = child as Phaser.Physics.Arcade.Sprite;
      if (!projectile.active) {
        continue;
      }
      projectile.setAngle(projectile.angle + 18 * ((projectile.getData("dir") as number | undefined) ?? 1));
      if (this.tryCoffeeRadiusHit(projectile)) {
        continue;
      }
      const bornAt = (projectile.getData("bornAt") as number | undefined) ?? this.time.now;
      const outsideWorld = projectile.x < -scaleX(80) || projectile.x > this.scale.width + scaleX(80) || projectile.y < 0 || projectile.y > scaleY(LEVEL4.WORLD_HEIGHT) + scaleY(80);
      if (this.time.now - bornAt > LEVEL4.JAVA_COFFEE_PROJECTILE_LIFETIME_MS || outsideWorld) {
        projectile.destroy();
      }
    }
  }

  private tryCoffeeRadiusHit(projectile: Phaser.Physics.Arcade.Sprite): boolean {
    if (projectile.getData("spent")) {
      return true;
    }
    const owner = projectile.getData("owner") as Phaser.Physics.Arcade.Sprite | undefined;
    const radius = scale(LEVEL4.JAVA_COFFEE_HIT_RADIUS);
    const hazard = this.movingHazards.find((candidate) => {
      return candidate.sprite.active && Phaser.Math.Distance.Between(projectile.x, projectile.y, candidate.sprite.x, candidate.sprite.y) <= radius;
    });
    if (hazard) {
      this.handleCoffeeHazardHit(projectile, hazard.sprite);
      return true;
    }
    if (owner !== this.player && Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y) <= radius) {
      this.handleCoffeePlayerHit(projectile);
      return true;
    }
    const rival = this.rivals.find((candidate) => {
      return candidate !== owner && candidate.active && Phaser.Math.Distance.Between(projectile.x, projectile.y, candidate.x, candidate.y) <= radius;
    });
    if (rival) {
      this.handleCoffeeRivalHit(projectile, rival);
      return true;
    }
    return false;
  }

  private tryProfessionalInteraction(xPressed: boolean): boolean {
    if (!(xPressed || this.inputManager.justPressedInteract() || this.inputManager.justPressedConfirm())) {
      return false;
    }
    const professional = this.getNearestProfessional();
    if (professional) {
      this.activateProfessional(professional);
      return true;
    }
    return false;
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
    const lastBoostAt = (target.getData("lastDockerBoostAt") as number | undefined) ?? 0;
    if (this.time.now - lastBoostAt < LEVEL4.DOCKER_COOLDOWN_MS) {
      return;
    }
    const body = target.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    target.setData("lastDockerBoostAt", this.time.now);
    this.lastDockerBoostAt = this.time.now;
    this.boostSprite(target, LEVEL4.DOCKER_BOOST_FLOORS);
    if (target === this.player) {
      this.boostPlayer(LEVEL4.DOCKER_BOOST_FLOORS, t("level4.dockerBoost"), "#9bdcff", false);
    }
  }

  private handleJetpackPickup(target: Phaser.Physics.Arcade.Sprite, jetpackSprite: Phaser.Physics.Arcade.Image): void {
    const pickup = this.jetpacks.find((candidate) => candidate.sprite === jetpackSprite);
    if (!pickup || pickup.used) {
      return;
    }
    pickup.used = true;
    pickup.label.destroy();
    jetpackSprite.disableBody(true, true);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);

    if (target === this.player) {
      this.activatePlayerJetpack();
      return;
    }
    this.activateRivalJetpack(target as Rival);
  }

  private handleCoffeePickup(target: Phaser.Physics.Arcade.Sprite, coffeeSprite: Phaser.Physics.Arcade.Image): void {
    const pickup = this.coffeePickups.find((candidate) => candidate.sprite === coffeeSprite);
    if (!pickup || pickup.used) {
      return;
    }
    pickup.used = true;
    coffeeSprite.disableBody(true, true);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    if (target === this.player) {
      this.coffeeAmmo = LEVEL4.JAVA_COFFEE_AMMO_PER_PICKUP;
      this.updateCoffeeAmmoIcons();
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "Java x3", "#f97316");
      return;
    }
    const rival = target as Rival;
    rival.setData("coffeeAmmo", LEVEL4.JAVA_COFFEE_AMMO_PER_PICKUP);
    rival.setData("nextCoffeeShotAt", this.time.now + rngInt(220, 520));
    FloatingText.spawn(this, rival.x, rival.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "Java x3", "#f97316");
  }

  private tryShootCoffee(): boolean {
    if (this.coffeeAmmo <= 0) {
      return false;
    }
    this.coffeeAmmo -= 1;
    this.updateCoffeeAmmoIcons();
    const dir = this.lastPlayerAxisX;
    this.spawnCoffeeProjectile(this.player, dir, -28);
    return true;
  }

  private spawnCoffeeProjectile(owner: Phaser.Physics.Arcade.Sprite, dir: -1 | 1, velocityY = -28): Phaser.Physics.Arcade.Sprite {
    const projectile = this.coffeeProjectiles.create(owner.x + dir * scaleX(24), owner.y - scaleY(8), "level4-java-coffee") as Phaser.Physics.Arcade.Sprite;
    projectile
      .setDisplaySize(scaleX(16), scaleY(19))
      .setDepth(12)
      .setData("dir", dir)
      .setData("bornAt", this.time.now)
      .setData("spent", false)
      .setData("owner", owner);
    const body = projectile.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = true;
      body.allowGravity = false;
      body.setSize(projectile.displayWidth * 0.78, projectile.displayHeight * 0.78, true);
      body.setVelocity(dir * scaleX(LEVEL4.JAVA_COFFEE_PROJECTILE_SPEED), scaleY(velocityY));
    }
    this.audio.playSfx("sfx-fire-spit", AUDIO.SFX.FIRE);
    return projectile;
  }

  private handleCoffeeRivalHit(projectile: Phaser.Physics.Arcade.Sprite, rival: Rival): void {
    if (!projectile.active || projectile.getData("spent") || !rival.active || projectile.getData("owner") === rival) {
      return;
    }
    this.consumeCoffeeProjectile(projectile);
    this.time.delayedCall(0, () => {
      if (rival.active) {
        this.dropRivalFloors(rival, LEVEL4.JAVA_COFFEE_DROP_FLOORS);
      }
    });
  }

  private handleCoffeePlayerHit(projectile: Phaser.Physics.Arcade.Sprite): void {
    if (!projectile.active || projectile.getData("spent") || projectile.getData("owner") === this.player) {
      return;
    }
    this.consumeCoffeeProjectile(projectile);
    this.time.delayedCall(0, () => {
      this.player.setData("ignoreFallResetUntil", this.time.now + 1300);
      this.dropPlayerFloors(LEVEL4.JAVA_COFFEE_DROP_FLOORS, "Java", "#f97316");
      this.syncCameraToPlayer();
    });
  }

  private handleCoffeeHazardHit(projectile: Phaser.Physics.Arcade.Sprite, hazardSprite: Phaser.Physics.Arcade.Image): void {
    if (!projectile.active || projectile.getData("spent") || !hazardSprite.active) {
      return;
    }
    this.consumeCoffeeProjectile(projectile);
    const x = hazardSprite.x;
    const y = hazardSprite.y;
    const hazard = this.movingHazards.find((candidate) => candidate.sprite === hazardSprite);
    hazardSprite.disableBody(true, true);
    this.movingHazards = this.movingHazards.filter((candidate) => candidate.sprite !== hazardSprite);
    const points = this.scoreSystem.addBase(LEVEL4.JAVA_COFFEE_HAZARD_SCORE);
    FloatingText.spawn(this, x, y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("common.points", { points }), "#f97316");
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    if (hazard) {
      hazard.dir = 1;
    }
    this.time.delayedCall(0, () => hazardSprite.destroy());
  }

  private consumeCoffeeProjectile(projectile: Phaser.Physics.Arcade.Sprite): void {
    projectile.setData("spent", true);
    projectile.disableBody(true, true);
    this.time.delayedCall(0, () => projectile.destroy());
  }

  private activatePlayerJetpack(): void {
    this.playerJetpackUntil = this.time.now + LEVEL4.JETPACK_DURATION_MS;
    this.nextPlayerSmokeAt = 0;
    this.scoreSystem.addSkill(LEVEL4.BOOST_SCORE);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "פרוטקציות", "#fef08a");
  }

  private activateRivalJetpack(rival: Rival): void {
    rival.setData("jetpackUntil", this.time.now + LEVEL4.JETPACK_DURATION_MS * 0.78);
    rival.setData("nextSmokeAt", 0);
    FloatingText.spawn(this, rival.x, rival.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "Connections", "#9bdcff");
  }

  private isPlayerJetpackActive(): boolean {
    return this.time.now < this.playerJetpackUntil;
  }

  private isRivalJetpackActive(rival: Rival): boolean {
    return this.time.now < ((rival.getData("jetpackUntil") as number | undefined) ?? 0);
  }

  private updatePlayerJetpackFlight(): void {
    this.player.setTexture("level4-player-jetpack");
    scaleSpriteToHeight(this.player, scaleY(58));
    this.player.setVelocityY(-scaleY(LEVEL4.JETPACK_SPEED));
    this.player.setAngle(Math.sin(this.time.now / 130) * 4);
    this.player.clearTint();
    if (this.time.now >= this.nextPlayerSmokeAt) {
      this.nextPlayerSmokeAt = this.time.now + LEVEL4.JETPACK_SMOKE_INTERVAL_MS;
      this.spawnJetpackSmoke(this.player.x - scaleX(8), this.player.y + this.player.displayHeight * 0.32, this.player.depth - 1);
      this.spawnJetpackSmoke(this.player.x + scaleX(13), this.player.y + this.player.displayHeight * 0.31, this.player.depth - 1);
    }
  }

  private updateRivalJetpackFlight(rival: Rival): void {
    rival.setVelocityY(-scaleY(LEVEL4.JETPACK_SPEED * 0.82));
    rival.setAngle(Math.sin(this.time.now / 150 + rival.x) * 5);
    const nextSmokeAt = (rival.getData("nextSmokeAt") as number | undefined) ?? 0;
    if (this.time.now >= nextSmokeAt) {
      rival.setData("nextSmokeAt", this.time.now + LEVEL4.JETPACK_SMOKE_INTERVAL_MS * 1.4);
      this.spawnJetpackSmoke(rival.x, rival.y + rival.displayHeight * 0.38, rival.depth - 1);
    }
  }

  private spawnJetpackSmoke(x: number, y: number, depth: number): void {
    const smoke = this.add
      .image(x + scaleX(rngInt(-5, 5)), y + scaleY(rngInt(-2, 4)), "level4-jetpack-smoke")
      .setDisplaySize(scaleX(rngInt(15, 24)), scaleY(rngInt(11, 18)))
      .setAlpha(0.72)
      .setAngle(rngInt(-18, 18))
      .setDepth(depth);
    this.tweens.add({
      targets: smoke,
      x: smoke.x + scaleX(rngInt(-10, 10)),
      y: smoke.y + scaleY(rngInt(12, 24)),
      alpha: 0,
      scaleX: smoke.scaleX * 1.65,
      scaleY: smoke.scaleY * 1.65,
      angle: smoke.angle + rngInt(-24, 24),
      duration: 420,
      ease: "Sine.easeOut",
      onComplete: () => smoke.destroy()
    });
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

  private syncCameraToPlayer(): void {
    this.cameraScrollY = Phaser.Math.Clamp(
      this.player.y - this.scale.height * LEVEL4.CAMERA_PLAYER_LEAD_RATIO,
      0,
      this.maxCameraScrollY
    );
    this.cameras.main.setScroll(0, this.cameraScrollY);
  }

  private dropRivalFloors(rival: Rival, floors: number): void {
    const y = Phaser.Math.Clamp(
      rival.y + scaleY(LEVEL4.PLATFORM_STEP_Y * floors),
      scaleY(LEVEL4.DOOR_Y),
      scaleY(LEVEL4.WORLD_HEIGHT - 24)
    );
    rival.setPosition(rival.x, y);
    rival.setVelocityY(scaleY(LEVEL4.HAZARD_DROP_VELOCITY));
    rival.setVelocityX(scaleX(rngInt(-110, 110)));
    rival.setData("overtaken", false);
    rival.setData("nextJumpAt", this.time.now + rngInt(450, 1200));
    rival.setData("checkpointY", y);
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
    FloatingText.spawn(this, rival.x, rival.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "-10", "#f97316");
  }

  private pushNearbyRivals(): void {
    const nearby = this.rivals.filter((rival) => {
      if (!rival.active) {
        return false;
      }
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, rival.x, rival.y) <= scale(LEVEL4.RIVAL_INTERACT_RANGE);
    });
    if (nearby.length === 0) {
      return;
    }
    nearby.forEach((rival) => this.pushSprite(this.player, rival, 1.05));
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), t("level4.push"), "#fca5a5");
  }

  private pushSprite(attacker: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, multiplier: number): void {
    const dir = target.x < attacker.x ? -1 : 1;
    target.setVelocityX(dir * this.pushStrength * multiplier);
    target.setVelocityY(scaleY(LEVEL4.RIVAL_ATTACK_DOWN_VELOCITY));
  }

  private respawnRival(rival: Rival): void {
    const checkpointY = (rival.getData("checkpointY") as number | undefined) ?? scaleY(LEVEL4.RIVAL_SPAWN_Y);
    const platform = this.getClosestPlatformToY(checkpointY + scaleY(36)) ?? this.towerPlatforms[this.towerPlatforms.length - 1];
    rival.setPosition(platform.x, platform.y - scaleY(36));
    rival.setVelocity(0, -scaleY(LEVEL4.JUMP_SPEED * 0.55));
    rival.setData("overtaken", false);
    rival.setData("checkpointY", platform.y - scaleY(36));
    rival.setData("retargetAt", this.time.now);
    rival.setData("targetOffset", rngInt(-80, 80));
  }

  private getClosestPlatformToY(y: number): TowerPlatform | undefined {
    return this.towerPlatforms.reduce<TowerPlatform | undefined>((best, platform) => {
      if (!best) {
        return platform;
      }
      return Math.abs(platform.y - y) < Math.abs(best.y - y) ? platform : best;
    }, undefined);
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
    const ignoreUntil = (this.player.getData("ignoreFallResetUntil") as number | undefined) ?? 0;
    if (this.time.now < ignoreUntil) {
      return;
    }
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

  private handleRivalFinish(rival: Rival): void {
    if (this.levelCompleted || !rival.active) {
      return;
    }
    this.levelCompleted = true;
    this.playFinishDoorOpen();
    runState.hearts -= 1;
    runState.mistakes += 1;
    this.scoreSystem.addPenalty(LEVEL4.FALL_PENALTY);
    this.scoreSystem.breakCombo();
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    this.hud.updateAll();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), t("level4.rivalFinished"), "#ff6b6b");

    if (runState.hearts <= 0) {
      runState.hearts = 0;
      this.audio.playSfx("sfx-gameover", AUDIO.SFX.GAME_OVER);
      this.scene.start("GameOverScene");
      return;
    }

    const nextHearts = runState.hearts;
    this.time.delayedCall(LEVEL4.FALL_RESTART_DELAY_MS + 450, () => {
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
    this.tripHazards.forEach((hazard) => hazard.text.destroy());
    this.tripHazards = [];
    this.movingHazards = [];
    this.rivals = [];
  }

  private getPlatform(step: number): TowerPlatform | undefined {
    return this.towerPlatforms.find((platform) => platform.index === step);
  }

  private playFinishDoorOpen(): void {
    if (this.finishDoorOpening) {
      return;
    }
    this.finishDoorOpening = true;
    this.finishDoorGlow.setAlpha(0.05);
    this.tweens.add({
      targets: this.finishDoorGlow,
      alpha: 0.78,
      scaleX: 1.28,
      scaleY: 1.08,
      duration: 360,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: this.finishDoorLeft,
      x: this.finishDoorLeft.x - scaleX(44),
      angle: -3,
      alpha: 0.94,
      duration: 520,
      ease: "Cubic.easeOut"
    });
    this.tweens.add({
      targets: this.finishDoorRight,
      x: this.finishDoorRight.x + scaleX(44),
      angle: 3,
      alpha: 0.94,
      duration: 520,
      ease: "Cubic.easeOut"
    });
  }

  private completeLevel(): void {
    if (this.levelCompleted) {
      return;
    }
    this.levelCompleted = true;
    this.playFinishDoorOpen();
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
    this.time.delayedCall(LEVEL4.COMPLETE_DELAY_MS, () => this.scene.start("Level5IntroScene"));
  }
}

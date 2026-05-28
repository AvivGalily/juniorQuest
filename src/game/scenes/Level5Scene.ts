import Phaser from "phaser";
import { difficultyPresets } from "../../config/difficulty";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { AUDIO, FLOATING_TEXT, LEVEL5, RUN, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";
import { t } from "../i18n/i18n";
import { getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";

type BossProjectileKind = "energy" | "electric";
type BossHazardKind = BossProjectileKind | "wave" | "fire";
type PlayerFacingDirection = "left" | "right" | "up" | "down";
type PlayerProjectile = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
type ShotMultiplier = 2 | 3;
type BossBodyTextureKey =
  | "level5-computer-spider-body-angry"
  | "level5-computer-spider-body-scared"
  | "level5-computer-spider-body-crack-1"
  | "level5-computer-spider-body-crack-2"
  | "level5-computer-spider-body-broken";
type BossLeg = {
  sprite: Phaser.GameObjects.Image;
  side: -1 | 1;
  offsetX: number;
  offsetY: number;
  baseAngle: number;
  phase: number;
};
type PowerPylon = {
  sprite: Phaser.GameObjects.Image;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hp: number;
  nextSparkAt: number;
};
type MiniBoss = {
  sprite: Phaser.Physics.Arcade.Sprite;
  legs: BossLeg[];
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hp: number;
  moveTarget: Phaser.Math.Vector2;
  nextShotAt: number;
  contactCooldownUntil: number;
};

export class Level5Scene extends BaseLevelScene {
  protected declare player: Player;
  private boss!: Phaser.Physics.Arcade.Sprite;
  private bossLegs: BossLeg[] = [];
  private bossMoveTarget = new Phaser.Math.Vector2();
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private playerProjectiles: PlayerProjectile[] = [];
  private readonly playerWalkTextures = [
    "level5-player-keyboard-gun-walk-1",
    "level5-player-keyboard-gun-walk-2",
    "level5-player-keyboard-gun-walk-3"
  ];
  private readonly playerDragonWalkTextures = [
    "level5-player-dragon-keyboard-walk-1",
    "level5-player-dragon-keyboard-walk-2",
    "level5-player-dragon-keyboard-walk-3"
  ];
  private readonly playerFrontTextures = ["level5-player-keyboard-gun-front", "level5-player-keyboard-gun-front-walk"];
  private readonly playerBackTextures = ["level5-player-keyboard-gun-back", "level5-player-keyboard-gun-back-walk"];
  private readonly playerDragonFrontTextures = ["level5-player-dragon-keyboard-front", "level5-player-dragon-keyboard-front-walk"];
  private readonly playerDragonBackTextures = ["level5-player-dragon-keyboard-back", "level5-player-dragon-keyboard-back-walk"];
  private playerWalkFrame = 1;
  private nextPlayerWalkFrameAt = 0;
  private playerTextureKey = "";
  private playerFacingDirection: PlayerFacingDirection = "right";
  private bossBodyTextureKey: BossBodyTextureKey = "level5-computer-spider-body-angry";
  private arena!: Phaser.Geom.Rectangle;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private bossMaxHp: number = LEVEL5.BOSS_HP;
  private bossHp: number = LEVEL5.BOSS_HP;
  private bossHpFill!: Phaser.GameObjects.Rectangle;
  private bossHpText!: Phaser.GameObjects.Text;
  private miniBossTriggerHp: number = LEVEL5.MINI_BOSS_TRIGGER_HP;
  private miniBossCount: number = LEVEL5.MINI_BOSS_COUNT;
  private attackTimer?: Phaser.Time.TimerEvent;
  private waveTimer?: Phaser.Time.TimerEvent;
  private tauntTimer?: Phaser.Time.TimerEvent;
  private heartPickupTimer?: Phaser.Time.TimerEvent;
  private heartPickups: Phaser.GameObjects.Image[] = [];
  private dragonWeaponTimer?: Phaser.Time.TimerEvent;
  private dragonWeaponPickup?: Phaser.GameObjects.Image;
  private shotMultiplierTimer?: Phaser.Time.TimerEvent;
  private shotMultiplierPickup?: Phaser.GameObjects.Text;
  private pylonTimer?: Phaser.Time.TimerEvent;
  private powerPylons: PowerPylon[] = [];
  private miniBosses: MiniBoss[] = [];
  private hasDragonWeapon = false;
  private activeShotMultiplier: ShotMultiplier | 1 = 1;
  private shotMultiplierExpiresAt = 0;
  private fightActive = false;
  private isJumping = false;
  private nextShotAt = 0;
  private nextJumpAt = 0;
  private scaredFaceUntil = 0;
  private bossStunnedUntil = 0;
  private miniBossPhaseTriggered = false;
  private playerBaseScaleX = 1;
  private playerBaseScaleY = 1;
  private shadowBaseScaleX = 1;
  private shadowBaseScaleY = 1;

  constructor() {
    super("Level5Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL5);

    if (runState.difficulty === "university") {
      runState.hearts = 5;
    } else if (runState.difficulty === "college") {
      runState.hearts = 4;
    } else if (runState.difficulty === "bootcamp") {
      runState.hearts = 3;
    }
    this.hud.updateAll();

    this.resetRuntimeState();
    this.audio.playMusic("music-level5-intense", AUDIO.MUSIC.BOSS_INTENSE);
    this.physics.world.gravity.y = LEVEL5.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.createCombatTextures();
    this.add
      .image(this.scale.width / 2, this.scale.height / 2, "level5-broken-office-bg")
      .setDisplaySize(this.scale.width, this.scale.height)
      .setDepth(0);

    this.arena = new Phaser.Geom.Rectangle(
      scaleX(LEVEL5.ARENA_X),
      scaleY(LEVEL5.ARENA_Y),
      scaleX(LEVEL5.ARENA_WIDTH),
      scaleY(LEVEL5.ARENA_HEIGHT)
    );

    this.createPlayer();
    this.createBoss();
    this.createBossHpUi();

    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.bossProjectiles, (_, projectile) => {
      this.handlePlayerProjectileHit(projectile as Phaser.Physics.Arcade.Image);
    });

    this.startFight();
  }

  private resetRuntimeState(): void {
    this.bossLegs = [];
    this.playerProjectiles = [];
    this.playerWalkFrame = 1;
    this.nextPlayerWalkFrameAt = 0;
    this.playerTextureKey = "";
    this.playerFacingDirection = "right";
    this.bossBodyTextureKey = "level5-computer-spider-body-angry";
    const diff = difficultyPresets[runState.difficulty];
    this.bossMaxHp = diff.l5.bossHp;
    this.bossHp = this.bossMaxHp;
    this.miniBossTriggerHp = diff.l5.miniBossTriggerHp;
    this.miniBossCount = diff.l5.miniBossCount;
    this.attackTimer = undefined;
    this.waveTimer = undefined;
    this.tauntTimer = undefined;
    this.heartPickupTimer = undefined;
    this.heartPickups = [];
    this.dragonWeaponTimer = undefined;
    this.dragonWeaponPickup = undefined;
    this.shotMultiplierTimer = undefined;
    this.shotMultiplierPickup = undefined;
    this.pylonTimer = undefined;
    this.powerPylons = [];
    this.miniBosses = [];
    this.hasDragonWeapon = false;
    this.activeShotMultiplier = 1;
    this.shotMultiplierExpiresAt = 0;
    this.fightActive = false;
    this.isJumping = false;
    this.nextShotAt = 0;
    this.nextJumpAt = 0;
    this.scaredFaceUntil = 0;
    this.bossStunnedUntil = 0;
    this.miniBossPhaseTriggered = false;
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }

    this.updatePlayer(delta);
    this.checkHeartPickup();
    this.checkDragonWeaponPickup();
    this.checkShotMultiplierPickup();
    this.updateShotMultiplierState();
    this.updateBoss(delta);
    this.updateMiniBosses(delta);
    this.updatePowerPylons();
    this.updateProjectiles(delta);
    this.hud.updateAll();
  }

  private createPlayer(): void {
    this.playerShadow = this.add
      .ellipse(
        scaleX(LEVEL5.PLAYER_START.x),
        scaleY(LEVEL5.PLAYER_START.y + LEVEL5.SHADOW_OFFSET_Y),
        scaleX(38),
        scaleY(10),
        0x020617,
        0.34
      )
      .setDepth(9);
    this.shadowBaseScaleX = this.playerShadow.scaleX;
    this.shadowBaseScaleY = this.playerShadow.scaleY;

    this.player = new Player(this, scaleX(LEVEL5.PLAYER_START.x), scaleY(LEVEL5.PLAYER_START.y));
    this.setLevel5PlayerTexture(this.playerWalkTextures[this.playerWalkFrame]);
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(false);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.applyPlayerBodySize();
    this.setPlayer(this.player);
  }

  private setLevel5PlayerTexture(textureKey: string): boolean {
    if (this.playerTextureKey === textureKey) {
      return false;
    }
    this.player.setTexture(textureKey);
    this.playerTextureKey = textureKey;
    this.player.setDisplaySize(scaleX(LEVEL5.PLAYER_DISPLAY_WIDTH), scaleY(LEVEL5.PLAYER_DISPLAY_HEIGHT));
    this.playerBaseScaleX = this.player.scaleX;
    this.playerBaseScaleY = this.player.scaleY;
    return true;
  }

  private applyPlayerBodySize(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      this.player.width * LEVEL5.PLAYER_BODY_WIDTH_RATIO,
      this.player.height * LEVEL5.PLAYER_BODY_HEIGHT_RATIO,
      false
    );
    body.setOffset((this.player.width - body.width) / 2, this.player.height * 0.46);
  }

  private createBoss(): void {
    this.boss = this.physics.add.sprite(scaleX(LEVEL5.BOSS_X), scaleY(LEVEL5.BOSS_Y), this.bossBodyTextureKey);
    this.boss.setDisplaySize(scaleX(LEVEL5.BOSS_DISPLAY_WIDTH), scaleY(LEVEL5.BOSS_DISPLAY_HEIGHT));
    this.boss.setDepth(19);
    this.boss.setImmovable(true);

    this.applyBossBodySize();

    this.createBossLegs();
    this.assignBossMoveTarget();
    this.updateBossLegs();
  }

  private applyBossBodySize(): void {
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(
      this.boss.width * LEVEL5.BOSS_BODY_WIDTH_RATIO,
      this.boss.height * LEVEL5.BOSS_BODY_HEIGHT_RATIO,
      false
    );
    body.setOffset(
      (this.boss.width - body.width) / 2,
      this.boss.height * LEVEL5.BOSS_BODY_OFFSET_Y_RATIO
    );
  }

  private createBossLegs(): void {
    const legDefs: Array<Omit<BossLeg, "sprite">> = [
      { side: -1, offsetX: -41, offsetY: -24, baseAngle: -19, phase: 0 },
      { side: -1, offsetX: -48, offsetY: -5, baseAngle: -4, phase: Math.PI },
      { side: -1, offsetX: -42, offsetY: 15, baseAngle: 13, phase: Math.PI * 0.55 },
      { side: -1, offsetX: -24, offsetY: 31, baseAngle: 31, phase: Math.PI * 1.45 },
      { side: 1, offsetX: 41, offsetY: -24, baseAngle: 19, phase: Math.PI },
      { side: 1, offsetX: 48, offsetY: -5, baseAngle: 4, phase: 0 },
      { side: 1, offsetX: 42, offsetY: 15, baseAngle: -13, phase: Math.PI * 1.55 },
      { side: 1, offsetX: 24, offsetY: 31, baseAngle: -31, phase: Math.PI * 0.45 }
    ];

    this.bossLegs = legDefs.map((def) => {
      const leg = this.add
        .image(this.boss.x, this.boss.y, "level5-computer-spider-leg")
        .setDisplaySize(scaleX(LEVEL5.BOSS_LEG_DISPLAY_WIDTH), scaleY(LEVEL5.BOSS_LEG_DISPLAY_HEIGHT))
        .setOrigin(def.side < 0 ? 0.78 : 0.22, 0.16)
        .setFlipX(def.side < 0)
        .setDepth(def.offsetY > 36 ? 20 : 17);
      return { ...def, sprite: leg };
    });
  }

  private createBossHpUi(): void {
    const x = scaleX(LEVEL5.HP_BAR_X);
    const y = scaleY(LEVEL5.HP_BAR_Y);
    const width = scaleX(LEVEL5.HP_BAR_WIDTH);
    const height = scaleY(LEVEL5.HP_BAR_HEIGHT);

    this.add
      .rectangle(x - scaleX(4), y, width + scaleX(8), height + scaleY(8), 0x020617, 0.86)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1002);
    this.add
      .rectangle(x, y, width, height, 0x3b0b16, 0.92)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1003);
    this.bossHpFill = this.add
      .rectangle(x, y, width, height, 0x38f6ff, 0.96)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1004);
    this.add
      .rectangle(x, y, width, height, 0xffffff, 0)
      .setStrokeStyle(scale(1), 0xdbeafe, 0.9)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1005);
    this.bossHpText = this.add
      .text(scaleX(LEVEL5.HP_LABEL_X), scaleY(LEVEL5.HP_LABEL_Y), "", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${scale(LEVEL5.HP_FONT_SIZE)}px`,
        color: "#f8fafc",
        fontStyle: "bold",
        stroke: "#020617",
        strokeThickness: scale(2),
        align: "center"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1006);

    this.updateBossHpUi();
  }

  private createCombatTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = 72;
    const center = size / 2;

    if (!this.textures.exists("level5-energy-ball")) {
      g.clear();
      g.fillStyle(0x67e8f9, 0.22);
      g.fillCircle(center, center, 34);
      g.fillStyle(0x22d3ee, 0.78);
      g.fillCircle(center, center, 22);
      g.fillStyle(0xf8fafc, 0.95);
      g.fillCircle(center - 6, center - 7, 8);
      g.lineStyle(3, 0xa7f3d0, 0.9);
      g.strokeCircle(center, center, 25);
      g.generateTexture("level5-energy-ball", size, size);
      this.textures.get("level5-energy-ball").setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    if (!this.textures.exists("level5-electric-ball")) {
      g.clear();
      g.fillStyle(0x818cf8, 0.24);
      g.fillCircle(center, center, 34);
      g.fillStyle(0xc084fc, 0.82);
      g.fillCircle(center, center, 20);
      g.fillStyle(0xfef08a, 0.96);
      g.fillCircle(center + 4, center - 4, 7);
      g.lineStyle(4, 0xfef08a, 0.95);
      g.lineBetween(17, 25, 31, 18);
      g.lineBetween(31, 18, 27, 35);
      g.lineBetween(27, 35, 47, 29);
      g.lineBetween(47, 29, 38, 52);
      g.lineStyle(2, 0x22d3ee, 0.72);
      g.strokeCircle(center, center, 27);
      g.generateTexture("level5-electric-ball", size, size);
      this.textures.get("level5-electric-ball").setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    if (!this.textures.exists("level5-energy-wave")) {
      g.clear();
      g.lineStyle(9, 0x67e8f9, 0.34);
      g.beginPath();
      g.arc(center, center, 28, Phaser.Math.DegToRad(235), Phaser.Math.DegToRad(125), false);
      g.strokePath();
      g.lineStyle(5, 0xfef08a, 0.78);
      g.beginPath();
      g.arc(center, center, 23, Phaser.Math.DegToRad(235), Phaser.Math.DegToRad(125), false);
      g.strokePath();
      g.lineStyle(2, 0xffffff, 0.9);
      g.beginPath();
      g.arc(center, center, 17, Phaser.Math.DegToRad(235), Phaser.Math.DegToRad(125), false);
      g.strokePath();
      g.generateTexture("level5-energy-wave", size, size);
      this.textures.get("level5-energy-wave").setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    g.destroy();
  }

  private startFight(): void {
    this.fightActive = true;
    this.attackTimer = this.time.addEvent({
      delay: LEVEL5.BOSS_ATTACK_INTERVAL_MS,
      loop: true,
      callback: () => this.spawnBossAttack()
    });
    this.waveTimer = this.time.addEvent({
      delay: LEVEL5.BOSS_WAVE_INTERVAL_MS,
      loop: true,
      callback: () => this.spawnEnergyWaves()
    });
    this.tauntTimer = this.time.addEvent({
      delay: LEVEL5.BOSS_TAUNT_INTERVAL_MS,
      loop: true,
      callback: () => this.showBossTaunt()
    });
    this.dragonWeaponTimer = this.time.delayedCall(LEVEL5.DRAGON_WEAPON_SPAWN_DELAY_MS, () => this.spawnDragonWeaponPickup());
    this.scheduleNextShotMultiplierPickup();
    this.scheduleNextPowerPylon();
    this.scheduleNextHeartPickup();
    this.time.delayedCall(LEVEL5.BOSS_INTRO_VOICE_DELAY_MS, () => this.showBossIntroVoice());
  }

  private updateBoss(_: number): void {
    if (!this.boss.active) {
      return;
    }

    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    const active = this.fightActive && this.bossHp > 0 && !this.isBossStunned();
    if (active) {
      const distanceToTarget = Phaser.Math.Distance.Between(
        this.boss.x,
        this.boss.y,
        this.bossMoveTarget.x,
        this.bossMoveTarget.y
      );
      if (distanceToTarget < scale(LEVEL5.BOSS_TARGET_REACHED_RANGE)) {
        this.assignBossMoveTarget();
      }

      const direction = new Phaser.Math.Vector2(this.bossMoveTarget.x - this.boss.x, this.bossMoveTarget.y - this.boss.y);
      if (direction.lengthSq() > 1) {
        direction.normalize();
      }
      body.setVelocity(direction.x * scale(LEVEL5.BOSS_PATROL_SPEED), direction.y * scale(LEVEL5.BOSS_PATROL_SPEED));
      this.clampBossToArena();
    } else {
      body.setVelocity(0, 0);
    }

    const movement = Math.hypot(body.velocity.x, body.velocity.y);
    this.boss.setAngle(Math.sin(this.time.now * 0.006) * (movement > 1 ? 1.4 : 0.6));
    this.updateBossLegs();
    this.syncBossBodyTexture();
  }

  private assignBossMoveTarget(): void {
    const minX = Math.round(this.arena.left + scaleX(152));
    const maxX = Math.round(this.arena.right - scaleX(92));
    const minY = Math.round(this.arena.top + scaleY(46));
    const maxY = Math.round(this.arena.bottom - scaleY(102));
    this.bossMoveTarget.set(
      Phaser.Math.Between(Math.min(minX, maxX), Math.max(minX, maxX)),
      Phaser.Math.Between(Math.min(minY, maxY), Math.max(minY, maxY))
    );
  }

  private clampBossToArena(): void {
    const halfWidth = this.boss.displayWidth * 0.26;
    const halfHeight = this.boss.displayHeight * 0.24;
    this.boss.x = Phaser.Math.Clamp(this.boss.x, this.arena.left + halfWidth, this.arena.right - halfWidth);
    this.boss.y = Phaser.Math.Clamp(this.boss.y, this.arena.top + halfHeight, this.arena.bottom - halfHeight - scaleY(42));
  }

  private updateBossLegs(): void {
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    const speedRatio = this.isBossStunned()
      ? 0
      : Phaser.Math.Clamp(Math.hypot(body.velocity.x, body.velocity.y) / scale(LEVEL5.BOSS_PATROL_SPEED), 0.28, 1);
    const walkTime = this.time.now * LEVEL5.BOSS_LEG_WALK_SPEED * speedRatio;

    for (const leg of this.bossLegs) {
      const cycle = walkTime + leg.phase;
      const swing = Math.sin(cycle);
      const lift = Math.max(0, Math.cos(cycle));
      leg.sprite.setPosition(
        this.boss.x + scaleX(leg.offsetX + swing * LEVEL5.BOSS_LEG_SWING_X * leg.side),
        this.boss.y + scaleY(leg.offsetY - lift * LEVEL5.BOSS_LEG_LIFT_Y)
      );
      leg.sprite.setAngle(leg.baseAngle + swing * LEVEL5.BOSS_LEG_SWING_ANGLE);
      leg.sprite.setAlpha(this.bossHp > 0 ? 1 : 0.82);
    }
  }

  private triggerMiniBossPhase(): void {
    this.miniBossPhaseTriggered = true;
    this.audio.playSfx("sfx-phase", AUDIO.SFX.PHASE);
    this.showBossTaunt("level5.tauntRuleWorld");
    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xfef08a, 0.34);
    flash.setDepth(1101);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: LEVEL5.MINI_BOSS_SPAWN_FLASH_MS,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });

    this.time.delayedCall(LEVEL5.MINI_BOSS_SPAWN_FLASH_MS * 0.45, () => {
      if (!this.fightActive || this.bossHp <= 0) {
        return;
      }
      for (let i = 0; i < this.miniBossCount; i += 1) {
        this.spawnMiniBoss(i);
      }
    });
  }

  private spawnMiniBoss(index: number): void {
    const x = index % 3 === 2 ? this.arena.centerX : index % 2 === 0 ? this.arena.left + scaleX(104) : this.arena.right - scaleX(104);
    const y = this.arena.top + (this.arena.height * (index + 1)) / (this.miniBossCount + 1);
    const sprite = this.physics.add.sprite(x, y, "level5-robot-mouse-body");
    sprite.setDisplaySize(scaleX(LEVEL5.MINI_BOSS_DISPLAY_WIDTH), scaleY(LEVEL5.MINI_BOSS_DISPLAY_HEIGHT));
    sprite.setDepth(18);
    sprite.setImmovable(true);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(
      sprite.width * LEVEL5.MINI_BOSS_BODY_WIDTH_RATIO,
      sprite.height * LEVEL5.MINI_BOSS_BODY_HEIGHT_RATIO,
      false
    );
    body.setOffset(
      (sprite.width - body.width) / 2,
      sprite.height * LEVEL5.MINI_BOSS_BODY_OFFSET_Y_RATIO
    );

    const hpBarWidth = scaleX(LEVEL5.MINI_BOSS_DISPLAY_WIDTH);
    const hpBarHeight = Math.max(4, scaleY(5));
    const hpBarY = y - sprite.displayHeight / 2 - scaleY(10);
    const hpBarBg = this.add.rectangle(x, hpBarY, hpBarWidth, hpBarHeight, 0x111827, 0.82).setDepth(28);
    hpBarBg.setStrokeStyle(Math.max(1, scale(1)), 0xfca5a5, 0.9);
    const hpBarFill = this.add
      .rectangle(x - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0xef4444, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(29);

    const miniBoss: MiniBoss = {
      sprite,
      legs: this.createMiniBossLegs(sprite),
      hpBarBg,
      hpBarFill,
      hp: LEVEL5.MINI_BOSS_HP,
      moveTarget: new Phaser.Math.Vector2(),
      nextShotAt: this.time.now + LEVEL5.MINI_BOSS_FIREBALL_INTERVAL_MS,
      contactCooldownUntil: 0
    };
    this.assignMiniBossMoveTarget(miniBoss);
    this.miniBosses.push(miniBoss);
    this.showMiniBossSpawnEffect(x, y);
  }

  private createMiniBossLegs(sprite: Phaser.Physics.Arcade.Sprite): BossLeg[] {
    const legDefs: Array<Omit<BossLeg, "sprite">> = [
      { side: -1, offsetX: -30, offsetY: -15, baseAngle: -28, phase: 0 },
      { side: -1, offsetX: -34, offsetY: 4, baseAngle: -8, phase: Math.PI },
      { side: -1, offsetX: -25, offsetY: 20, baseAngle: 24, phase: Math.PI * 0.55 },
      { side: 1, offsetX: 30, offsetY: -15, baseAngle: 28, phase: Math.PI },
      { side: 1, offsetX: 34, offsetY: 4, baseAngle: 8, phase: 0 },
      { side: 1, offsetX: 25, offsetY: 20, baseAngle: -24, phase: Math.PI * 1.55 }
    ];

    return legDefs.map((def) => {
      const leg = this.add
        .image(sprite.x, sprite.y, "level5-robot-mouse-leg")
        .setDisplaySize(scaleX(LEVEL5.MINI_BOSS_LEG_DISPLAY_WIDTH), scaleY(LEVEL5.MINI_BOSS_LEG_DISPLAY_HEIGHT))
        .setOrigin(def.side < 0 ? 0.74 : 0.26, 0.14)
        .setFlipX(def.side < 0)
        .setDepth(def.offsetY > 18 ? 19 : 16);
      return { ...def, sprite: leg };
    });
  }

  private showMiniBossSpawnEffect(x: number, y: number): void {
    const ring = this.add.circle(x, y, scale(18), 0xffffff, 0).setStrokeStyle(scale(3), 0xfef08a, 0.9).setDepth(34);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private updateMiniBosses(_: number): void {
    for (const miniBoss of [...this.miniBosses]) {
      if (!miniBoss.sprite.active || miniBoss.hp <= 0) {
        continue;
      }
      const body = miniBoss.sprite.body as Phaser.Physics.Arcade.Body;
      const distanceToTarget = Phaser.Math.Distance.Between(
        miniBoss.sprite.x,
        miniBoss.sprite.y,
        miniBoss.moveTarget.x,
        miniBoss.moveTarget.y
      );
      if (distanceToTarget < scale(LEVEL5.MINI_BOSS_TARGET_REACHED_RANGE)) {
        this.assignMiniBossMoveTarget(miniBoss);
      }

      const direction = new Phaser.Math.Vector2(miniBoss.moveTarget.x - miniBoss.sprite.x, miniBoss.moveTarget.y - miniBoss.sprite.y);
      if (direction.lengthSq() > 1) {
        direction.normalize();
      }
      body.setVelocity(direction.x * scale(LEVEL5.MINI_BOSS_PATROL_SPEED), direction.y * scale(LEVEL5.MINI_BOSS_PATROL_SPEED));
      this.clampMiniBossToArena(miniBoss);
      miniBoss.sprite.setAngle(Math.sin(this.time.now * 0.009 + miniBoss.sprite.x) * 1.2);
      this.updateMiniBossLegs(miniBoss);
      this.updateMiniBossHpBar(miniBoss);

      if (this.time.now >= miniBoss.nextShotAt) {
        miniBoss.nextShotAt = this.time.now + LEVEL5.MINI_BOSS_FIREBALL_INTERVAL_MS;
        this.spawnMiniBossFireball(miniBoss);
      }
      this.checkMiniBossContact(miniBoss);
    }
    this.miniBosses = this.miniBosses.filter((miniBoss) => miniBoss.sprite.active);
  }

  private assignMiniBossMoveTarget(miniBoss: MiniBoss): void {
    const minX = Math.round(this.arena.left + scaleX(70));
    const maxX = Math.round(this.arena.right - scaleX(70));
    const minY = Math.round(this.arena.top + scaleY(54));
    const maxY = Math.round(this.arena.bottom - scaleY(58));
    const chasePlayer = Phaser.Math.Between(0, 100) < 45;
    miniBoss.moveTarget.set(
      chasePlayer ? this.player.x + Phaser.Math.Between(-scaleX(50), scaleX(50)) : Phaser.Math.Between(minX, maxX),
      chasePlayer ? this.player.y + Phaser.Math.Between(-scaleY(38), scaleY(38)) : Phaser.Math.Between(minY, maxY)
    );
    miniBoss.moveTarget.x = Phaser.Math.Clamp(miniBoss.moveTarget.x, minX, maxX);
    miniBoss.moveTarget.y = Phaser.Math.Clamp(miniBoss.moveTarget.y, minY, maxY);
  }

  private clampMiniBossToArena(miniBoss: MiniBoss): void {
    const halfWidth = miniBoss.sprite.displayWidth * 0.32;
    const halfHeight = miniBoss.sprite.displayHeight * 0.34;
    miniBoss.sprite.x = Phaser.Math.Clamp(miniBoss.sprite.x, this.arena.left + halfWidth, this.arena.right - halfWidth);
    miniBoss.sprite.y = Phaser.Math.Clamp(miniBoss.sprite.y, this.arena.top + halfHeight, this.arena.bottom - halfHeight);
  }

  private updateMiniBossLegs(miniBoss: MiniBoss): void {
    const body = miniBoss.sprite.body as Phaser.Physics.Arcade.Body;
    const speedRatio = Phaser.Math.Clamp(Math.hypot(body.velocity.x, body.velocity.y) / scale(LEVEL5.MINI_BOSS_PATROL_SPEED), 0.28, 1);
    const walkTime = this.time.now * LEVEL5.MINI_BOSS_LEG_WALK_SPEED * speedRatio;
    for (const leg of miniBoss.legs) {
      const cycle = walkTime + leg.phase;
      const swing = Math.sin(cycle);
      const lift = Math.max(0, Math.cos(cycle));
      leg.sprite.setPosition(
        miniBoss.sprite.x + scaleX(leg.offsetX + swing * LEVEL5.MINI_BOSS_LEG_SWING_X * leg.side),
        miniBoss.sprite.y + scaleY(leg.offsetY - lift * LEVEL5.MINI_BOSS_LEG_LIFT_Y)
      );
      leg.sprite.setAngle(leg.baseAngle + swing * LEVEL5.MINI_BOSS_LEG_SWING_ANGLE);
    }
  }

  private updateMiniBossHpBar(miniBoss: MiniBoss): void {
    const width = scaleX(LEVEL5.MINI_BOSS_DISPLAY_WIDTH);
    const y = miniBoss.sprite.y - miniBoss.sprite.displayHeight / 2 - scaleY(10);
    const percent = Phaser.Math.Clamp(miniBoss.hp / LEVEL5.MINI_BOSS_HP, 0, 1);
    miniBoss.hpBarBg.setPosition(miniBoss.sprite.x, y);
    miniBoss.hpBarFill.setPosition(miniBoss.sprite.x - width / 2, y);
    miniBoss.hpBarFill.setDisplaySize(width * percent, Math.max(4, scaleY(5)));
    miniBoss.hpBarFill.setFillStyle(percent > 0.45 ? 0xef4444 : 0xf97316, 0.95);
  }

  private spawnMiniBossFireball(miniBoss: MiniBoss): void {
    if (!this.fightActive || !miniBoss.sprite.active) {
      return;
    }
    const angle = Phaser.Math.Angle.Between(miniBoss.sprite.x, miniBoss.sprite.y, this.player.x, this.player.y);
    const fireball = this.physics.add.image(miniBoss.sprite.x, miniBoss.sprite.y + scaleY(10), "linked-snake-fireball");
    fireball.setDisplaySize(scale(LEVEL5.MINI_BOSS_FIREBALL_SIZE), scale(LEVEL5.MINI_BOSS_FIREBALL_SIZE));
    fireball.setDepth(28);
    fireball.setData("kind", "fire" satisfies BossHazardKind);
    const body = fireball.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(fireball.width * 0.35);
    this.bossProjectiles.add(fireball);
    body.setVelocity(Math.cos(angle) * scale(LEVEL5.MINI_BOSS_FIREBALL_SPEED), Math.sin(angle) * scale(LEVEL5.MINI_BOSS_FIREBALL_SPEED));
    this.audio.playSfx("sfx-fire-spit", AUDIO.SFX.FIRE * 0.52);
    this.time.delayedCall(LEVEL5.BOSS_PROJECTILE_LIFETIME_MS, () => {
      if (fireball.active) {
        fireball.destroy();
      }
    });
  }

  private checkMiniBossContact(miniBoss: MiniBoss): void {
    if (this.time.now < miniBoss.contactCooldownUntil || this.isJumping || this.invulnerable) {
      return;
    }
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.getMiniBossHitBox(miniBoss))) {
      return;
    }
    miniBoss.contactCooldownUntil = this.time.now + LEVEL5.MINI_BOSS_CONTACT_COOLDOWN_MS;
    this.applyDamage(() => {
      const angle = Phaser.Math.Angle.Between(miniBoss.sprite.x, miniBoss.sprite.y, this.player.x, this.player.y);
      this.player.x += Math.cos(angle) * scale(LEVEL5.PLAYER_DAMAGE_KNOCKBACK);
      this.player.y += Math.sin(angle) * scale(LEVEL5.PLAYER_DAMAGE_KNOCKBACK);
      this.clampPlayerToArena();
      this.updatePlayerShadow();
    });
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("common.heartLost"),
      "#ff6b6b"
    );
    this.hud.updateAll();
  }

  private getMiniBossHitBox(miniBoss: MiniBoss): Phaser.Geom.Rectangle {
    const body = miniBoss.sprite.body as Phaser.Physics.Arcade.Body;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  private getHitMiniBoss(shot: PlayerProjectile): MiniBoss | undefined {
    const shotBounds = shot.getBounds();
    return this.miniBosses.find(
      (miniBoss) => miniBoss.sprite.active && miniBoss.hp > 0 && Phaser.Geom.Intersects.RectangleToRectangle(shotBounds, this.getMiniBossHitBox(miniBoss))
    );
  }

  private handleMiniBossHit(miniBoss: MiniBoss, shot: PlayerProjectile): void {
    const damage = (shot.getData("damage") as number | undefined) ?? 1;
    shot.destroy();
    miniBoss.hp = Math.max(0, miniBoss.hp - damage);
    this.scoreSystem.addSkill(LEVEL5.PLAYER_PROJECTILE_SCORE * damage);
    this.updateMiniBossHpBar(miniBoss);
    if (miniBoss.hp <= 0) {
      this.destroyMiniBoss(miniBoss);
      return;
    }
    miniBoss.sprite.setTintFill(0xfef08a);
    miniBoss.legs.forEach((leg) => leg.sprite.setTintFill(0xfef08a));
    this.time.delayedCall(70, () => {
      if (miniBoss.sprite.active) {
        miniBoss.sprite.clearTint();
        miniBoss.legs.forEach((leg) => leg.sprite.clearTint());
      }
    });
  }

  private destroyMiniBoss(miniBoss: MiniBoss): void {
    const x = miniBoss.sprite.x;
    const y = miniBoss.sprite.y;
    this.miniBosses = this.miniBosses.filter((candidate) => candidate !== miniBoss);
    this.tweens.killTweensOf(miniBoss.sprite);
    miniBoss.legs.forEach((leg) => {
      this.tweens.killTweensOf(leg.sprite);
      leg.sprite.destroy();
    });
    miniBoss.hpBarBg.destroy();
    miniBoss.hpBarFill.destroy();
    miniBoss.sprite.destroy();
    this.showMiniBossExplosion(x, y);
  }

  private showMiniBossExplosion(x: number, y: number): void {
    const flash = this.add.circle(x, y, scale(14), 0xf97316, 0.78).setDepth(38);
    this.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
    for (let i = 0; i < 14; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = scale(Phaser.Math.Between(18, 58));
      const particle = this.add
        .rectangle(x, y, scale(Phaser.Math.Between(3, 7)), scale(Phaser.Math.Between(2, 6)), Phaser.Math.RND.pick([0xf97316, 0xfef08a, 0x38f6ff, 0xe5e7eb]), 0.95)
        .setDepth(39)
        .setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        angle: particle.angle + Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(260, 540),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private syncBossBodyTexture(): void {
    if (!this.boss.active) {
      return;
    }
    const nextTexture = this.getBossBodyTextureKey();
    if (this.bossBodyTextureKey === nextTexture) {
      return;
    }
    this.bossBodyTextureKey = nextTexture;
    this.boss.setTexture(nextTexture);
    this.boss.setDisplaySize(scaleX(LEVEL5.BOSS_DISPLAY_WIDTH), scaleY(LEVEL5.BOSS_DISPLAY_HEIGHT));
    this.applyBossBodySize();
  }

  private getBossBodyTextureKey(): BossBodyTextureKey {
    if (this.bossHp <= this.bossMaxHp * 0.3) {
      return "level5-computer-spider-body-broken";
    }
    if (this.bossHp <= this.bossMaxHp * 0.6) {
      return "level5-computer-spider-body-crack-2";
    }
    if (this.bossHp <= this.bossMaxHp * 0.8) {
      return "level5-computer-spider-body-crack-1";
    }
    if (this.time.now < this.scaredFaceUntil) {
      return "level5-computer-spider-body-scared";
    }
    return "level5-computer-spider-body-angry";
  }

  private isBossStunned(): boolean {
    return this.time.now < this.bossStunnedUntil;
  }

  private updatePlayer(delta: number): void {
    const move = this.inputManager.getMoveVector();
    const moving = move.lengthSq() > 0.01;
    this.player.setVelocity(move.x * scale(LEVEL5.PLAYER_SPEED), move.y * scale(LEVEL5.PLAYER_SPEED));
    this.updatePlayerFacing(move);

    if (!this.isJumping) {
      this.updatePlayerWalkTexture(moving);
      this.player.setAngle(moving ? Math.sin(this.time.now * 0.018) * 2 : 0);
    }

    if (this.inputManager.justPressedJump()) {
      this.startJump();
    }
    if (this.fightActive && this.inputManager.isActionDown()) {
      this.shootBinaryProjectile();
    }

    this.clampPlayerToArena();
    this.updatePlayerShadow();
    this.updateJumpDust(delta);
  }

  private updatePlayerFacing(move: Phaser.Math.Vector2): void {
    if (move.lengthSq() <= 0.01) {
      return;
    }

    if (Math.abs(move.x) >= Math.abs(move.y)) {
      this.playerFacingDirection = move.x < 0 ? "left" : "right";
      this.player.setFlipX(this.playerFacingDirection === "left");
      return;
    }

    this.playerFacingDirection = move.y < 0 ? "up" : "down";
    this.player.setFlipX(false);
  }

  private updatePlayerWalkTexture(moving: boolean): void {
    if (this.playerFacingDirection === "up" || this.playerFacingDirection === "down") {
      const textures = this.getPlayerVerticalWalkTextures();
      if (!moving) {
        this.playerWalkFrame = 0;
      } else if (this.time.now >= this.nextPlayerWalkFrameAt) {
        this.playerWalkFrame = (this.playerWalkFrame + 1) % textures.length;
        this.nextPlayerWalkFrameAt = this.time.now + LEVEL5.PLAYER_WALK_FRAME_MS;
      }
      const textureKey = textures[this.playerWalkFrame % textures.length];
      if (this.setLevel5PlayerTexture(textureKey)) {
        this.applyPlayerBodySize();
      }
      return;
    }

    if (!moving) {
      this.playerWalkFrame = 1;
      const textures = this.getPlayerSideWalkTextures();
      if (this.setLevel5PlayerTexture(textures[this.playerWalkFrame])) {
        this.applyPlayerBodySize();
      }
      this.player.setFlipX(this.playerFacingDirection === "left");
      return;
    }
    const textures = this.getPlayerSideWalkTextures();
    if (this.time.now >= this.nextPlayerWalkFrameAt) {
      this.playerWalkFrame = (this.playerWalkFrame + 1) % textures.length;
      this.nextPlayerWalkFrameAt = this.time.now + LEVEL5.PLAYER_WALK_FRAME_MS;
    }
    if (this.setLevel5PlayerTexture(textures[this.playerWalkFrame])) {
      this.applyPlayerBodySize();
    }
    this.player.setFlipX(this.playerFacingDirection === "left");
  }

  private getPlayerVerticalWalkTextures(): readonly string[] {
    if (this.playerFacingDirection === "up") {
      return this.hasDragonWeapon ? this.playerDragonBackTextures : this.playerBackTextures;
    }
    return this.hasDragonWeapon ? this.playerDragonFrontTextures : this.playerFrontTextures;
  }

  private getPlayerSideWalkTextures(): readonly string[] {
    return this.hasDragonWeapon ? this.playerDragonWalkTextures : this.playerWalkTextures;
  }

  private clampPlayerToArena(): void {
    const halfWidth = this.player.displayWidth * 0.28;
    const halfHeight = this.player.displayHeight * 0.28;
    this.player.x = Phaser.Math.Clamp(this.player.x, this.arena.left + halfWidth, this.arena.right - halfWidth);
    this.player.y = Phaser.Math.Clamp(this.player.y, this.arena.top + halfHeight, this.arena.bottom - halfHeight);
  }

  private updatePlayerShadow(): void {
    this.playerShadow.setPosition(this.player.x, this.player.y + scaleY(LEVEL5.SHADOW_OFFSET_Y));
  }

  private startJump(): void {
    if (this.isJumping || this.time.now < this.nextJumpAt) {
      return;
    }
    this.isJumping = true;
    this.nextJumpAt = this.time.now + LEVEL5.JUMP_COOLDOWN_MS;
    this.tweens.killTweensOf([this.player, this.playerShadow]);

    this.tweens.add({
      targets: this.player,
      scaleX: this.playerBaseScaleX * LEVEL5.JUMP_SCALE,
      scaleY: this.playerBaseScaleY * LEVEL5.JUMP_SCALE,
      angle: this.player.flipX ? -5 : 5,
      duration: LEVEL5.JUMP_MS / 2,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.isJumping = false;
        this.player.setScale(this.playerBaseScaleX, this.playerBaseScaleY);
        this.player.setAngle(0);
      }
    });
    this.tweens.add({
      targets: this.playerShadow,
      scaleX: this.shadowBaseScaleX * LEVEL5.JUMP_SHADOW_SCALE,
      scaleY: this.shadowBaseScaleY * LEVEL5.JUMP_SHADOW_SCALE,
      alpha: 0.15,
      duration: LEVEL5.JUMP_MS / 2,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.playerShadow.setScale(this.shadowBaseScaleX, this.shadowBaseScaleY);
        this.playerShadow.setAlpha(0.34);
      }
    });
  }

  private updateJumpDust(delta: number): void {
    if (!this.isJumping || Math.random() > delta / 80) {
      return;
    }
    const puff = this.add
      .circle(
        this.player.x + Phaser.Math.Between(-scaleX(12), scaleX(12)),
        this.player.y + scaleY(LEVEL5.SHADOW_OFFSET_Y),
        scale(Phaser.Math.Between(3, 6)),
        0xbdd7e7,
        0.32
      )
      .setDepth(11);
    this.tweens.add({
      targets: puff,
      y: puff.y + scaleY(8),
      alpha: 0,
      scale: 1.8,
      duration: 260,
      onComplete: () => puff.destroy()
    });
  }

  private shootBinaryProjectile(): void {
    if (this.time.now < this.nextShotAt || this.bossHp <= 0) {
      return;
    }
    this.nextShotAt = this.time.now + LEVEL5.PLAYER_SHOOT_COOLDOWN_MS;

    const aim = this.getPlayerAimVector();
    const muzzle = this.getPlayerMuzzleOffset();
    const originX = this.player.x + muzzle.x;
    const originY = this.player.y + muzzle.y;

    for (const shotAim of this.getPlayerShotAims(aim)) {
      const shot = this.hasDragonWeapon
        ? this.createDragonProjectile(originX, originY, shotAim)
        : this.createBinaryProjectile(originX, originY, shotAim);
      this.playerProjectiles.push(shot);
    }
    if (this.playerProjectiles.length > LEVEL5.PLAYER_PROJECTILE_MAX_ACTIVE) {
      while (this.playerProjectiles.length > LEVEL5.PLAYER_PROJECTILE_MAX_ACTIVE) {
        this.playerProjectiles.shift()?.destroy();
      }
    }
    this.audio.playSfx("sfx-fire-spit", AUDIO.SFX.FIRE);
  }

  private getPlayerShotAims(baseAim: Phaser.Math.Vector2): Phaser.Math.Vector2[] {
    if (this.activeShotMultiplier === 2) {
      return [
        this.rotateAim(baseAim, -LEVEL5.SHOT_MULTIPLIER_SPREAD_DEG),
        this.rotateAim(baseAim, LEVEL5.SHOT_MULTIPLIER_SPREAD_DEG)
      ];
    }
    if (this.activeShotMultiplier === 3) {
      return [
        baseAim.clone(),
        this.rotateAim(baseAim, -LEVEL5.SHOT_MULTIPLIER_SPREAD_DEG),
        this.rotateAim(baseAim, LEVEL5.SHOT_MULTIPLIER_SPREAD_DEG)
      ];
    }
    return [baseAim];
  }

  private rotateAim(aim: Phaser.Math.Vector2, degrees: number): Phaser.Math.Vector2 {
    return aim.clone().rotate(Phaser.Math.DegToRad(degrees)).normalize();
  }

  private createBinaryProjectile(x: number, y: number, aim: Phaser.Math.Vector2): Phaser.GameObjects.Text {
    const shot = this.add
      .text(x, y, this.getBinaryShotText(), {
        fontFamily: "Courier New, monospace",
        fontSize: `${scale(LEVEL5.PLAYER_PROJECTILE_FONT_SIZE)}px`,
        color: "#b7f7ce",
        fontStyle: "bold",
        stroke: "#0f172a",
        strokeThickness: scale(2)
      })
      .setOrigin(0.5)
      .setRotation(aim.angle())
      .setDepth(31);
    shot.setData("vx", aim.x * scale(LEVEL5.PLAYER_PROJECTILE_SPEED));
    shot.setData("vy", aim.y * scale(LEVEL5.PLAYER_PROJECTILE_SPEED));
    shot.setData("damage", 1);
    shot.setData("expiresAt", this.time.now + LEVEL5.PLAYER_PROJECTILE_LIFETIME_MS);
    return shot;
  }

  private createDragonProjectile(x: number, y: number, aim: Phaser.Math.Vector2): Phaser.GameObjects.Image {
    const shot = this.add
      .image(x, y, "level5-dragon-beetle-shot")
      .setDisplaySize(scaleX(LEVEL5.DRAGON_PROJECTILE_WIDTH), scaleY(LEVEL5.DRAGON_PROJECTILE_HEIGHT))
      .setOrigin(0.5)
      .setRotation(aim.angle())
      .setDepth(31);
    shot.setData("vx", aim.x * scale(LEVEL5.DRAGON_PROJECTILE_SPEED));
    shot.setData("vy", aim.y * scale(LEVEL5.DRAGON_PROJECTILE_SPEED));
    shot.setData("damage", LEVEL5.DRAGON_PROJECTILE_DAMAGE);
    shot.setData("expiresAt", this.time.now + LEVEL5.DRAGON_PROJECTILE_LIFETIME_MS);
    return shot;
  }

  private getPlayerAimVector(): Phaser.Math.Vector2 {
    switch (this.playerFacingDirection) {
      case "left":
        return new Phaser.Math.Vector2(-1, 0);
      case "up":
        return new Phaser.Math.Vector2(0, -1);
      case "down":
        return new Phaser.Math.Vector2(0, 1);
      case "right":
      default:
        return new Phaser.Math.Vector2(1, 0);
    }
  }

  private getPlayerMuzzleOffset(): Phaser.Math.Vector2 {
    switch (this.playerFacingDirection) {
      case "left":
        return new Phaser.Math.Vector2(-scaleX(LEVEL5.PLAYER_MUZZLE_SIDE_X), scaleY(LEVEL5.PLAYER_MUZZLE_SIDE_Y));
      case "up":
        return new Phaser.Math.Vector2(scaleX(LEVEL5.PLAYER_MUZZLE_UP_X), scaleY(LEVEL5.PLAYER_MUZZLE_UP_Y));
      case "down":
        return new Phaser.Math.Vector2(scaleX(LEVEL5.PLAYER_MUZZLE_DOWN_X), scaleY(LEVEL5.PLAYER_MUZZLE_DOWN_Y));
      case "right":
      default:
        return new Phaser.Math.Vector2(scaleX(LEVEL5.PLAYER_MUZZLE_SIDE_X), scaleY(LEVEL5.PLAYER_MUZZLE_SIDE_Y));
    }
  }

  private getBinaryShotText(): string {
    const variants = ["0", "1"];
    return variants[Phaser.Math.Between(0, variants.length - 1)];
  }

  private handleBossHit(shot: PlayerProjectile): void {
    if (!this.fightActive || !shot.active || this.bossHp <= 0) {
      return;
    }

    const previousHp = this.bossHp;
    const damage = (shot.getData("damage") as number | undefined) ?? 1;
    shot.destroy();
    this.bossHp = Math.max(0, this.bossHp - damage);
    this.scaredFaceUntil = this.time.now + LEVEL5.BOSS_SCARED_FACE_MS;
    this.scoreSystem.addSkill(LEVEL5.PLAYER_PROJECTILE_SCORE * damage);
    this.updateBossHpUi();
    this.syncBossBodyTexture();
    this.flashBoss();
    if (!this.miniBossPhaseTriggered && previousHp > this.miniBossTriggerHp && this.bossHp <= this.miniBossTriggerHp) {
      this.triggerMiniBossPhase();
    }

    if (Math.floor(previousHp / 10) !== Math.floor(this.bossHp / 10) || this.bossHp <= 0) {
      FloatingText.spawn(
        this,
        this.boss.x,
        this.boss.y - scaleY(58),
        t("level5.damageHp", { damage }),
        "#fef08a"
      );
    }

    if (this.bossHp <= 0) {
      this.finishLevel();
    }
  }

  private flashBoss(): void {
    this.boss.setTintFill(0xfef08a);
    this.bossLegs.forEach((leg) => leg.sprite.setTintFill(0xfef08a));
    this.time.delayedCall(58, () => {
      if (this.boss.active) {
        if (this.bossHp > 0) {
          this.boss.clearTint();
          this.bossLegs.forEach((leg) => leg.sprite.clearTint());
        } else {
          this.boss.setTint(0xff7a18);
          this.bossLegs.forEach((leg) => leg.sprite.setTint(0xff7a18));
        }
      }
    });
  }

  private spawnBossAttack(): void {
    if (!this.fightActive || this.bossHp <= 0 || this.isBossStunned()) {
      return;
    }

    const count = this.bossHp <= LEVEL5.PHASE_THREE_HP ? 3 : this.bossHp <= LEVEL5.PHASE_TWO_HP ? 2 : 1;
    const baseAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
    const spread = Phaser.Math.DegToRad(LEVEL5.BOSS_ATTACK_SPREAD_DEG);
    const start = -((count - 1) / 2) * spread;

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + start + spread * i + Phaser.Math.FloatBetween(-spread * 0.25, spread * 0.25);
      const kind: BossProjectileKind = (this.bossHp + i) % 2 === 0 ? "electric" : "energy";
      this.spawnBossProjectile(angle, kind);
    }
  }

  private spawnEnergyWaves(): void {
    if (!this.fightActive || this.bossHp <= 0 || this.isBossStunned()) {
      return;
    }
    this.spawnEnergyWave(-1);
    this.spawnEnergyWave(1);
  }

  private spawnEnergyWave(direction: -1 | 1): void {
    const wave = this.physics.add.image(this.boss.x + scaleX(direction * 34), this.boss.y + scaleY(18), "level5-energy-wave");
    wave.setDisplaySize(scale(LEVEL5.BOSS_WAVE_SIZE), scale(LEVEL5.BOSS_WAVE_SIZE));
    wave.setDepth(27);
    wave.setFlipX(direction < 0);
    wave.setData("kind", "wave" satisfies BossHazardKind);

    const body = wave.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(
      wave.width * LEVEL5.BOSS_WAVE_BODY_WIDTH_RATIO,
      wave.height * LEVEL5.BOSS_WAVE_BODY_HEIGHT_RATIO,
      true
    );
    this.bossProjectiles.add(wave);
    body.setVelocity(direction * scale(LEVEL5.BOSS_WAVE_SPEED), 0);
    this.time.delayedCall(LEVEL5.BOSS_PROJECTILE_LIFETIME_MS, () => {
      if (wave.active) {
        wave.destroy();
      }
    });
  }

  private showBossTaunt(forceKey?: string): void {
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }

    const taunts = ["level5.tauntFired", "level5.tauntLayoffs", "level5.tauntProgrammersOver"];
    const key = forceKey ?? taunts[Phaser.Math.Between(0, taunts.length - 1)];
    const x = this.boss.x;
    const y = this.boss.y - scaleY(LEVEL5.BOSS_TAUNT_OFFSET_Y);
    const bubble = this.add.image(x, y, "speech_bubble").setScale(getUiScale() * 0.82).setDepth(1007);
    const label = this.add
      .text(x, y, t(key), {
        fontFamily: "Arial, sans-serif",
        fontSize: `${scale(LEVEL5.BOSS_TAUNT_FONT_SIZE)}px`,
        color: "#111827",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: scaleX(LEVEL5.BOSS_TAUNT_MAX_WIDTH) }
      })
      .setOrigin(0.5)
      .setDepth(1008);

    this.tweens.add({
      targets: [bubble, label],
      y: y - scaleY(8),
      alpha: 0,
      delay: Math.max(0, LEVEL5.BOSS_TAUNT_DURATION_MS - 320),
      duration: 300,
      ease: "Sine.easeIn",
      onComplete: () => {
        bubble.destroy();
        label.destroy();
      }
    });
  }

  private showBossIntroVoice(): void {
    if (!this.fightActive || this.bossHp <= 0 || !this.boss.active) {
      return;
    }

    this.audio.playSfx("sfx-robot-voice", AUDIO.SFX.ROBOT_VOICE);

    const bubbleScale = getUiScale() * 0.9;
    const x = Phaser.Math.Clamp(this.boss.x - scaleX(12), scaleX(116), this.scale.width - scaleX(116));
    const y = Phaser.Math.Clamp(this.boss.y - scaleY(LEVEL5.BOSS_TAUNT_OFFSET_Y), scaleY(50), this.scale.height - scaleY(42));
    const bubbleHalfHeight = 70 * bubbleScale * 0.5;
    const bubble = this.add.image(x, y, "speech_bubble").setScale(bubbleScale).setDepth(1010);
    const label = createDialogText(this, x, y, t("level5.robotIntro"), {
      maxWidth: LEVEL5.BOSS_INTRO_VOICE_MAX_WIDTH,
      fontSize: LEVEL5.BOSS_INTRO_VOICE_FONT_SIZE,
      color: "#111827",
      weight: 900,
      align: "center"
    }).setDepth(1012);
    const tail = this.add
      .triangle(
        Phaser.Math.Clamp(this.boss.x, x - scaleX(82), x + scaleX(82)),
        y + bubbleHalfHeight - scaleY(1),
        0,
        0,
        scaleX(24),
        0,
        scaleX(12),
        scaleY(20),
        0xf9f7f7
      )
      .setOrigin(0.5, 0)
      .setDepth(1011);
    tail.setStrokeStyle(scale(1), 0x1c1c1c, 1);

    const rings: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = this.add
        .circle(this.boss.x, this.boss.y - scaleY(8), scale(10 + i * 6), 0x38f6ff, 0)
        .setStrokeStyle(scale(2), i === 1 ? 0xfacc15 : 0x38f6ff, 0.85)
        .setDepth(1009);
      rings.push(ring);
      this.tweens.add({
        targets: ring,
        scale: 2.3 + i * 0.4,
        alpha: 0,
        delay: i * 120,
        duration: 720,
        repeat: 1,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy()
      });
    }

    this.tweens.add({
      targets: [bubble, label, tail],
      alpha: 0,
      y: "-=" + scaleY(8),
      delay: LEVEL5.BOSS_INTRO_VOICE_DURATION_MS - 380,
      duration: 340,
      ease: "Sine.easeIn",
      onComplete: () => {
        bubble.destroy();
        label.destroy();
        tail.destroy();
        rings.forEach((ring) => {
          if (ring.active) {
            ring.destroy();
          }
        });
      }
    });
  }

  private spawnBossProjectile(angle: number, kind: BossProjectileKind): void {
    const key = kind === "electric" ? "level5-electric-ball" : "level5-energy-ball";
    const projectile = this.physics.add.image(this.boss.x, this.boss.y + scaleY(26), key);
    projectile.setDisplaySize(scale(LEVEL5.BOSS_PROJECTILE_SIZE), scale(LEVEL5.BOSS_PROJECTILE_SIZE));
    projectile.setDepth(28);
    projectile.setData("kind", kind);

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(projectile.width * 0.34);
    this.bossProjectiles.add(projectile);
    body.setVelocity(
      Math.cos(angle) * scale(LEVEL5.BOSS_PROJECTILE_SPEED),
      Math.sin(angle) * scale(LEVEL5.BOSS_PROJECTILE_SPEED)
    );
    this.time.delayedCall(LEVEL5.BOSS_PROJECTILE_LIFETIME_MS, () => {
      if (projectile.active) {
        projectile.destroy();
      }
    });
  }

  private handlePlayerProjectileHit(projectile: Phaser.Physics.Arcade.Image): void {
    if (!projectile.active) {
      return;
    }
    const impactX = projectile.x;
    const impactY = projectile.y;
    projectile.destroy();

    if (this.isJumping || this.invulnerable || !this.fightActive) {
      return;
    }

    this.applyDamage(() => {
      const angle = Phaser.Math.Angle.Between(impactX, impactY, this.player.x, this.player.y);
      this.player.x += Math.cos(angle) * scale(LEVEL5.PLAYER_DAMAGE_KNOCKBACK);
      this.player.y += Math.sin(angle) * scale(LEVEL5.PLAYER_DAMAGE_KNOCKBACK);
      this.clampPlayerToArena();
      this.updatePlayerShadow();
    });
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("common.heartLost"),
      "#ff6b6b"
    );
    this.hud.updateAll();
  }

  private scheduleNextHeartPickup(): void {
    this.heartPickupTimer?.remove(false);
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }

    this.heartPickupTimer = this.time.delayedCall(
      Phaser.Math.Between(LEVEL5.HEART_PICKUP_MIN_DELAY_MS, LEVEL5.HEART_PICKUP_MAX_DELAY_MS),
      () => this.spawnHeartPickup()
    );
  }

  private spawnHeartPickup(): void {
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }
    if (this.heartPickups.some((heart) => heart.active)) {
      this.scheduleNextHeartPickup();
      return;
    }

    const hearts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < LEVEL5.HEART_PICKUP_COUNT; i += 1) {
      const heart = this.createHeartPickup(i);
      hearts.push(heart);
    }
    this.heartPickups = hearts;

    this.time.delayedCall(LEVEL5.HEART_PICKUP_VISIBLE_MS, () => {
      this.clearHeartPickups();
      this.scheduleNextHeartPickup();
    });
  }

  private createHeartPickup(index: number): Phaser.GameObjects.Image {
    const x = Phaser.Math.Between(
      Math.round(this.arena.left + scaleX(LEVEL5.HEART_PICKUP_MARGIN_X)),
      Math.round(this.arena.right - scaleX(LEVEL5.HEART_PICKUP_MARGIN_X))
    );
    const y = Phaser.Math.Between(
      Math.round(this.arena.top + scaleY(LEVEL5.HEART_PICKUP_MARGIN_Y)),
      Math.round(this.arena.bottom - scaleY(LEVEL5.HEART_PICKUP_MARGIN_Y))
    );

    const heart = this.add.image(x, y, "heart_full");
    heart.setDisplaySize(scale(LEVEL5.HEART_PICKUP_SIZE), scale(LEVEL5.HEART_PICKUP_SIZE));
    heart.setDepth(32);
    heart.setData("collected", false);

    this.tweens.add({
      targets: heart,
      scale: 1.14,
      alpha: 0.72,
      duration: 420 + index * 60,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    return heart;
  }

  private clearHeartPickups(): void {
    this.heartPickups.forEach((heart) => {
      if (!heart.active) {
        return;
      }
      this.tweens.killTweensOf(heart);
      heart.destroy();
    });
    this.heartPickups = [];
  }

  private checkHeartPickup(): void {
    const playerBounds = this.player.getBounds();
    for (const heart of [...this.heartPickups]) {
      if (!heart.active || heart.getData("collected")) {
        continue;
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, heart.getBounds())) {
        this.collectHeartPickup(heart);
      }
    }
  }

  private collectHeartPickup(heart: Phaser.GameObjects.Image): void {
    if (!heart.active || heart.getData("collected")) {
      return;
    }
    heart.setData("collected", true);
    this.tweens.killTweensOf(heart);
    heart.destroy();
    this.heartPickups = this.heartPickups.filter((candidate) => candidate !== heart);

    runState.hearts += 1;
    this.hud.updateAll();
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("level5.heartPickup"),
      "#8fe388"
    );
  }

  private spawnDragonWeaponPickup(): void {
    if (!this.fightActive || this.bossHp <= 0 || this.hasDragonWeapon || this.dragonWeaponPickup?.active) {
      return;
    }

    const x = Phaser.Math.Between(
      Math.round(this.arena.left + scaleX(LEVEL5.DRAGON_WEAPON_MARGIN_X)),
      Math.round(this.arena.right - scaleX(LEVEL5.DRAGON_WEAPON_MARGIN_X))
    );
    const y = Phaser.Math.Between(
      Math.round(this.arena.top + scaleY(LEVEL5.DRAGON_WEAPON_MARGIN_Y)),
      Math.round(this.arena.bottom - scaleY(LEVEL5.DRAGON_WEAPON_MARGIN_Y))
    );

    const weapon = this.add.image(x, y, "level5-dragon-keyboard-pickup");
    weapon.setDisplaySize(scaleX(LEVEL5.DRAGON_WEAPON_PICKUP_WIDTH), scaleY(LEVEL5.DRAGON_WEAPON_PICKUP_HEIGHT));
    weapon.setDepth(32);
    weapon.setData("collected", false);
    this.dragonWeaponPickup = weapon;

    this.tweens.add({
      targets: weapon,
      y: y - scaleY(5),
      angle: 3,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private checkDragonWeaponPickup(): void {
    const weapon = this.dragonWeaponPickup;
    if (!weapon?.active || weapon.getData("collected")) {
      return;
    }
    if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), weapon.getBounds())) {
      this.collectDragonWeaponPickup(weapon);
    }
  }

  private collectDragonWeaponPickup(weapon: Phaser.GameObjects.Image): void {
    if (!weapon.active || weapon.getData("collected")) {
      return;
    }
    weapon.setData("collected", true);
    this.tweens.killTweensOf(weapon);
    weapon.destroy();
    this.dragonWeaponPickup = undefined;
    this.hasDragonWeapon = true;
    this.playerWalkFrame = 0;
    this.playerTextureKey = "";
    this.updatePlayerWalkTexture(false);
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("level5.dragonWeaponPickup"),
      "#facc15"
    );
  }

  private scheduleNextShotMultiplierPickup(): void {
    this.shotMultiplierTimer?.remove(false);
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }
    this.shotMultiplierTimer = this.time.delayedCall(
      Phaser.Math.Between(LEVEL5.SHOT_MULTIPLIER_PICKUP_MIN_DELAY_MS, LEVEL5.SHOT_MULTIPLIER_PICKUP_MAX_DELAY_MS),
      () => this.spawnShotMultiplierPickup()
    );
  }

  private spawnShotMultiplierPickup(): void {
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }
    if (this.shotMultiplierPickup?.active) {
      this.scheduleNextShotMultiplierPickup();
      return;
    }

    const multiplier: ShotMultiplier = Phaser.Math.Between(0, 1) === 0 ? 2 : 3;
    const x = Phaser.Math.Between(
      Math.round(this.arena.left + scaleX(LEVEL5.SHOT_MULTIPLIER_MARGIN_X)),
      Math.round(this.arena.right - scaleX(LEVEL5.SHOT_MULTIPLIER_MARGIN_X))
    );
    const y = Phaser.Math.Between(
      Math.round(this.arena.top + scaleY(LEVEL5.SHOT_MULTIPLIER_MARGIN_Y)),
      Math.round(this.arena.bottom - scaleY(LEVEL5.SHOT_MULTIPLIER_MARGIN_Y))
    );
    const pickup = this.add
      .text(x, y, `X${multiplier}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: `${scale(19)}px`,
        color: "#fef08a",
        fontStyle: "bold",
        stroke: "#111827",
        strokeThickness: scale(4),
        backgroundColor: "#1f2937",
        padding: {
          left: Math.round(scaleX(8)),
          right: Math.round(scaleX(8)),
          top: Math.round(scaleY(4)),
          bottom: Math.round(scaleY(4))
        }
      })
      .setOrigin(0.5)
      .setDepth(33);
    pickup.setData("multiplier", multiplier);
    this.shotMultiplierPickup = pickup;

    this.tweens.add({
      targets: pickup,
      scale: 1.12,
      y: y - scaleY(5),
      duration: 460,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.time.delayedCall(LEVEL5.SHOT_MULTIPLIER_PICKUP_VISIBLE_MS, () => {
      if (this.shotMultiplierPickup !== pickup || !pickup.active) {
        return;
      }
      this.clearShotMultiplierPickup();
      this.scheduleNextShotMultiplierPickup();
    });
  }

  private checkShotMultiplierPickup(): void {
    const pickup = this.shotMultiplierPickup;
    if (!pickup?.active) {
      return;
    }
    if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), pickup.getBounds())) {
      this.collectShotMultiplierPickup(pickup);
    }
  }

  private collectShotMultiplierPickup(pickup: Phaser.GameObjects.Text): void {
    const multiplier = (pickup.getData("multiplier") as ShotMultiplier | undefined) ?? 2;
    this.clearShotMultiplierPickup();
    this.activeShotMultiplier = multiplier;
    this.shotMultiplierExpiresAt = this.time.now + LEVEL5.SHOT_MULTIPLIER_DURATION_MS;
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("level5.shotMultiplierPickup", { mult: multiplier }),
      "#fef08a"
    );
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_LIGHT);
    this.scheduleNextShotMultiplierPickup();
  }

  private clearShotMultiplierPickup(): void {
    if (!this.shotMultiplierPickup?.active) {
      this.shotMultiplierPickup = undefined;
      return;
    }
    this.tweens.killTweensOf(this.shotMultiplierPickup);
    this.shotMultiplierPickup.destroy();
    this.shotMultiplierPickup = undefined;
  }

  private updateShotMultiplierState(): void {
    if (this.activeShotMultiplier === 1 || this.time.now < this.shotMultiplierExpiresAt) {
      return;
    }
    this.activeShotMultiplier = 1;
    this.shotMultiplierExpiresAt = 0;
  }

  private scheduleNextPowerPylon(): void {
    this.pylonTimer?.remove(false);
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }
    this.pylonTimer = this.time.delayedCall(
      Phaser.Math.Between(LEVEL5.POWER_PYLON_SPAWN_MIN_MS, LEVEL5.POWER_PYLON_SPAWN_MAX_MS),
      () => {
        this.spawnPowerPylon();
        this.scheduleNextPowerPylon();
      }
    );
  }

  private spawnPowerPylon(): void {
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }
    this.powerPylons = this.powerPylons.filter((pylon) => pylon.sprite.active);
    if (this.powerPylons.length >= LEVEL5.POWER_PYLON_MAX_ACTIVE) {
      return;
    }

    const side = Phaser.Math.RND.pick([-1, 1]);
    const x =
      side < 0
        ? Math.round(this.arena.left + scaleX(LEVEL5.POWER_PYLON_MARGIN_X))
        : Math.round(this.arena.right - scaleX(LEVEL5.POWER_PYLON_MARGIN_X));
    const y = Phaser.Math.Between(
      Math.round(this.arena.top + scaleY(LEVEL5.POWER_PYLON_MARGIN_Y)),
      Math.round(this.arena.bottom - scaleY(LEVEL5.POWER_PYLON_MARGIN_Y))
    );
    const sprite = this.add.image(x, y, "level5-electric-pylon");
    sprite.setDisplaySize(scaleX(LEVEL5.POWER_PYLON_DISPLAY_WIDTH), scaleY(LEVEL5.POWER_PYLON_DISPLAY_HEIGHT));
    sprite.setDepth(26);
    const hpBarWidth = scaleX(LEVEL5.POWER_PYLON_DISPLAY_WIDTH);
    const hpBarHeight = Math.max(4, scaleY(5));
    const hpBarY = y - sprite.displayHeight / 2 - scaleY(10);
    const hpBarBg = this.add.rectangle(x, hpBarY, hpBarWidth, hpBarHeight, 0x111827, 0.82).setDepth(28);
    hpBarBg.setStrokeStyle(Math.max(1, scale(1)), 0x93c5fd, 0.9);
    const hpBarFill = this.add
      .rectangle(x - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 0x22c55e, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(29);

    const pylon: PowerPylon = {
      sprite,
      hpBarBg,
      hpBarFill,
      hp: LEVEL5.POWER_PYLON_HP,
      nextSparkAt: this.time.now
    };
    this.powerPylons.push(pylon);

    this.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 1.04,
      scaleY: sprite.scaleY * 1.04,
      alpha: 0.86,
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private updatePowerPylons(): void {
    for (const pylon of [...this.powerPylons]) {
      if (!pylon.sprite.active) {
        continue;
      }
      pylon.sprite.setAngle(Math.sin(this.time.now * 0.012) * 1.3);
      this.updatePylonHpBar(pylon);
      if (this.time.now >= pylon.nextSparkAt) {
        pylon.nextSparkAt = this.time.now + LEVEL5.POWER_PYLON_SPARK_INTERVAL_MS;
        this.spawnPylonSpark(pylon.sprite);
      }
    }
    this.powerPylons = this.powerPylons.filter((pylon) => pylon.sprite.active);
  }

  private spawnPylonSpark(pylon: Phaser.GameObjects.Image): void {
    const x = pylon.x + Phaser.Math.Between(-scaleX(18), scaleX(18));
    const y = pylon.y + Phaser.Math.Between(-scaleY(24), scaleY(22));
    const spark = this.add.graphics().setDepth(pylon.depth + 1);
    spark.lineStyle(scale(2), Phaser.Math.RND.pick([0x67e8f9, 0xfef08a, 0xffffff]), 0.88);
    spark.beginPath();
    spark.moveTo(x, y);
    spark.lineTo(x + Phaser.Math.Between(-scaleX(9), scaleX(9)), y + Phaser.Math.Between(-scaleY(7), scaleY(7)));
    spark.lineTo(x + Phaser.Math.Between(-scaleX(12), scaleX(12)), y + Phaser.Math.Between(-scaleY(12), scaleY(12)));
    spark.strokePath();
    this.tweens.add({
      targets: spark,
      alpha: 0,
      duration: 150,
      onComplete: () => spark.destroy()
    });
  }

  private updatePylonHpBar(pylon: PowerPylon): void {
    const width = scaleX(LEVEL5.POWER_PYLON_DISPLAY_WIDTH);
    const y = pylon.sprite.y - pylon.sprite.displayHeight / 2 - scaleY(10);
    const percent = Phaser.Math.Clamp(pylon.hp / LEVEL5.POWER_PYLON_HP, 0, 1);
    pylon.hpBarBg.setPosition(pylon.sprite.x, y);
    pylon.hpBarFill.setPosition(pylon.sprite.x - width / 2, y);
    pylon.hpBarFill.setDisplaySize(width * percent, Math.max(4, scaleY(5)));
    pylon.hpBarFill.setFillStyle(percent > 0.55 ? 0x22c55e : percent > 0.25 ? 0xfacc15 : 0xef4444, 0.95);
  }

  private getHitPowerPylon(shot: PlayerProjectile): PowerPylon | undefined {
    const shotBounds = shot.getBounds();
    return this.powerPylons.find(
      (pylon) => pylon.sprite.active && Phaser.Geom.Intersects.RectangleToRectangle(shotBounds, pylon.sprite.getBounds())
    );
  }

  private handlePowerPylonHit(pylon: PowerPylon, shot: PlayerProjectile): void {
    const damage = (shot.getData("damage") as number | undefined) ?? 1;
    shot.destroy();
    pylon.hp = Math.max(0, pylon.hp - damage);
    this.updatePylonHpBar(pylon);

    if (pylon.hp <= 0) {
      this.destroyPowerPylon(pylon);
      return;
    }

    pylon.sprite.setTintFill(0xfef08a);
    this.time.delayedCall(80, () => {
      if (pylon.sprite.active) {
        pylon.sprite.clearTint();
      }
    });
  }

  private destroyPowerPylon(pylon: PowerPylon): void {
    const x = pylon.sprite.x;
    const y = pylon.sprite.y;
    this.powerPylons = this.powerPylons.filter((candidate) => candidate !== pylon);
    this.tweens.killTweensOf(pylon.sprite);
    pylon.hpBarBg.destroy();
    pylon.hpBarFill.destroy();
    pylon.sprite.destroy();
    this.explodePowerPylon(x, y);
    this.triggerBossStun(x, y);
  }

  private explodePowerPylon(x: number, y: number): void {
    const flash = this.add.circle(x, y, scale(18), 0x67e8f9, 0.72).setDepth(38);
    this.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });

    for (let i = 0; i < LEVEL5.POWER_PYLON_EXPLOSION_PARTICLES; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = scale(Phaser.Math.Between(18, 72));
      const particle = this.add
        .rectangle(
          x,
          y,
          scale(Phaser.Math.Between(3, 8)),
          scale(Phaser.Math.Between(2, 6)),
          Phaser.Math.RND.pick([0x67e8f9, 0xfef08a, 0xe5e7eb, 0x38f6ff]),
          0.95
        )
        .setDepth(39)
        .setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        angle: particle.angle + Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(320, 680),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private triggerBossStun(x: number, y: number): void {
    this.bossStunnedUntil = Math.max(this.bossStunnedUntil, this.time.now + LEVEL5.POWER_PYLON_STUN_MS);
    this.bossProjectiles.clear(true, true);
    (this.boss.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.boss.setTint(0x67e8f9);
    this.bossLegs.forEach((leg) => leg.sprite.setTint(0x67e8f9));
    FloatingText.spawn(this, x, y - scaleY(36), t("level5.pylonStun"), "#67e8f9");
    this.showScreenLightning();

    this.time.delayedCall(LEVEL5.POWER_PYLON_STUN_MS, () => {
      if (this.boss.active && this.time.now >= this.bossStunnedUntil) {
        this.boss.clearTint();
        this.bossLegs.forEach((leg) => leg.sprite.clearTint());
      }
    });
  }

  private showScreenLightning(): void {
    const lightning = this.add.graphics().setScrollFactor(0).setDepth(1100);
    lightning.fillStyle(0x67e8f9, 0.1);
    lightning.fillRect(0, 0, this.scale.width, this.scale.height);
    lightning.lineStyle(scale(10), 0x67e8f9, 0.38);
    this.drawLightningBolt(lightning, scaleX(24), scaleY(44), scaleX(616), scaleY(310));
    lightning.lineStyle(scale(4), 0xffffff, 0.92);
    this.drawLightningBolt(lightning, scaleX(24), scaleY(44), scaleX(616), scaleY(310));
    lightning.x = -this.scale.width * 0.36;

    this.tweens.add({
      targets: lightning,
      x: this.scale.width * 0.28,
      alpha: 0,
      duration: LEVEL5.POWER_PYLON_LIGHTNING_MS,
      ease: "Sine.easeOut",
      onComplete: () => lightning.destroy()
    });
  }

  private drawLightningBolt(graphics: Phaser.GameObjects.Graphics, startX: number, startY: number, endX: number, endY: number): void {
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    const segments = 8;
    for (let i = 1; i < segments; i += 1) {
      const tValue = i / segments;
      const x = Phaser.Math.Linear(startX, endX, tValue) + Phaser.Math.Between(-scaleX(34), scaleX(34));
      const y = Phaser.Math.Linear(startY, endY, tValue) + Phaser.Math.Between(-scaleY(28), scaleY(28));
      graphics.lineTo(x, y);
    }
    graphics.lineTo(endX, endY);
    graphics.strokePath();
  }

  private updateProjectiles(delta: number): void {
    const bossHitBox = this.getBossHitBox();
    this.playerProjectiles = this.playerProjectiles.filter((shot) => {
      if (!shot.active) {
        return false;
      }
      shot.x += ((shot.getData("vx") as number) || 0) * (delta / 1000);
      shot.y += ((shot.getData("vy") as number) || 0) * (delta / 1000);

      const hitPylon = this.getHitPowerPylon(shot);
      if (hitPylon) {
        this.handlePowerPylonHit(hitPylon, shot);
        return false;
      }

      const hitMiniBoss = this.getHitMiniBoss(shot);
      if (hitMiniBoss) {
        this.handleMiniBossHit(hitMiniBoss, shot);
        return false;
      }

      if (
        this.fightActive &&
        this.bossHp > 0 &&
        Phaser.Geom.Intersects.RectangleToRectangle(shot.getBounds(), bossHitBox)
      ) {
        this.handleBossHit(shot);
        return false;
      }

      if (
        this.time.now > ((shot.getData("expiresAt") as number) || 0) ||
        shot.x < -scaleX(40) ||
        shot.x > this.scale.width + scaleX(40) ||
        shot.y < -scaleY(40) ||
        shot.y > this.scale.height + scaleY(40)
      ) {
        shot.destroy();
        return false;
      }
      return true;
    });

    for (const child of [...this.bossProjectiles.getChildren()]) {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) {
        continue;
      }
      const kind = projectile.getData("kind") as BossHazardKind;
      if (kind === "wave") {
        projectile.setAlpha(0.74 + Math.sin(this.time.now * 0.015) * 0.18);
      } else if (kind === "fire") {
        projectile.rotation += delta * 0.014;
        projectile.setAlpha(0.84 + Math.sin(this.time.now * 0.02) * 0.14);
      } else {
        projectile.rotation += delta * (kind === "electric" ? 0.01 : 0.005);
      }
      if (
        projectile.x < -scaleX(60) ||
        projectile.x > this.scale.width + scaleX(60) ||
        projectile.y < -scaleY(60) ||
        projectile.y > this.scale.height + scaleY(60)
      ) {
        projectile.destroy();
      }
    }
  }

  private getBossHitBox(): Phaser.Geom.Rectangle {
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  private updateBossHpUi(): void {
    const percent = Phaser.Math.Clamp(this.bossHp / this.bossMaxHp, 0, 1);
    this.bossHpFill.setDisplaySize(scaleX(LEVEL5.HP_BAR_WIDTH) * percent, scaleY(LEVEL5.HP_BAR_HEIGHT));
    this.bossHpText.setText(`${t("level5.hp", { hp: this.bossHp })}/${this.bossMaxHp}`);
  }

  private showDialog(text: string, onDone: () => void): void {
    const bubble = this.add.image(scaleX(LEVEL5.DIALOG_X), scaleY(LEVEL5.DIALOG_Y), "speech_bubble");
    bubble.setScale(getUiScale());
    bubble.setDepth(1008);
    const label = createDialogText(this, scaleX(LEVEL5.DIALOG_X), scaleY(LEVEL5.DIALOG_Y), text, {
      maxWidth: LEVEL5.DIALOG_MAX_WIDTH,
      fontSize: LEVEL5.DIALOG_FONT_SIZE,
      color: "#1b1f24",
      padding: `${LEVEL5.DIALOG_PADDING_Y}px ${LEVEL5.DIALOG_PADDING_X}px`,
      align: "center"
    });
    label.setDepth(1009);
    this.time.delayedCall(LEVEL5.DIALOG_DURATION_MS, () => {
      bubble.destroy();
      label.destroy();
      onDone();
    });
  }

  private explodeBoss(): void {
    const centerX = this.boss.x;
    const centerY = this.boss.y;
    (this.boss.body as Phaser.Physics.Arcade.Body).enable = false;

    this.time.delayedCall(120, () => {
      this.boss.setVisible(false);
      this.bossLegs.forEach((leg) => leg.sprite.setVisible(false));
    });

    for (let i = 0; i < 3; i += 1) {
      const ring = this.add
        .circle(centerX, centerY, scale(12 + i * 8), 0xffffff, 0)
        .setStrokeStyle(scale(3), i === 0 ? 0xfef08a : i === 1 ? 0xf97316 : 0x38f6ff, 0.9)
        .setDepth(34 + i);
      this.tweens.add({
        targets: ring,
        scale: 3.2 + i * 0.5,
        alpha: 0,
        duration: LEVEL5.BOSS_EXPLOSION_DURATION_MS + i * 110,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy()
      });
    }

    for (let i = 0; i < LEVEL5.BOSS_EXPLOSION_PARTICLES; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = scale(Phaser.Math.Between(34, 110));
      const particle = this.add
        .rectangle(
          centerX + Math.cos(angle) * scale(8),
          centerY + Math.sin(angle) * scale(8),
          scale(Phaser.Math.Between(4, 9)),
          scale(Phaser.Math.Between(3, 8)),
          Phaser.Math.RND.pick([0xfef08a, 0xf97316, 0x38f6ff, 0xe5e7eb]),
          0.95
        )
        .setDepth(36)
        .setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        angle: particle.angle + Phaser.Math.Between(-220, 220),
        duration: Phaser.Math.Between(420, LEVEL5.BOSS_EXPLOSION_DURATION_MS),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }

    const flash = this.add.circle(centerX, centerY, scale(26), 0xfef08a, 0.72).setDepth(37);
    this.tweens.add({
      targets: flash,
      scale: 2.8,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  private finishLevel(): void {
    if (!this.fightActive) {
      return;
    }
    this.fightActive = false;
    this.attackTimer?.remove();
    this.waveTimer?.remove();
    this.tauntTimer?.remove();
    this.heartPickupTimer?.remove();
    this.dragonWeaponTimer?.remove();
    this.shotMultiplierTimer?.remove();
    this.pylonTimer?.remove();
    this.clearHeartPickups();
    this.clearShotMultiplierPickup();
    this.powerPylons.forEach((pylon) => {
      this.tweens.killTweensOf(pylon.sprite);
      pylon.hpBarBg.destroy();
      pylon.hpBarFill.destroy();
      pylon.sprite.destroy();
    });
    this.powerPylons = [];
    this.miniBosses.forEach((miniBoss) => {
      this.tweens.killTweensOf(miniBoss.sprite);
      miniBoss.legs.forEach((leg) => {
        this.tweens.killTweensOf(leg.sprite);
        leg.sprite.destroy();
      });
      miniBoss.hpBarBg.destroy();
      miniBoss.hpBarFill.destroy();
      miniBoss.sprite.destroy();
    });
    this.miniBosses = [];
    if (this.dragonWeaponPickup?.active) {
      this.tweens.killTweensOf(this.dragonWeaponPickup);
      this.dragonWeaponPickup.destroy();
    }
    this.dragonWeaponPickup = undefined;
    this.bossProjectiles.clear(true, true);
    this.playerProjectiles.forEach((shot) => shot.destroy());
    this.playerProjectiles = [];
    this.tweens.killTweensOf(this.boss);
    this.explodeBoss();

    this.scoreSystem.addBase(LEVEL5.LEVEL_COMPLETE_SCORE);
    if (runState.hearts >= RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL5.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL5.TIME_BONUS_MS);
    this.audio.playSfx("sfx-computer-shutdown", AUDIO.SFX.COMPUTER_SHUTDOWN);
    FloatingText.spawn(
      this,
      scaleX(LEVEL5.COMPLETE_TEXT_X),
      scaleY(LEVEL5.COMPLETE_TEXT_Y),
      t("common.points", { points: LEVEL5.LEVEL_COMPLETE_SCORE }),
      "#8fe388"
    );
    this.hud.updateAll();

    this.time.delayedCall(LEVEL5.LEVEL_COMPLETE_DELAY_MS, () => {
      this.scene.start("FinalHrScene");
    });
  }
}

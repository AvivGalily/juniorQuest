import Phaser from "phaser";
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
type BossHazardKind = BossProjectileKind | "wave";
type PlayerFacingDirection = "left" | "right" | "up" | "down";
type PlayerProjectile = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
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

export class Level5Scene extends BaseLevelScene {
  private player!: Player;
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
  private playerWalkFrame = 1;
  private nextPlayerWalkFrameAt = 0;
  private playerTextureKey = "";
  private playerFacingDirection: PlayerFacingDirection = "right";
  private bossBodyTextureKey: BossBodyTextureKey = "level5-computer-spider-body-angry";
  private arena!: Phaser.Geom.Rectangle;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private bossHp = LEVEL5.BOSS_HP;
  private bossHpFill!: Phaser.GameObjects.Rectangle;
  private bossHpText!: Phaser.GameObjects.Text;
  private attackTimer?: Phaser.Time.TimerEvent;
  private waveTimer?: Phaser.Time.TimerEvent;
  private tauntTimer?: Phaser.Time.TimerEvent;
  private heartPickupTimer?: Phaser.Time.TimerEvent;
  private heartPickup?: Phaser.GameObjects.Image;
  private dragonWeaponTimer?: Phaser.Time.TimerEvent;
  private dragonWeaponPickup?: Phaser.GameObjects.Image;
  private hasDragonWeapon = false;
  private fightActive = false;
  private isJumping = false;
  private nextShotAt = 0;
  private nextJumpAt = 0;
  private scaredFaceUntil = 0;
  private playerBaseScaleX = 1;
  private playerBaseScaleY = 1;
  private shadowBaseScaleX = 1;
  private shadowBaseScaleY = 1;

  constructor() {
    super("Level5Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL5);
    this.resetRuntimeState();
    this.audio.playMusic("music-boss", AUDIO.MUSIC.BOSS);
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

    this.showDialog(t("level5.intro"), () => {
      this.startFight();
    });
  }

  private resetRuntimeState(): void {
    this.bossLegs = [];
    this.playerProjectiles = [];
    this.playerWalkFrame = 1;
    this.nextPlayerWalkFrameAt = 0;
    this.playerTextureKey = "";
    this.playerFacingDirection = "right";
    this.bossBodyTextureKey = "level5-computer-spider-body-angry";
    this.bossHp = LEVEL5.BOSS_HP;
    this.attackTimer = undefined;
    this.waveTimer = undefined;
    this.tauntTimer = undefined;
    this.heartPickupTimer = undefined;
    this.heartPickup = undefined;
    this.dragonWeaponTimer = undefined;
    this.dragonWeaponPickup = undefined;
    this.hasDragonWeapon = false;
    this.fightActive = false;
    this.isJumping = false;
    this.nextShotAt = 0;
    this.nextJumpAt = 0;
    this.scaredFaceUntil = 0;
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }

    this.updatePlayer(delta);
    this.checkHeartPickup();
    this.checkDragonWeaponPickup();
    this.updateBoss(delta);
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    this.scheduleNextHeartPickup();
  }

  private updateBoss(_: number): void {
    if (!this.boss.active) {
      return;
    }

    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    const active = this.fightActive && this.bossHp > 0;
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
    const speedRatio = Phaser.Math.Clamp(Math.hypot(body.velocity.x, body.velocity.y) / scale(LEVEL5.BOSS_PATROL_SPEED), 0.28, 1);
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
    if (this.bossHp <= 30) {
      return "level5-computer-spider-body-broken";
    }
    if (this.bossHp <= 60) {
      return "level5-computer-spider-body-crack-2";
    }
    if (this.bossHp <= 80) {
      return "level5-computer-spider-body-crack-1";
    }
    if (this.time.now < this.scaredFaceUntil) {
      return "level5-computer-spider-body-scared";
    }
    return "level5-computer-spider-body-angry";
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
    if (this.fightActive && this.inputManager.keys.X.isDown) {
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
      this.playerWalkFrame = 1;
      const textureKey = this.getPlayerFacingTextureKey();
      if (this.setLevel5PlayerTexture(textureKey)) {
        this.applyPlayerBodySize();
      }
      return;
    }

    if (!moving) {
      this.playerWalkFrame = 1;
      if (this.setLevel5PlayerTexture(this.playerWalkTextures[this.playerWalkFrame])) {
        this.applyPlayerBodySize();
      }
      this.player.setFlipX(this.playerFacingDirection === "left");
      return;
    }
    if (this.time.now >= this.nextPlayerWalkFrameAt) {
      this.playerWalkFrame = (this.playerWalkFrame + 1) % this.playerWalkTextures.length;
      this.nextPlayerWalkFrameAt = this.time.now + LEVEL5.PLAYER_WALK_FRAME_MS;
    }
    if (this.setLevel5PlayerTexture(this.playerWalkTextures[this.playerWalkFrame])) {
      this.applyPlayerBodySize();
    }
    this.player.setFlipX(this.playerFacingDirection === "left");
  }

  private getPlayerFacingTextureKey(): string {
    if (this.playerFacingDirection === "up") {
      return this.hasDragonWeapon ? "level5-player-dragon-keyboard-back" : "level5-player-keyboard-gun-back";
    }
    return this.hasDragonWeapon ? "level5-player-dragon-keyboard-front" : "level5-player-keyboard-gun-front";
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

    const shot = this.add
      .text(originX, originY, this.getBinaryShotText(), {
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
    shot.setData("expiresAt", this.time.now + LEVEL5.PLAYER_PROJECTILE_LIFETIME_MS);

    this.playerProjectiles.push(shot);
    if (this.playerProjectiles.length > LEVEL5.PLAYER_PROJECTILE_MAX_ACTIVE) {
      this.playerProjectiles.shift()?.destroy();
    }
    this.audio.playSfx("sfx-fire-spit", AUDIO.SFX.FIRE);
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

  private handleBossHit(shot: Phaser.GameObjects.Text): void {
    if (!this.fightActive || !shot.active || this.bossHp <= 0) {
      return;
    }

    shot.destroy();
    this.bossHp = Math.max(0, this.bossHp - 1);
    this.scaredFaceUntil = this.time.now + LEVEL5.BOSS_SCARED_FACE_MS;
    this.scoreSystem.addSkill(LEVEL5.PLAYER_PROJECTILE_SCORE);
    this.updateBossHpUi();
    this.syncBossBodyTexture();
    this.flashBoss();

    if (this.bossHp % 10 === 0 || this.bossHp <= 0) {
      FloatingText.spawn(
        this,
        this.boss.x,
        this.boss.y - scaleY(58),
        t("level5.damageHp", { damage: 1 }),
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
    if (!this.fightActive || this.bossHp <= 0) {
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
    if (!this.fightActive || this.bossHp <= 0) {
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

  private showBossTaunt(): void {
    if (!this.fightActive || this.bossHp <= 0) {
      return;
    }

    const taunts = ["level5.tauntFired", "level5.tauntLayoffs", "level5.tauntProgrammersOver"];
    const key = taunts[Phaser.Math.Between(0, taunts.length - 1)];
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
    if (this.heartPickup?.active) {
      this.scheduleNextHeartPickup();
      return;
    }

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
    this.heartPickup = heart;

    this.tweens.add({
      targets: heart,
      scale: 1.14,
      alpha: 0.72,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.time.delayedCall(LEVEL5.HEART_PICKUP_VISIBLE_MS, () => {
      if (this.heartPickup !== heart || !heart.active) {
        return;
      }
      this.tweens.killTweensOf(heart);
      heart.destroy();
      this.heartPickup = undefined;
      this.scheduleNextHeartPickup();
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
    this.tweens.killTweensOf(heart);
    heart.destroy();
    this.heartPickup = undefined;

    runState.hearts += 1;
    this.hud.updateAll();
    FloatingText.spawn(
      this,
      this.player.x,
      this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      t("level5.heartPickup"),
      "#8fe388"
    );
    this.scheduleNextHeartPickup();
  }

  private updateProjectiles(delta: number): void {
    const bossHitBox = this.getBossHitBox();
    this.playerProjectiles = this.playerProjectiles.filter((shot) => {
      if (!shot.active) {
        return false;
      }
      shot.x += ((shot.getData("vx") as number) || 0) * (delta / 1000);
      shot.y += ((shot.getData("vy") as number) || 0) * (delta / 1000);

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
    const percent = Phaser.Math.Clamp(this.bossHp / LEVEL5.BOSS_HP, 0, 1);
    this.bossHpFill.setDisplaySize(scaleX(LEVEL5.HP_BAR_WIDTH) * percent, scaleY(LEVEL5.HP_BAR_HEIGHT));
    this.bossHpText.setText(`${t("level5.hp", { hp: this.bossHp })}/${LEVEL5.BOSS_HP}`);
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
    this.heartPickup?.destroy();
    this.heartPickup = undefined;
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
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL5.COMPLETE_TEXT_X),
      scaleY(LEVEL5.COMPLETE_TEXT_Y),
      t("common.points", { points: LEVEL5.LEVEL_COMPLETE_SCORE }),
      "#8fe388"
    );
    this.hud.updateAll();

    this.time.delayedCall(LEVEL5.LEVEL_COMPLETE_DELAY_MS, () => {
      this.showDialog(t("level5.congratsShutdown"), () => {
        this.showDialog(t("level5.goodLuck"), () => {
          this.scene.start("VictoryScene");
        });
      });
    });
  }
}

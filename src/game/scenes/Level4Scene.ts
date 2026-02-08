import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Rival } from "../entities/Rival";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, FLOATING_TEXT, LEVEL4, MATH, PLAYER, RUN, SCALE, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { scale, scaleX, scaleY } from "../utils/layout";

export class Level4Scene extends BaseLevelScene {
  private player!: Player;
  private rivals: Rival[] = [];
  private checkpointY = scaleY(LEVEL4.CHECKPOINT_START_Y);
  private checkpointEvery = scaleY(LEVEL4.CHECKPOINT_EVERY_DEFAULT);
  private doorZone!: Phaser.GameObjects.Rectangle;
  private pushStrength = scale(LEVEL4.DEFAULT_PUSH_STRENGTH);

  constructor() {
    super("Level4Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL4);
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL4.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, scaleY(LEVEL4.WORLD_HEIGHT));
    this.cameras.main.setBounds(0, 0, this.scale.width, scaleY(LEVEL4.WORLD_HEIGHT));

    this.add.rectangle(scaleX(LEVEL4.BG_CENTER_X), scaleY(LEVEL4.BG_CENTER_Y), this.scale.width, scaleY(LEVEL4.WORLD_HEIGHT), LEVEL4.BG_COLOR);

    const platforms = this.physics.add.staticGroup();
    platforms
      .create(scaleX(LEVEL4.GROUND_X), scaleY(LEVEL4.GROUND_Y), "platform")
      .setScale(LEVEL4.GROUND_SCALE_X * scaleX(SCALE.UNIT), LEVEL4.GROUND_SCALE_Y * scaleY(SCALE.UNIT))
      .refreshBody();

    let y = scaleY(LEVEL4.PLATFORM_START_Y);
    let offset = 0;
    for (let i = 0; i < LEVEL4.PLATFORM_COUNT; i += 1) {
      const x = scaleX(LEVEL4.PLATFORM_X_BASE + (offset % LEVEL4.PLATFORM_X_GROUP) * LEVEL4.PLATFORM_X_STEP);
      platforms
        .create(x, y, "platform")
        .setScale(LEVEL4.PLATFORM_SCALE_X * scaleX(SCALE.UNIT), LEVEL4.PLATFORM_SCALE_Y * scaleY(SCALE.UNIT))
        .refreshBody();
      y -= scaleY(LEVEL4.PLATFORM_STEP_Y);
      offset += 1;
    }

    this.player = new Player(this, scaleX(LEVEL4.PLAYER_START.x), scaleY(LEVEL4.PLAYER_START.y));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, platforms);

    const diff = difficultyPresets[runState.difficulty];
    this.checkpointEvery = scaleY(diff.l4.checkpointEveryPx);
    this.pushStrength = scale(diff.l4.pushStrength);

    for (let i = 0; i < diff.l4.rivalsCount; i += 1) {
      const rival = new Rival(
        this,
        scaleX(LEVEL4.RIVAL_SPAWN_X_START + i * LEVEL4.RIVAL_SPAWN_X_STEP),
        scaleY(LEVEL4.RIVAL_SPAWN_Y)
      );
      this.rivals.push(rival);
      this.physics.add.collider(rival, platforms);
      this.physics.add.collider(this.player, rival, () => {
        const pushDir = this.player.x < rival.x ? -1 : 1;
        this.player.setVelocityX(pushDir * this.pushStrength);
        this.player.setVelocityY(this.pushStrength * LEVEL4.RIVAL_PUSH_Y_MULTIPLIER);
      });
    }

    this.cameras.main.startFollow(this.player, true, LEVEL4.CAMERA_LERP, LEVEL4.CAMERA_LERP);

    this.doorZone = this.add.rectangle(
      scaleX(LEVEL4.DOOR_X),
      scaleY(LEVEL4.DOOR_Y),
      scaleX(LEVEL4.DOOR_WIDTH),
      scaleY(LEVEL4.DOOR_HEIGHT),
      LEVEL4.DOOR_COLOR,
      LEVEL4.DOOR_ALPHA
    );
    this.physics.add.existing(this.doorZone, true);

    this.physics.add.overlap(this.player, this.doorZone, () => this.completeLevel());
  }

  update(_: number, __: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED), scale(PLAYER.JUMP_DEFAULT));

    for (const rival of this.rivals) {
      rival.updateAI(this.player.x);
      if (this.player.y < rival.y && !rival.getData("overtaken")) {
        rival.setData("overtaken", true);
        this.scoreSystem.addSkill(LEVEL4.RIVAL_OVERTAKE_SCORE);
        FloatingText.spawn(
          this,
          rival.x,
          rival.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
          `+${LEVEL4.RIVAL_OVERTAKE_SCORE}`,
          "#8fe388"
        );
      }
    }

    if (this.inputManager.justPressedConfirm()) {
      const rival = this.getNearestRival();
      if (rival) {
        const dir = rival.x < this.player.x ? -1 : 1;
        rival.setVelocityY(-this.pushStrength * LEVEL4.RIVAL_PUSH_JUMP_MULTIPLIER);
        rival.setVelocityX(dir * this.pushStrength);
      }
    }

    if (this.player.y > this.cameras.main.scrollY + scaleY(LEVEL4.FALL_RESET_BUFFER_Y)) {
      this.scoreSystem.addPenalty(LEVEL4.FALL_PENALTY);
      this.scoreSystem.breakCombo();
      this.applyDamage(() => {
        this.player.setPosition(scaleX(LEVEL4.PLAYER_START.x), this.checkpointY);
      });
      FloatingText.spawn(
        this,
        this.player.x,
        this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
        `${LEVEL4.FALL_PENALTY}`,
        "#ff6b6b"
      );
    }

    if (this.player.y < this.checkpointY - this.checkpointEvery) {
      this.checkpointY = this.player.y;
    }

    this.hud.updateAll();
  }

  private getNearestRival(): Rival | null {
    let best: Rival | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const rival of this.rivals) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, rival.x, rival.y);
      if (dist < scale(LEVEL4.RIVAL_INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = rival;
      }
    }
    return best;
  }

  private completeLevel(): void {
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
      `+${LEVEL4.COMPLETE_SCORE}`,
      "#8fe388"
    );
    this.hud.updateAll();
    this.time.delayedCall(LEVEL4.COMPLETE_DELAY_MS, () => this.scene.start("Level5Scene"));
  }
}

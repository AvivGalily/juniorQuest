import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { BossAISpider } from "../entities/BossAISpider";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, FLOATING_TEXT, LEVEL5, MATH, PLAYER, RUN, SCALE, STAGE } from "../../config/physics";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { rngPick } from "../utils/rng";
import { createDialogText, setDomText } from "../utils/domText";
import { getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";

export class Level5Scene extends BaseLevelScene {
  private player!: Player;
  private boss!: BossAISpider;
  private phase = LEVEL5.PHASE_ONE;
  private patternActive = false;
  private pattern: string[] = [];
  private patternIndex = LEVEL5.PATTERN_INDEX_START;
  private patternText!: Phaser.GameObjects.DOMElement;
  private hpText!: Phaser.GameObjects.DOMElement;
  private patternTimeout?: Phaser.Time.TimerEvent;
  private attackTimer?: Phaser.Time.TimerEvent;
  private patternTimer?: Phaser.Time.TimerEvent;
  private bugGroup!: Phaser.Physics.Arcade.Group;
  private fightActive = false;
  private patternWindowMs: number = LEVEL5.DEFAULT_PATTERN_WINDOW_MS;
  private patternIntervalMs: number = LEVEL5.DEFAULT_PATTERN_INTERVAL_MS;
  private basePatternIntervalMs: number = LEVEL5.DEFAULT_PATTERN_INTERVAL_MS;

  constructor() {
    super("Level5Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL5);
    this.audio.playMusic("music-boss", AUDIO.MUSIC.BOSS);
    this.physics.world.gravity.y = LEVEL5.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, LEVEL5.BG_COLOR);
    const ground = this.physics.add
      .staticImage(scaleX(LEVEL5.GROUND_X), scaleY(LEVEL5.GROUND_Y), "platform")
      .setScale(LEVEL5.GROUND_SCALE_X * scaleX(SCALE.UNIT), LEVEL5.GROUND_SCALE_Y * scaleY(SCALE.UNIT))
      .refreshBody();

    this.player = new Player(this, scaleX(LEVEL5.PLAYER_START.x), scaleY(LEVEL5.PLAYER_START.y));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, ground);

    const diff = difficultyPresets[runState.difficulty];
    this.patternWindowMs = Math.max(diff.l5.patternWindowMs, diff.l5.minReactionWindowMs);
    this.basePatternIntervalMs = Math.max(LEVEL5.PATTERN_TIMER_BASE_MIN_MS, LEVEL5.PATTERN_TIMER_BASE_MAX_MS / diff.l5.patternSpeed);
    this.patternIntervalMs = this.basePatternIntervalMs;

    this.boss = new BossAISpider(this, scaleX(LEVEL5.BOSS_X), scaleY(LEVEL5.BOSS_Y), diff.l5.bossHP);
    this.boss.body.allowGravity = false;

    this.hpText = createDialogText(this, scaleX(LEVEL5.HP_X), scaleY(LEVEL5.HP_Y), `HP ${this.boss.hp}`, {
      maxWidth: LEVEL5.HP_MAX_WIDTH,
      fontSize: LEVEL5.HP_FONT_SIZE,
      color: "#ffd166"
    });

    this.patternText = createDialogText(this, scaleX(LEVEL5.PATTERN_X), scaleY(LEVEL5.PATTERN_Y), "", {
      maxWidth: LEVEL5.PATTERN_MAX_WIDTH,
      fontSize: LEVEL5.PATTERN_FONT_SIZE,
      color: "#8fe388"
    });

    this.bugGroup = this.physics.add.group();

    this.showDialog("You were the best in interviews, but the role is no longer needed because of AI.", () => {
      this.startFight();
    });

    this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
      if (!this.patternActive) {
        return;
      }
      const key = event.key.toUpperCase();
      this.handlePatternKey(key);
    });
  }

  update(_: number, __: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED), scale(PLAYER.JUMP_DEFAULT));

    if (this.phase === LEVEL5.PHASE_THREE) {
      this.bugGroup.children.iterate((child) => {
        const bug = child as Phaser.Physics.Arcade.Sprite;
        if (!bug.active) {
          return false;
        }
        const dx = this.player.x - bug.x;
        const dy = this.player.y - bug.y;
        const dist = Math.hypot(dx, dy) || 1;
        bug.setVelocity((dx / dist) * scale(LEVEL5.BUG_SPEED), (dy / dist) * scale(LEVEL5.BUG_SPEED));
        return true;
      });
    }

    if (this.inputManager.justPressedAttack()) {
      const bug = this.getNearestBug();
      if (bug) {
        bug.destroy();
        FloatingText.spawn(this, bug.x, bug.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "CLEAR", "#8fe388");
      }
    }

    this.hud.updateAll();
  }

  private showDialog(text: string, onDone: () => void): void {
    const bubble = this.add.image(scaleX(LEVEL5.DIALOG_X), scaleY(LEVEL5.DIALOG_Y), "speech_bubble");
    bubble.setScale(getUiScale());
    const label = createDialogText(this, scaleX(LEVEL5.DIALOG_X), scaleY(LEVEL5.DIALOG_Y), text, {
      maxWidth: LEVEL5.DIALOG_MAX_WIDTH,
      fontSize: LEVEL5.DIALOG_FONT_SIZE,
      color: "#1b1f24",
      padding: `${LEVEL5.DIALOG_PADDING_Y}px ${LEVEL5.DIALOG_PADDING_X}px`,
      align: "center"
    });
    this.time.delayedCall(LEVEL5.DIALOG_DURATION_MS, () => {
      bubble.destroy();
      label.destroy();
      onDone();
    });
  }

  private startFight(): void {
    this.fightActive = true;
    this.patternTimer = this.time.addEvent({
      delay: this.patternIntervalMs,
      loop: true,
      callback: () => this.startPattern()
    });

    this.attackTimer = this.time.addEvent({
      delay: LEVEL5.ATTACK_INTERVAL_MS,
      loop: true,
      callback: () => this.triggerAttack()
    });
  }

  private startPattern(): void {
    if (!this.fightActive || this.patternActive) {
      return;
    }
    const length =
      this.phase === LEVEL5.PHASE_ONE ? LEVEL5.PATTERN_PHASE1_LENGTH : LEVEL5.PATTERN_PHASE2_LENGTH;
    const pool = this.phase === LEVEL5.PHASE_ONE ? ["A", "S", "D"] : ["A", "S", "D", "F"];
    this.pattern = [];
    for (let i = 0; i < length; i += 1) {
      this.pattern.push(rngPick(pool));
    }
    this.patternIndex = LEVEL5.PATTERN_INDEX_START;
    this.patternActive = true;
    setDomText(this.patternText, this.pattern.join(" "));

    this.patternTimeout?.remove();
    this.patternTimeout = this.time.delayedCall(this.patternWindowMs, () => {
      if (this.patternActive) {
        this.failPattern();
      }
    });
  }

  private handlePatternKey(key: string): void {
    if (!this.patternActive) {
      return;
    }
    if (key === this.pattern[this.patternIndex]) {
      this.patternIndex += 1;
      if (this.patternIndex >= this.pattern.length) {
        this.completePattern();
      }
    } else {
      this.failPattern();
    }
  }

  private completePattern(): void {
    this.patternActive = false;
    setDomText(this.patternText, "");
    this.scoreSystem.addSkill(LEVEL5.PATTERN_SUCCESS_SCORE);
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS);
    this.boss.damage(LEVEL5.BOSS_DAMAGE);
    setDomText(this.hpText, `HP ${this.boss.hp}`);
    FloatingText.spawn(
      this,
      this.boss.x,
      this.boss.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM),
      `-${LEVEL5.BOSS_DAMAGE} HP`,
      "#ffd166"
    );

    if (this.boss.hp <= 0) {
      this.finishLevel();
      return;
    }

    this.updatePhase();
  }

  private failPattern(): void {
    this.patternActive = false;
    setDomText(this.patternText, "");
    this.scoreSystem.addPenalty(LEVEL5.PATTERN_FAIL_PENALTY);
    this.scoreSystem.breakCombo();
    this.applyDamage();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_MEDIUM), "FAILED", "#ff6b6b");
  }

  private triggerAttack(): void {
    if (!this.fightActive) {
      return;
    }
    if (this.phase === LEVEL5.PHASE_ONE) {
      this.spawnProjectile();
    } else if (this.phase === LEVEL5.PHASE_TWO) {
      this.spawnSlam();
    } else {
      this.spawnBug();
    }
  }

  private spawnProjectile(): void {
    const proj = this.physics.add.image(
      this.boss.x - scale(LEVEL5.PROJECTILE_OFFSET_X),
      this.boss.y - scale(LEVEL5.PROJECTILE_OFFSET_Y),
      "projectile"
    );
    proj.setScale(scale(SCALE.UNIT));
    proj.setVelocity(-scale(LEVEL5.PROJECTILE_SPEED_X), -scale(LEVEL5.PROJECTILE_SPEED_Y));
    proj.body.allowGravity = false;
    this.physics.add.overlap(this.player, proj, () => {
      proj.destroy();
      this.applyDamage();
    });
  }

  private spawnSlam(): void {
    const warning = this.add.rectangle(
      scaleX(LEVEL5.PATTERN_X),
      scaleY(LEVEL5.SLAM_Y),
      this.scale.width,
      scaleY(LEVEL5.SLAM_HEIGHT),
      LEVEL5.SLAM_COLOR,
      LEVEL5.SLAM_ALPHA
    );
    this.time.delayedCall(LEVEL5.SLAM_DELAY_MS, () => {
      if (this.player.body.blocked.down) {
        this.applyDamage();
      }
      warning.destroy();
    });
  }

  private spawnBug(): void {
    const bug = this.physics.add.image(scaleX(LEVEL5.BUG_SPAWN_X), scaleY(LEVEL5.BUG_SPAWN_Y), "bug");
    bug.setScale(scale(SCALE.UNIT));
    bug.body.allowGravity = false;
    this.bugGroup.add(bug);
    this.physics.add.overlap(this.player, bug, () => {
      bug.destroy();
      this.applyDamage();
    });
  }

  private updatePhase(): void {
    const maxHp = difficultyPresets[runState.difficulty].l5.bossHP;
    let nextPhase = this.phase;
    if (this.boss.hp <= Math.ceil(maxHp * LEVEL5.PHASE_THREE_THRESHOLD)) {
      nextPhase = LEVEL5.PHASE_THREE;
    } else if (this.boss.hp <= Math.ceil(maxHp * LEVEL5.PHASE_TWO_THRESHOLD)) {
      nextPhase = LEVEL5.PHASE_TWO;
    }
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.audio.playSfx("sfx-phase", AUDIO.SFX.PHASE);
      const phaseMultiplier =
        this.phase === LEVEL5.PHASE_TWO ? LEVEL5.PATTERN_PHASE2_MULTIPLIER : LEVEL5.PATTERN_PHASE3_MULTIPLIER;
      this.patternIntervalMs = Math.max(LEVEL5.PATTERN_INTERVAL_MIN_MS, this.basePatternIntervalMs * phaseMultiplier);
      if (this.patternTimer) {
        this.patternTimer.remove();
        this.patternTimer = this.time.addEvent({
          delay: this.patternIntervalMs,
          loop: true,
          callback: () => this.startPattern()
        });
      }
    }
  }

  private getNearestBug(): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    this.bugGroup.children.iterate((child) => {
      const bug = child as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bug.x, bug.y);
      if (dist < scale(LEVEL5.BUG_INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = bug;
      }
      return true;
    });
    return best;
  }

  private finishLevel(): void {
    this.fightActive = false;
    this.attackTimer?.remove();
    this.patternTimer?.remove();
    this.patternTimeout?.remove();
    this.scoreSystem.addBase(LEVEL5.LEVEL_COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL5.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL5.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL5.COMPLETE_TEXT_X),
      scaleY(LEVEL5.COMPLETE_TEXT_Y),
      `+${LEVEL5.LEVEL_COMPLETE_SCORE}`,
      "#8fe388"
    );
    this.hud.updateAll();

    this.showDialog("Congrats on the new job! But the company shut down.", () => {
      this.showDialog("Good luck searching.", () => {
        this.scene.start("VictoryScene");
      });
    });
  }
}

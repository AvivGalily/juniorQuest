import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { BossAISpider } from "../entities/BossAISpider";
import { difficultyPresets } from "../../config/difficulty";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";
import { rngPick } from "../utils/rng";
import { createDialogText, setDomText } from "../utils/domText";
import { getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";

export class Level5Scene extends BaseLevelScene {
  private player!: Player;
  private boss!: BossAISpider;
  private phase = 1;
  private patternActive = false;
  private pattern: string[] = [];
  private patternIndex = 0;
  private patternText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private patternTimeout?: Phaser.Time.TimerEvent;
  private attackTimer?: Phaser.Time.TimerEvent;
  private patternTimer?: Phaser.Time.TimerEvent;
  private bugGroup!: Phaser.Physics.Arcade.Group;
  private fightActive = false;
  private patternWindowMs = 1600;
  private patternIntervalMs = 2800;
  private basePatternIntervalMs = 2800;

  constructor() {
    super("Level5Scene");
  }

  create(): void {
    this.initLevel(5);
    this.audio.playMusic("music-boss", 0.25);
    this.physics.world.gravity.y = 700;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x101019);
    const ground = this.physics.add.staticImage(scaleX(320), scaleY(330), "platform").setScale(10 * scaleX(1), 1 * scaleY(1)).refreshBody();

    this.player = new Player(this, scaleX(120), scaleY(280));
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, ground);

    const diff = difficultyPresets[runState.difficulty];
    this.patternWindowMs = Math.max(diff.l5.patternWindowMs, diff.l5.minReactionWindowMs);
    this.basePatternIntervalMs = Math.max(1800, 3200 / diff.l5.patternSpeed);
    this.patternIntervalMs = this.basePatternIntervalMs;

    this.boss = new BossAISpider(this, scaleX(520), scaleY(200), diff.l5.bossHP);
    this.boss.body.allowGravity = false;

    this.hpText = createDialogText(this, scaleX(520), scaleY(130), `HP ${this.boss.hp}`, {
      maxWidth: 120,
      fontSize: 14,
      color: "#ffd166"
    });

    this.patternText = createDialogText(this, scaleX(320), scaleY(60), "", {
      maxWidth: 300,
      fontSize: 16,
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
    this.player.updatePlatformer(this.inputManager, scale(150), scale(300));

    if (this.phase === 3) {
      this.bugGroup.children.iterate((child) => {
        const bug = child as Phaser.Physics.Arcade.Sprite;
        if (!bug.active) {
          return false;
        }
        const dx = this.player.x - bug.x;
        const dy = this.player.y - bug.y;
        const dist = Math.hypot(dx, dy) || 1;
        bug.setVelocity((dx / dist) * scale(80), (dy / dist) * scale(80));
        return true;
      });
    }

    if (this.inputManager.justPressedAttack()) {
      const bug = this.getNearestBug();
      if (bug) {
        bug.destroy();
        FloatingText.spawn(this, bug.x, bug.y - scale(10), "CLEAR", "#8fe388");
      }
    }

    this.hud.updateAll();
  }

  private showDialog(text: string, onDone: () => void): void {
    const bubble = this.add.image(scaleX(320), scaleY(260), "speech_bubble");
    bubble.setScale(getUiScale());
    const label = createDialogText(this, scaleX(320), scaleY(260), text, {
      maxWidth: 180,
      fontSize: 14,
      color: "#1b1f24",
      padding: "6px 8px",
      align: "center"
    });
    this.time.delayedCall(2200, () => {
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
      delay: 1800,
      loop: true,
      callback: () => this.triggerAttack()
    });
  }

  private startPattern(): void {
    if (!this.fightActive || this.patternActive) {
      return;
    }
    const length = this.phase === 1 ? 3 : 4;
    const pool = this.phase === 1 ? ["A", "S", "D"] : ["A", "S", "D", "F"];
    this.pattern = [];
    for (let i = 0; i < length; i += 1) {
      this.pattern.push(rngPick(pool));
    }
    this.patternIndex = 0;
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
    this.scoreSystem.addSkill(200);
    this.audio.playSfx("sfx-success", 0.6);
    this.boss.damage(1);
    setDomText(this.hpText, `HP ${this.boss.hp}`);
    FloatingText.spawn(this, this.boss.x, this.boss.y - scale(20), "-1 HP", "#ffd166");

    if (this.boss.hp <= 0) {
      this.finishLevel();
      return;
    }

    this.updatePhase();
  }

  private failPattern(): void {
    this.patternActive = false;
    setDomText(this.patternText, "");
    this.scoreSystem.addPenalty(-75);
    this.scoreSystem.breakCombo();
    this.applyDamage();
    FloatingText.spawn(this, this.player.x, this.player.y - scale(20), "FAILED", "#ff6b6b");
  }

  private triggerAttack(): void {
    if (!this.fightActive) {
      return;
    }
    if (this.phase === 1) {
      this.spawnProjectile();
    } else if (this.phase === 2) {
      this.spawnSlam();
    } else {
      this.spawnBug();
    }
  }

  private spawnProjectile(): void {
    const proj = this.physics.add.image(this.boss.x - scale(30), this.boss.y - scale(10), "projectile");
    proj.setScale(scale(1));
    proj.setVelocity(-scale(220), -scale(30));
    proj.body.allowGravity = false;
    this.physics.add.overlap(this.player, proj, () => {
      proj.destroy();
      this.applyDamage();
    });
  }

  private spawnSlam(): void {
    const warning = this.add.rectangle(scaleX(320), scaleY(320), this.scale.width, scaleY(20), 0xff4d4d, 0.4);
    this.time.delayedCall(300, () => {
      if (this.player.body.blocked.down) {
        this.applyDamage();
      }
      warning.destroy();
    });
  }

  private spawnBug(): void {
    const bug = this.physics.add.image(scaleX(480), scaleY(260), "bug");
    bug.setScale(scale(1));
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
    if (this.boss.hp <= Math.ceil(maxHp / 3)) {
      nextPhase = 3;
    } else if (this.boss.hp <= Math.ceil((maxHp * 2) / 3)) {
      nextPhase = 2;
    }
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.audio.playSfx("sfx-phase", 0.6);
      const phaseMultiplier = this.phase === 2 ? 0.9 : 0.8;
      this.patternIntervalMs = Math.max(1200, this.basePatternIntervalMs * phaseMultiplier);
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
    let bestDist = 9999;
    this.bugGroup.children.iterate((child) => {
      const bug = child as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bug.x, bug.y);
      if (dist < scale(40) && dist < bestDist) {
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
    this.scoreSystem.addBase(4000);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(800);
    }
    this.scoreSystem.applyTimeBonus(180000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, scaleX(320), scaleY(140), "+4000", "#8fe388");
    this.hud.updateAll();

    this.showDialog("Congrats on the new job! But the company shut down.", () => {
      this.showDialog("Good luck searching.", () => {
        this.scene.start("VictoryScene");
      });
    });
  }
}

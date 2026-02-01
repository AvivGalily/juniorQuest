import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Recruiter } from "../entities/Recruiter";
import { Guard } from "../entities/Guard";
import { difficultyPresets } from "../../config/difficulty";
import { runState } from "../RunState";
import { rngInt, rngPick } from "../utils/rng";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";

export class Level1Scene extends BaseLevelScene {
  private player!: Player;
  private guard!: Guard;
  private recruiters: Recruiter[] = [];
  private targetRecruiterId = 0;
  private targetCompany = "";
  private detectionTimer = 0;
  private guardFov!: Phaser.GameObjects.Graphics;
  private dialog?: { bubble: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text };
  private wrongInteractions = 0;
  private hasCV = false;
  private cvItem?: Phaser.Physics.Arcade.Image;
  private cvLabel?: Phaser.GameObjects.Text;
  private cvStartX = 560;
  private cvStartY = 70;

  constructor() {
    super("Level1Scene");
  }

  create(): void {
    this.initLevel(1);
    this.audio.playMusic("music-gameplay", 0.2);
    this.physics.world.gravity.y = 0;
    this.add.rectangle(320, 180, 640, 360, 0x15202b);
    this.physics.world.setBounds(0, 0, 640, 360);

    const obstacles = this.physics.add.staticGroup();
    obstacles.create(140, 110, "booth");
    obstacles.create(320, 140, "booth");
    obstacles.create(500, 110, "booth");
    obstacles.create(220, 240, "booth");
    obstacles.create(420, 240, "booth");

    const crowd = this.physics.add.staticGroup();
    crowd.create(120, 200, "recruiter");
    crowd.create(520, 200, "recruiter");
    crowd.create(320, 280, "recruiter");

    this.player = new Player(this, 60, 320);
    this.player.body.allowGravity = false;
    this.player.setCarrying(false);
    this.setPlayer(this.player);

    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.player, crowd);

    const tags = ["Cloudify", "DataNinjas", "PixelSoft", "LambdaLab", "SprintWorks", "StackLion", "ByteForge", "NodeWave", "Signal42", "BrightAI"];
    const diff = difficultyPresets[runState.difficulty];
    for (let i = 0; i < diff.l1.recruiterCount; i += 1) {
      const x = rngInt(80, 560);
      const y = rngInt(70, 300);
      const recruiter = new Recruiter(this, x, y, tags[i % tags.length]);
      recruiter.body.allowGravity = false;
      recruiter.setInteractive({ useHandCursor: true });
      recruiter.on("pointerdown", () => this.tryRecruiterInteraction(recruiter));
      this.recruiters.push(recruiter);
      this.physics.add.collider(recruiter, obstacles);
      this.physics.add.collider(recruiter, crowd);
    }

    this.targetRecruiterId = rngInt(0, this.recruiters.length - 1);
    this.targetCompany = this.recruiters[this.targetRecruiterId].companyTag;
    this.recruiters[this.targetRecruiterId].setTint(0x8b5cf6);

    this.add.image(80, 50, "notice_board");
    createDialogText(this, 80, 50, `Target: ${this.targetCompany}`, {
      maxWidth: 120,
      fontSize: 14,
      color: "#e8eef2"
    });

    const waypoints = [
      new Phaser.Math.Vector2(520, 60),
      new Phaser.Math.Vector2(560, 180),
      new Phaser.Math.Vector2(480, 300),
      new Phaser.Math.Vector2(420, 180)
    ];
    this.guard = new Guard(this, 520, 60, waypoints, diff.l1.guardSpeed);
    this.guard.body.allowGravity = false;
    this.guardFov = this.add.graphics();
    this.physics.add.collider(this.guard, obstacles);
    this.physics.add.collider(this.guard, crowd);

    this.spawnCv();
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updateTopDown(this.inputManager, 120);
    this.guard.update();
    this.recruiters.forEach((recruiter) => recruiter.update(delta));
    this.checkGuardDetection(delta);

    if (this.inputManager.justPressedConfirm()) {
      const nearest = this.getNearestRecruiter();
      if (nearest) {
        this.tryRecruiterInteraction(nearest);
      }
    }

    this.hud.updateAll();
  }

  private getNearestRecruiter(): Recruiter | null {
    let best: Recruiter | null = null;
    let bestDist = 9999;
    for (const recruiter of this.recruiters) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
      if (dist < 26 && dist < bestDist) {
        bestDist = dist;
        best = recruiter;
      }
    }
    return best;
  }

  private tryRecruiterInteraction(recruiter: Recruiter): void {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
    if (dist > 30) {
      return;
    }
    if (!this.hasCV) {
      this.showDialog("Pick up your CV first.");
      return;
    }
    if (this.recruiters[this.targetRecruiterId] === recruiter) {
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
      this.scoreSystem.addPenalty(-20);
      this.scoreSystem.breakCombo();
      this.hasCV = false;
      this.player.setCarrying(false);
      this.spawnCv();
    }
  }

  private spawnCv(): void {
    this.cvItem?.destroy();
    this.cvLabel?.destroy();
    this.cvItem = this.physics.add.staticImage(this.cvStartX, this.cvStartY, "cv");
    this.cvLabel = createDialogText(this, this.cvStartX + 18, this.cvStartY, "Pick up CV", {
      maxWidth: 120,
      fontSize: 12,
      color: "#e8eef2",
      align: "left",
      originX: 0
    });
    this.physics.add.overlap(this.player, this.cvItem, () => this.pickupCv());
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
    this.audio.playSfx("sfx-success", 0.4);
    FloatingText.spawn(this, this.player.x, this.player.y - 10, "CV COLLECTED", "#8fe388");
  }

  private showDialog(text: string): void {
    if (this.dialog) {
      this.dialog.bubble.destroy();
      this.dialog.label.destroy();
      this.dialog = undefined;
    }
    const bubble = this.add.image(320, 300, "speech_bubble");
    const label = createDialogText(this, 320, 300, text, {
      maxWidth: 180,
      fontSize: 14,
      color: "#1b1f24",
      padding: "6px 8px",
      align: "center"
    });
    this.dialog = { bubble, label };
    this.time.delayedCall(1500, () => {
      if (this.dialog) {
        this.dialog.bubble.destroy();
        this.dialog.label.destroy();
        this.dialog = undefined;
      }
    });
  }

  private checkGuardDetection(delta: number): void {
    const diff = difficultyPresets[runState.difficulty];
    const range = 130;
    const fovRad = Phaser.Math.DegToRad(diff.l1.guardFovDeg);
    const facing = this.guard.getFacingAngle();
    const angleToPlayer = Phaser.Math.Angle.Between(this.guard.x, this.guard.y, this.player.x, this.player.y);
    const dist = Phaser.Math.Distance.Between(this.guard.x, this.guard.y, this.player.x, this.player.y);
    const angleDiff = Phaser.Math.Angle.Wrap(angleToPlayer - facing);
    const inCone = dist < range && Math.abs(angleDiff) < fovRad / 2;

    if (inCone) {
      this.detectionTimer += delta;
    } else {
      this.detectionTimer = 0;
    }

    if (this.detectionTimer >= diff.l1.detectionHoldMs) {
      this.detectionTimer = 0;
      this.scoreSystem.addPenalty(-200);
      this.scoreSystem.breakCombo();
      this.applyDamage(() => {
        this.player.setPosition(60, 320);
      });
      FloatingText.spawn(this, this.player.x, this.player.y - 10, "-1 HEART", "#ff6b6b");
    }

    this.drawGuardFov(range, fovRad, facing);
  }

  private drawGuardFov(range: number, fovRad: number, facing: number): void {
    const left = facing - fovRad / 2;
    const right = facing + fovRad / 2;
    const p1 = new Phaser.Math.Vector2(this.guard.x, this.guard.y);
    const p2 = new Phaser.Math.Vector2(this.guard.x + Math.cos(left) * range, this.guard.y + Math.sin(left) * range);
    const p3 = new Phaser.Math.Vector2(this.guard.x + Math.cos(right) * range, this.guard.y + Math.sin(right) * range);

    this.guardFov.clear();
    this.guardFov.fillStyle(0xff4d4d, 0.18);
    this.guardFov.beginPath();
    this.guardFov.moveTo(p1.x, p1.y);
    this.guardFov.lineTo(p2.x, p2.y);
    this.guardFov.lineTo(p3.x, p3.y);
    this.guardFov.closePath();
    this.guardFov.fillPath();
  }

  private completeLevel(): void {
    this.scoreSystem.addBase(1000);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(300);
    }
    this.scoreSystem.applyTimeBonus(60000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, 320, 120, "+1000", "#8fe388");
    this.hud.updateAll();

    this.time.delayedCall(1200, () => {
      this.scene.start("Level2Scene");
    });
  }
}

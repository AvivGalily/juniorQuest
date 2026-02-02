import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Recruiter } from "../entities/recruiter/Recruiter";
import { Guard } from "../entities/guard/Guard";
import { Npc } from "../entities/npc/Npc";
import { difficultyPresets } from "../../config/difficulty";
import { runState } from "../RunState";
import { rngInt, rngPick } from "../utils/rng";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText } from "../utils/domText";
import { BASE_HEIGHT, getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";
import { scaleSpriteToHeight } from "../utils/spriteScale";

export class Level1Scene extends BaseLevelScene {
  private player!: Player;
  private guards: Guard[] = [];
  private guardFovs: Phaser.GameObjects.Graphics[] = [];
  private recruiters: Recruiter[] = [];
  private npcs: Npc[] = [];
  private targetRecruiterId = 0;
  private targetCompany = "";
  private detectionTimer = 0;
  private dialog?: { bubble: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text };
  private wrongInteractions = 0;
  private hasCV = false;
  private cvItem?: Phaser.Physics.Arcade.Image;
  private cvLabel?: Phaser.GameObjects.Text;
  private cvStartX = 560;
  private cvStartY = 70;
  private trashBins: { sprite: Phaser.Physics.Arcade.Image; full: boolean }[] = [];

  constructor() {
    super("Level1Scene");
  }

  create(): void {
    this.initLevel(1);
    this.audio.playMusic("music-gameplay", 0.2);
    this.physics.world.gravity.y = 0;
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x15202b);
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    const obstacles = this.physics.add.staticGroup();
    const boothHeight = BASE_HEIGHT * 0.22;
    const booth1a = obstacles.create(scaleX(140), scaleY(110), "both1") as Phaser.Physics.Arcade.Image;
    const booth1b = obstacles.create(scaleX(500), scaleY(110), "both1") as Phaser.Physics.Arcade.Image;
    const booth2a = obstacles.create(scaleX(220), scaleY(240), "both2") as Phaser.Physics.Arcade.Image;
    const booth2b = obstacles.create(scaleX(420), scaleY(240), "both2") as Phaser.Physics.Arcade.Image;
    [booth1a, booth1b, booth2a, booth2b].forEach((booth) => {
      scaleSpriteToHeight(booth, boothHeight);
      booth.refreshBody();
    });

    const trashGroup = this.physics.add.staticGroup();
    const trashPositions = [
      { x: scaleX(70), y: scaleY(120) },
      { x: scaleX(570), y: scaleY(120) },
      { x: scaleX(70), y: scaleY(280) },
      { x: scaleX(570), y: scaleY(280) }
    ];
    const trashHeight = BASE_HEIGHT * 0.08;
    this.trashBins = trashPositions.map((pos) => {
      const sprite = trashGroup.create(pos.x, pos.y, "trash-empty") as Phaser.Physics.Arcade.Image;
      scaleSpriteToHeight(sprite, trashHeight);
      sprite.refreshBody();
      return { sprite, full: false };
    });

    this.player = new Player(this, scaleX(60), scaleY(320));
    this.player.body.allowGravity = false;
    this.player.setCarrying(false);
    this.setPlayer(this.player);

    this.cvStartX = scaleX(560);
    this.cvStartY = scaleY(70);

    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.player, trashGroup);

    const tags = ["Cloudify", "DataNinjas", "PixelSoft", "LambdaLab", "SprintWorks", "StackLion", "ByteForge", "NodeWave", "Signal42", "BrightAI"];
    const diff = difficultyPresets[runState.difficulty];
    const hrCount = 4;
    const npcCount = 6;
    for (let i = 0; i < hrCount; i += 1) {
      const x = rngInt(scaleX(80), scaleX(560));
      const y = rngInt(scaleY(70), scaleY(300));
      const recruiter = new Recruiter(this, x, y, tags[i % tags.length]);
      recruiter.body.allowGravity = false;
      recruiter.setInteractive({ useHandCursor: true });
      recruiter.on("pointerdown", () => this.tryRecruiterInteraction(recruiter));
      this.recruiters.push(recruiter);
      this.physics.add.collider(recruiter, obstacles);
      this.physics.add.collider(recruiter, trashGroup);
      this.physics.add.collider(this.player, recruiter);
    }

    for (let i = 0; i < npcCount; i += 1) {
      const x = rngInt(scaleX(80), scaleX(560));
      const y = rngInt(scaleY(70), scaleY(300));
      const variant = ((i % 3) + 1) as 1 | 2 | 3;
      const npc = new Npc(this, x, y, variant);
      npc.body.allowGravity = false;
      this.npcs.push(npc);
      this.physics.add.collider(npc, obstacles);
      this.physics.add.collider(npc, trashGroup);
      this.physics.add.collider(this.player, npc);
    }

    this.targetRecruiterId = rngInt(0, this.recruiters.length - 1);
    this.targetCompany = this.recruiters[this.targetRecruiterId].companyTag;
    this.recruiters[this.targetRecruiterId].setTint(0x8b5cf6);

    const notice = this.add.image(scaleX(80), scaleY(50), "notice_board");
    notice.setScale(getUiScale());
    createDialogText(this, scaleX(80), scaleY(50), `Target: ${this.targetCompany}`, {
      maxWidth: 120,
      fontSize: 14,
      color: "#e8eef2"
    });

    const waypoints = [
      new Phaser.Math.Vector2(scaleX(520), scaleY(60)),
      new Phaser.Math.Vector2(scaleX(560), scaleY(180)),
      new Phaser.Math.Vector2(scaleX(480), scaleY(300)),
      new Phaser.Math.Vector2(scaleX(420), scaleY(180))
    ];
    const waypoints2 = [
      new Phaser.Math.Vector2(scaleX(90), scaleY(300)),
      new Phaser.Math.Vector2(scaleX(90), scaleY(340)),
      new Phaser.Math.Vector2(scaleX(220), scaleY(340)),
      new Phaser.Math.Vector2(scaleX(220), scaleY(300))
    ];
    const guardSpeed = diff.l1.guardSpeed * scale(1);
    this.guards = [
      new Guard(this, scaleX(520), scaleY(60), waypoints, guardSpeed),
      new Guard(this, scaleX(100), scaleY(320), waypoints2, guardSpeed)
    ];
    this.guardFovs = this.guards.map(() => this.add.graphics());
    this.guards.forEach((guard) => {
      guard.body.allowGravity = false;
      this.physics.add.collider(guard, obstacles);
    });

    this.spawnCv();
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updateTopDown(this.inputManager, scale(120));
    this.guards.forEach((guard) => guard.update());
    this.recruiters.forEach((recruiter) => recruiter.update(delta));
    this.npcs.forEach((npc) => npc.update(delta));
    this.checkGuardDetection(delta);

    const pickupPressed = this.inputManager.justPressedPickup() || this.inputManager.justPressedConfirm();
    const pickedUp = pickupPressed ? this.tryPickupCvOrTrash() : false;

    if (!pickedUp && this.inputManager.justPressedConfirm()) {
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
      if (dist < scale(26) && dist < bestDist) {
        bestDist = dist;
        best = recruiter;
      }
    }
    return best;
  }

  private tryRecruiterInteraction(recruiter: Recruiter): void {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
    if (dist > scale(30)) {
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
      this.placeCvInTrash();
    }
  }

  private spawnCv(): void {
    this.cvItem?.destroy();
    this.cvLabel?.destroy();
    this.cvItem = this.physics.add.staticImage(this.cvStartX, this.cvStartY, "cv");
    this.cvItem.setScale(scale(12) / 12);
    this.cvItem.refreshBody();
    this.cvLabel = createDialogText(this, this.cvStartX + scaleX(18), this.cvStartY, "Pick up CV", {
      maxWidth: 120,
      fontSize: 12,
      color: "#e8eef2",
      align: "left",
      originX: 0
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
    this.audio.playSfx("sfx-success", 0.4);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(10), "CV COLLECTED", "#8fe388");
  }

  private tryPickupCvOrTrash(): boolean {
    if (this.hasCV) {
      return false;
    }
    if (this.cvItem && this.isNear(this.cvItem.x, this.cvItem.y, scale(26))) {
      this.pickupCv();
      return true;
    }
    const bin = this.getNearestFullTrash();
    if (bin && this.isNear(bin.sprite.x, bin.sprite.y, scale(26))) {
      this.takeCvFromTrash(bin);
      return true;
    }
    return false;
  }

  private getNearestFullTrash(): { sprite: Phaser.Physics.Arcade.Image; full: boolean } | null {
    let best: { sprite: Phaser.Physics.Arcade.Image; full: boolean } | null = null;
    let bestDist = 9999;
    for (const bin of this.trashBins) {
      if (!bin.full) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bin.sprite.x, bin.sprite.y);
      if (dist < scale(32) && dist < bestDist) {
        bestDist = dist;
        best = bin;
      }
    }
    return best;
  }

  private takeCvFromTrash(bin: { sprite: Phaser.Physics.Arcade.Image; full: boolean }): void {
    if (this.hasCV) {
      return;
    }
    bin.full = false;
    bin.sprite.setTexture("trash-empty");
    this.hasCV = true;
    this.player.setCarrying(true);
    this.audio.playSfx("sfx-success", 0.4);
    FloatingText.spawn(this, this.player.x, this.player.y - scale(10), "CV RECOVERED", "#8fe388");
  }

  private placeCvInTrash(): void {
    const emptyBin = this.trashBins.find((bin) => !bin.full);
    const target = emptyBin ?? this.trashBins[0];
    if (!target) {
      return;
    }
    target.full = true;
    target.sprite.setTexture("trash-full");
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
    const bubble = this.add.image(scaleX(320), scaleY(300), "speech_bubble");
    bubble.setScale(getUiScale());
    const label = createDialogText(this, scaleX(320), scaleY(300), text, {
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
    const range = scale(130);
    const fovRad = Phaser.Math.DegToRad(diff.l1.guardFovDeg);
    let inCone = false;
    this.guards.forEach((guard, index) => {
      const facing = guard.getFacingAngle();
      const angleToPlayer = Phaser.Math.Angle.Between(guard.x, guard.y, this.player.x, this.player.y);
      const dist = Phaser.Math.Distance.Between(guard.x, guard.y, this.player.x, this.player.y);
      const angleDiff = Phaser.Math.Angle.Wrap(angleToPlayer - facing);
      const guardSees = dist < range && Math.abs(angleDiff) < fovRad / 2;
      if (guardSees) {
        inCone = true;
      }
      this.drawGuardFov(this.guardFovs[index], guard, range, fovRad, facing);
    });

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
        this.player.setPosition(scaleX(60), scaleY(320));
      });
      FloatingText.spawn(this, this.player.x, this.player.y - scale(10), "-1 HEART", "#ff6b6b");
    }

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
    const left = facing - fovRad / 2;
    const right = facing + fovRad / 2;
    const p1 = new Phaser.Math.Vector2(guard.x, guard.y);
    const p2 = new Phaser.Math.Vector2(guard.x + Math.cos(left) * range, guard.y + Math.sin(left) * range);
    const p3 = new Phaser.Math.Vector2(guard.x + Math.cos(right) * range, guard.y + Math.sin(right) * range);

    graphics.clear();
    graphics.fillStyle(0xff4d4d, 0.18);
    graphics.beginPath();
    graphics.moveTo(p1.x, p1.y);
    graphics.lineTo(p2.x, p2.y);
    graphics.lineTo(p3.x, p3.y);
    graphics.closePath();
    graphics.fillPath();
  }

  private completeLevel(): void {
    this.scoreSystem.addBase(1000);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(300);
    }
    this.scoreSystem.applyTimeBonus(60000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, scaleX(320), scaleY(120), "+1000", "#8fe388");
    this.hud.updateAll();

    this.time.delayedCall(1200, () => {
      this.scene.start("Level2Scene");
    });
  }
}

import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Recruiter } from "../entities/recruiter/Recruiter";
import { Guard } from "../entities/guard/Guard";
import { Npc } from "../entities/npc/Npc";
import { difficultyPresets } from "../../config/difficulty";
import { AUDIO, DOM_TEXT, FLOATING_TEXT, LEVEL1, MATH, PLAYER, RUN, STAGE } from "../../config/physics";
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
  private cvStartX = LEVEL1.CV_START.x;
  private cvStartY = LEVEL1.CV_START.y;
  private trashBins: { sprite: Phaser.Physics.Arcade.Image; full: boolean }[] = [];

  constructor() {
    super("Level1Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL1);
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL1.WORLD_GRAVITY_Y;
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, LEVEL1.BG_COLOR);
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

    const obstacles = this.physics.add.staticGroup();
    const boothHeight = BASE_HEIGHT * LEVEL1.BOOTH_HEIGHT_RATIO;
    const booths = LEVEL1.BOOTHS.map((pos) =>
      obstacles.create(scaleX(pos.x), scaleY(pos.y), pos.texture) as Phaser.Physics.Arcade.Image
    );
    booths.forEach((booth) => {
      scaleSpriteToHeight(booth, boothHeight);
      booth.refreshBody();
    });

    const trashGroup = this.physics.add.staticGroup();
    const trashHeight = BASE_HEIGHT * LEVEL1.TRASH_HEIGHT_RATIO;
    this.trashBins = LEVEL1.TRASH_POSITIONS.map((pos) => {
      const x = scaleX(pos.x);
      const y = scaleY(pos.y);
      const sprite = trashGroup.create(x, y, "trash-empty") as Phaser.Physics.Arcade.Image;
      scaleSpriteToHeight(sprite, trashHeight);
      sprite.refreshBody();
      return { sprite, full: false };
    });

    this.player = new Player(this, scaleX(LEVEL1.PLAYER_START.x), scaleY(LEVEL1.PLAYER_START.y));
    this.player.body.allowGravity = false;
    this.player.setCarrying(false);
    this.player.setCarryStyle("cv");
    this.setPlayer(this.player);

    this.cvStartX = scaleX(LEVEL1.CV_START.x);
    this.cvStartY = scaleY(LEVEL1.CV_START.y);

    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.player, trashGroup);

    const tags = ["Cloudify", "DataNinjas", "PixelSoft", "LambdaLab", "SprintWorks", "StackLion", "ByteForge", "NodeWave", "Signal42", "BrightAI"];
    const diff = difficultyPresets[runState.difficulty];
    const hrCount = LEVEL1.RECRUITER_COUNT;
    const npcCount = LEVEL1.NPC_COUNT;
    for (let i = 0; i < hrCount; i += 1) {
      const x = rngInt(scaleX(LEVEL1.SPAWN_MIN_X), scaleX(LEVEL1.SPAWN_MAX_X));
      const y = rngInt(scaleY(LEVEL1.SPAWN_MIN_Y), scaleY(LEVEL1.SPAWN_MAX_Y));
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
      const x = rngInt(scaleX(LEVEL1.SPAWN_MIN_X), scaleX(LEVEL1.SPAWN_MAX_X));
      const y = rngInt(scaleY(LEVEL1.SPAWN_MIN_Y), scaleY(LEVEL1.SPAWN_MAX_Y));
      const variant = ((i % LEVEL1.NPC_VARIANT_COUNT) + LEVEL1.NPC_VARIANT_MIN) as 1 | 2 | 3;
      const npc = new Npc(this, x, y, variant);
      npc.body.allowGravity = false;
      this.npcs.push(npc);
      this.physics.add.collider(npc, obstacles);
      this.physics.add.collider(npc, trashGroup);
      this.physics.add.collider(this.player, npc);
    }

    this.targetRecruiterId = rngInt(0, this.recruiters.length - 1);
    this.targetCompany = this.recruiters[this.targetRecruiterId].companyTag;
    this.recruiters[this.targetRecruiterId].setTint(LEVEL1.TARGET_TINT);

    const notice = this.add.image(scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), "notice_board");
    notice.setScale(getUiScale());
    createDialogText(this, scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), `Target: ${this.targetCompany}`, {
      maxWidth: LEVEL1.NOTICE_MAX_WIDTH,
      fontSize: LEVEL1.NOTICE_FONT_SIZE,
      color: "#e8eef2"
    });

    const waypoints = LEVEL1.WAYPOINTS_1.map((pos) => new Phaser.Math.Vector2(scaleX(pos.x), scaleY(pos.y)));
    const waypoints2 = LEVEL1.WAYPOINTS_2.map((pos) => new Phaser.Math.Vector2(scaleX(pos.x), scaleY(pos.y)));
    const guardSpeed = scale(diff.l1.guardSpeed);
    this.guards = [
      new Guard(this, scaleX(LEVEL1.GUARD_STARTS[0].x), scaleY(LEVEL1.GUARD_STARTS[0].y), waypoints, guardSpeed),
      new Guard(this, scaleX(LEVEL1.GUARD_STARTS[1].x), scaleY(LEVEL1.GUARD_STARTS[1].y), waypoints2, guardSpeed)
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
    this.player.updateTopDown(this.inputManager, scale(PLAYER.TOPDOWN_SPEED));
    this.guards.forEach((guard) => guard.update());
    this.recruiters.forEach((recruiter) => recruiter.update(delta));
    this.npcs.forEach((npc) => npc.update(delta));
    this.checkGuardDetection(delta);

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

  private getNearestRecruiter(): Recruiter | null {
    let best: Recruiter | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const recruiter of this.recruiters) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
      if (dist < scale(LEVEL1.NEAR_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = recruiter;
      }
    }
    return best;
  }

  private tryRecruiterInteraction(recruiter: Recruiter): void {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
    if (dist > scale(LEVEL1.RECRUITER_INTERACT_RANGE)) {
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

  private getNearestFullTrash(): { sprite: Phaser.Physics.Arcade.Image; full: boolean } | null {
    let best: { sprite: Phaser.Physics.Arcade.Image; full: boolean } | null = null;
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

  private takeCvFromTrash(bin: { sprite: Phaser.Physics.Arcade.Image; full: boolean }): void {
    if (this.hasCV) {
      return;
    }
    bin.full = false;
    bin.sprite.setTexture("trash-empty");
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
      this.scoreSystem.addPenalty(LEVEL1.DETECTION_PENALTY);
      this.scoreSystem.breakCombo();
      this.applyDamage(() => {
        this.player.setPosition(scaleX(LEVEL1.PLAYER_START.x), scaleY(LEVEL1.PLAYER_START.y));
      });
      FloatingText.spawn(this, this.player.x, this.player.y - scale(FLOATING_TEXT.START_OFFSET_SMALL), "-1 HEART", "#ff6b6b");
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
    graphics.fillStyle(LEVEL1.FOV_COLOR, LEVEL1.FOV_ALPHA);
    graphics.beginPath();
    graphics.moveTo(p1.x, p1.y);
    graphics.lineTo(p2.x, p2.y);
    graphics.lineTo(p3.x, p3.y);
    graphics.closePath();
    graphics.fillPath();
  }

  private completeLevel(): void {
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

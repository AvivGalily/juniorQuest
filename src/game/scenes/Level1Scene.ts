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
import { createDialogText, setDomText } from "../utils/domText";
import { BASE_HEIGHT, getUiScale } from "../utils/resolution";
import { scale, scaleX, scaleY } from "../utils/layout";
import { scaleSpriteToHeight } from "../utils/spriteScale";

type RecruiterState = {
  recruiter: Recruiter;
  npcCvCount: number;
  leaving: boolean;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  barLabel: Phaser.GameObjects.DOMElement;
};

type NpcCourierState = {
  npc: Npc;
  target?: RecruiterState;
  deliveryCooldownMs: number;
  deliveredRecruiters: Set<RecruiterState>;
};

type Level1RestartData = {
  heartsOverride?: number;
};

export class Level1Scene extends BaseLevelScene {
  private player!: Player;
  private guards: Guard[] = [];
  private guardFovs: Phaser.GameObjects.Graphics[] = [];
  private recruiterStates: RecruiterState[] = [];
  private npcCouriers: NpcCourierState[] = [];
  private targetRecruiter?: Recruiter;
  private targetCompany = "";
  private targetNoticeText?: Phaser.GameObjects.DOMElement;
  private detectionTimer = 0;
  private dialog?: { bubble: Phaser.GameObjects.Image; label: Phaser.GameObjects.DOMElement };
  private wrongInteractions = 0;
  private hasCV = false;
  private levelCompleted = false;
  private allRecruitersGoneHandled = false;
  private cvItem?: Phaser.Physics.Arcade.Image;
  private cvLabel?: Phaser.GameObjects.DOMElement;
  private cvStartX = LEVEL1.CV_START.x;
  private cvStartY = LEVEL1.CV_START.y;
  private trashBins: { sprite: Phaser.Physics.Arcade.Image; full: boolean }[] = [];

  constructor() {
    super("Level1Scene");
  }

  create(data?: Level1RestartData): void {
    this.initLevel(STAGE.LEVEL1);
    if (typeof data?.heartsOverride === "number") {
      runState.hearts = data.heartsOverride;
      this.hud.updateAll();
    }
    this.allRecruitersGoneHandled = false;
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL1.WORLD_GRAVITY_Y;
    this.add.image(this.scale.width / 2, this.scale.height / 2, "job-fair-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      LEVEL1.BG_COLOR,
      LEVEL1.BG_OVERLAY_ALPHA
    );
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
      const sprite = trashGroup.create(x, y, "trash-empty-crisp") as Phaser.Physics.Arcade.Image;
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
      this.recruiterStates.push(this.createRecruiterState(recruiter));
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
      this.npcCouriers.push({
        npc,
        deliveryCooldownMs: 0,
        deliveredRecruiters: new Set<RecruiterState>()
      });
      this.physics.add.collider(npc, obstacles);
      this.physics.add.collider(npc, trashGroup);
      this.physics.add.collider(this.player, npc);
    }

    const notice = this.add.image(scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), "notice_board");
    notice.setScale(getUiScale());
    this.targetNoticeText = createDialogText(this, scaleX(LEVEL1.NOTICE_X), scaleY(LEVEL1.NOTICE_Y), "", {
      maxWidth: LEVEL1.NOTICE_MAX_WIDTH,
      fontSize: LEVEL1.NOTICE_FONT_SIZE,
      color: "#e8eef2"
    });
    const initialTarget = rngPick(this.getActiveRecruiterStates());
    this.setTargetRecruiter(initialTarget?.recruiter);

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
    this.recruiterStates.forEach((state) => {
      if (!state.leaving && state.recruiter.active) {
        state.recruiter.update(delta);
      }
    });
    this.updateNpcCouriers(delta);
    this.updateRecruiterBars();
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

  private createRecruiterState(recruiter: Recruiter): RecruiterState {
    const barWidth = scaleX(LEVEL1.RECRUITER_BAR_WIDTH);
    const barHeight = Math.max(2, scaleY(LEVEL1.RECRUITER_BAR_HEIGHT));
    const barY = recruiter.y - scaleY(LEVEL1.RECRUITER_BAR_OFFSET_Y);

    const barBg = this.add
      .rectangle(recruiter.x, barY, barWidth, barHeight, LEVEL1.RECRUITER_BAR_BG_COLOR, 0.9)
      .setDepth(20);
    const barFill = this.add
      .rectangle(
        recruiter.x - barWidth / 2,
        barY,
        barWidth,
        Math.max(2, barHeight - 2),
        LEVEL1.RECRUITER_BAR_FILL_COLOR,
        1
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(21);
    const barLabel = createDialogText(
      this,
      recruiter.x,
      barY - scaleY(LEVEL1.RECRUITER_BAR_LABEL_OFFSET_Y),
      `0/${LEVEL1.RECRUITER_NPC_CV_GOAL}`,
      {
        maxWidth: LEVEL1.RECRUITER_BAR_WIDTH + 30,
        fontSize: 11,
        color: "#e8eef2"
      }
    ).setDepth(22);

    return {
      recruiter,
      npcCvCount: 0,
      leaving: false,
      barBg,
      barFill,
      barLabel
    };
  }

  private updateRecruiterBars(): void {
    const barWidth = scaleX(LEVEL1.RECRUITER_BAR_WIDTH);
    const barYOffset = scaleY(LEVEL1.RECRUITER_BAR_OFFSET_Y);
    const labelYOffset = scaleY(LEVEL1.RECRUITER_BAR_LABEL_OFFSET_Y);
    for (const state of this.recruiterStates) {
      if (!state.recruiter.active) {
        continue;
      }
      const x = state.recruiter.x;
      const y = state.recruiter.y - barYOffset;
      const ratio = Phaser.Math.Clamp(state.npcCvCount / LEVEL1.RECRUITER_NPC_CV_GOAL, 0, 1);
      state.barBg.setPosition(x, y);
      state.barFill.setPosition(x - barWidth / 2, y);
      state.barFill.setScale(ratio, 1);
      state.barFill.setVisible(ratio > 0);
      state.barLabel.setPosition(x, y - labelYOffset);
      setDomText(state.barLabel, `${state.npcCvCount}/${LEVEL1.RECRUITER_NPC_CV_GOAL}`);
    }
  }

  private updateNpcCouriers(delta: number): void {
    const activeRecruiters = this.getActiveRecruiterStates();
    for (const courier of this.npcCouriers) {
      if (!courier.npc.active) {
        continue;
      }

      courier.deliveryCooldownMs = Math.max(0, courier.deliveryCooldownMs - delta);
      if (courier.deliveryCooldownMs > 0) {
        courier.target = undefined;
        courier.npc.clearMoveTarget();
        courier.npc.setVelocity(0, 0);
        continue;
      }

      if (!courier.target || courier.target.leaving || !courier.target.recruiter.active) {
        courier.target = this.pickNpcTarget(courier, activeRecruiters);
      }

      if (courier.target) {
        const target = courier.target.recruiter;
        courier.npc.setMoveTarget(target.x, target.y);
        const dist = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, target.x, target.y);
        if (dist <= scale(LEVEL1.NPC_DELIVERY_RANGE) && courier.deliveryCooldownMs <= 0) {
          this.handleNpcDelivery(courier, courier.target);
        }
      } else {
        courier.npc.clearMoveTarget();
      }

      courier.npc.update(delta);
    }
  }

  private pickNpcTarget(courier: NpcCourierState, candidates: RecruiterState[]): RecruiterState | undefined {
    const openTargets = candidates.filter(
      (state) =>
        !state.leaving &&
        state.recruiter.active &&
        state.npcCvCount < LEVEL1.RECRUITER_NPC_CV_GOAL &&
        !courier.deliveredRecruiters.has(state)
    );
    if (openTargets.length === 0) {
      return undefined;
    }
    return openTargets.sort((a, b) => {
      if (a.npcCvCount !== b.npcCvCount) {
        return a.npcCvCount - b.npcCvCount;
      }
      const distA = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, a.recruiter.x, a.recruiter.y);
      const distB = Phaser.Math.Distance.Between(courier.npc.x, courier.npc.y, b.recruiter.x, b.recruiter.y);
      return distA - distB;
    })[0];
  }

  private handleNpcDelivery(courier: NpcCourierState, state: RecruiterState): void {
    if (state.leaving || !state.recruiter.active) {
      return;
    }
    state.npcCvCount += 1;
    courier.deliveryCooldownMs = LEVEL1.NPC_POST_DELIVERY_WAIT_MS;
    courier.deliveredRecruiters.add(state);
    courier.target = undefined;
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);

    if (state.npcCvCount >= LEVEL1.RECRUITER_NPC_CV_GOAL) {
      this.retireRecruiter(state);
    }
  }

  private retireRecruiter(state: RecruiterState): void {
    if (state.leaving || !state.recruiter.active) {
      return;
    }
    state.leaving = true;
    state.recruiter.disableInteractive();
    state.recruiter.setVelocity(0, 0);
    if (state.recruiter.body) {
      state.recruiter.body.enable = false;
    }

    this.npcCouriers.forEach((courier) => {
      if (courier.target === state) {
        courier.target = undefined;
      }
    });

    this.showRecruiterSpeech(state.recruiter, "Finished for today!");
    if (this.targetRecruiter === state.recruiter) {
      const nextTarget = rngPick(this.getActiveRecruiterStates());
      this.setTargetRecruiter(nextTarget?.recruiter);
      this.showDialog(
        nextTarget
          ? `Target moved to ${nextTarget.recruiter.companyTag}.`
          : "All recruiters are done for today. Bring CV faster."
      );
    }

    this.time.delayedCall(LEVEL1.RECRUITER_EXIT_DELAY_MS, () => {
      if (!state.recruiter.active) {
        return;
      }
      const exitX = state.recruiter.x < this.scale.width / 2 ? -state.recruiter.displayWidth : this.scale.width + state.recruiter.displayWidth;
      this.tweens.add({
        targets: state.recruiter,
        x: exitX,
        alpha: 0,
        duration: LEVEL1.RECRUITER_EXIT_DURATION_MS,
        ease: "Sine.easeIn",
        onComplete: () => {
          state.recruiter.destroy();
          state.barBg.destroy();
          state.barFill.destroy();
          state.barLabel.destroy();
          this.recruiterStates = this.recruiterStates.filter((entry) => entry !== state);
          if (this.recruiterStates.length === 0) {
            this.onAllRecruitersGone();
          }
        }
      });
    });
  }

  private showRecruiterSpeech(recruiter: Recruiter, text: string): void {
    const bubbleY = recruiter.y - scaleY(LEVEL1.RECRUITER_RETIRE_DIALOG_OFFSET_Y);
    const bubble = this.add.image(recruiter.x, bubbleY, "speech_bubble");
    bubble.setScale(getUiScale() * 0.8);
    const label = createDialogText(this, recruiter.x, bubbleY, text, {
      maxWidth: LEVEL1.DIALOG_MAX_WIDTH,
      fontSize: LEVEL1.DIALOG_FONT_SIZE - 1,
      color: "#1b1f24",
      padding: `${LEVEL1.DIALOG_PADDING_Y}px ${LEVEL1.DIALOG_PADDING_X}px`,
      align: "center"
    });
    this.time.delayedCall(LEVEL1.RECRUITER_RETIRE_DIALOG_DURATION_MS, () => {
      bubble.destroy();
      label.destroy();
    });
  }

  private getActiveRecruiterStates(): RecruiterState[] {
    return this.recruiterStates.filter((state) => !state.leaving && state.recruiter.active);
  }

  private getRecruiterState(recruiter: Recruiter): RecruiterState | undefined {
    return this.recruiterStates.find((state) => state.recruiter === recruiter);
  }

  private setTargetRecruiter(recruiter?: Recruiter): void {
    this.getActiveRecruiterStates().forEach((state) => state.recruiter.clearTint());
    this.targetRecruiter = recruiter;
    if (recruiter) {
      recruiter.setTint(LEVEL1.TARGET_TINT);
      this.targetCompany = recruiter.companyTag;
    } else {
      this.targetCompany = "None";
    }
    if (this.targetNoticeText) {
      setDomText(this.targetNoticeText, `Target: ${this.targetCompany}`);
    }
  }

  private onAllRecruitersGone(): void {
    if (this.levelCompleted || this.allRecruitersGoneHandled) {
      return;
    }
    this.allRecruitersGoneHandled = true;
    const nextHearts = runState.hearts - 1;
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    FloatingText.spawn(
      this,
      scaleX(LEVEL1.COMPLETE_TEXT_X),
      scaleY(LEVEL1.COMPLETE_TEXT_Y),
      "-1 HEART",
      "#ff6b6b"
    );

    if (nextHearts <= 0) {
      runState.hearts = 0;
      this.scene.start("GameOverScene");
      return;
    }

    this.time.delayedCall(LEVEL1.ALL_HR_GONE_RESTART_DELAY_MS, () => {
      this.scene.restart({ heartsOverride: nextHearts });
    });
  }

  private getNearestRecruiter(): Recruiter | null {
    let best: Recruiter | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const recruiter of this.getActiveRecruiterStates().map((state) => state.recruiter)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
      if (dist < scale(LEVEL1.NEAR_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = recruiter;
      }
    }
    return best;
  }

  private tryRecruiterInteraction(recruiter: Recruiter): void {
    const state = this.getRecruiterState(recruiter);
    if (!state || state.leaving || !recruiter.active) {
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruiter.x, recruiter.y);
    if (dist > scale(LEVEL1.RECRUITER_INTERACT_RANGE)) {
      return;
    }
    if (!this.targetRecruiter) {
      this.showDialog("No open target at the moment.");
      return;
    }
    if (!this.hasCV) {
      this.showDialog("Pick up your CV first.");
      return;
    }
    if (this.targetRecruiter === recruiter) {
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
    bin.sprite.setTexture("trash-empty-crisp");
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
    target.sprite.setTexture("trash-full-crisp");
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
    if (this.levelCompleted) {
      return;
    }
    this.levelCompleted = true;
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

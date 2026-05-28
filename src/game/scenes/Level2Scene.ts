import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { difficultyPresets } from "../../config/difficulty";
import { ALPHA, AUDIO, DEPTH, DOM_TEXT, LEVEL2, LEVEL2_SLOTS, MATH, PLAYER, SCALE, STAGE, TEXTURES, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { isDebug } from "../utils/debug";
import { rngInt } from "../utils/rng";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText, createTranslatedText, setDomText } from "../utils/domText";
import { t } from "../i18n/i18n";
import { scale, scaleX, scaleY } from "../utils/layout";

interface Slot {
  id: string;
  x: number;
  y: number;
  parent?: Slot;
  isLeft?: boolean;
  active?: boolean;
  value?: number;
  image: Phaser.GameObjects.Image;
  debugText?: Phaser.GameObjects.DOMElement;
}

interface LeafToken {
  container: Phaser.GameObjects.Container;
  value: number;
  placed: boolean;
  startX: number;
  startY: number;
  label?: Phaser.GameObjects.DOMElement;
  standPlatform?: Phaser.Physics.Arcade.Image;
  slot?: Slot;
}

interface PlacementValidation {
  valid: boolean;
  reason?: string;
  min?: number;
  max?: number;
}

export class Level2Scene extends BaseLevelScene {
  declare protected player: Player;
  private slots: Slot[] = [];
  private placedCount = 0;
  private requiredPlacements: number = LEVEL2.DEFAULT_REQUIRED_PLACEMENTS;
  private leaves: LeafToken[] = [];
  private carriedLeaf?: LeafToken;
  private rowY = scaleY(LEVEL2.ROW_Y);
  private pileText?: Phaser.GameObjects.DOMElement;
  private rangeHint?: Phaser.GameObjects.DOMElement;
  private feedbackText?: Phaser.GameObjects.DOMElement;
  private submitLabel?: Phaser.GameObjects.DOMElement;
  private submitButton?: Phaser.GameObjects.Graphics;
  private submitZone?: Phaser.GameObjects.Zone;
  private branchGraphics?: Phaser.GameObjects.Graphics;
  private pathGraphics?: Phaser.GameObjects.Graphics;
  private clockFace?: Phaser.GameObjects.Graphics;
  private clockHands?: Phaser.GameObjects.Graphics;
  private clockText?: Phaser.GameObjects.DOMElement;
  private clockCenterX = scaleX(LEVEL2.CLOCK_CENTER_X);
  private clockCenterY = scaleY(LEVEL2.CLOCK_CENTER_Y);
  private clockRadius = scale(LEVEL2.CLOCK_RADIUS);
  private timeLimitMs: number = LEVEL2.TIME_LIMIT_MS;
  private timeLeftMs: number = LEVEL2.TIME_LIMIT_MS;
  private leafPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private obstacleGroup?: Phaser.Physics.Arcade.Group;
  private bugTimer?: Phaser.Time.TimerEvent;
  private nullTimer?: Phaser.Time.TimerEvent;
  private sideBugTimer?: Phaser.Time.TimerEvent;
  private nextSideBugFromLeft = true;
  private levelCompleted = false;
  private transitionStarted = false;
  private transitionFallbackId?: number;
  private gameOverFallbackId?: number;
  private mistakeCountAtStart = 0;
  private obstacleSpeedMultiplier = 1;
  private elapsedScoreMs = 0;

  constructor() {
    super("Level2Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL2);
    this.resetLevel2SceneState();
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL2.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.addBackground();

    const diff = difficultyPresets[runState.difficulty];
    this.requiredPlacements = Math.min(diff.l2.requiredPlacements, LEVEL2_SLOTS.length);
    this.timeLimitMs = diff.l2.timeLimitMs;
    this.obstacleSpeedMultiplier = 1;
    this.timeLeftMs = this.timeLimitMs;
    this.elapsedScoreMs = runState.level2ElapsedMs;
    this.mistakeCountAtStart = runState.mistakes;
    this.nextSideBugFromLeft = Phaser.Math.Between(0, 1) === 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.createSlots();
    const leafValues = this.assignTargetValues(this.requiredPlacements);

    this.player = new Player(this, scaleX(LEVEL2.PLAYER_START.x), scaleY(LEVEL2.PLAYER_START.y));
    this.player.setDepth(DEPTH.LEVEL2_PLAYER);
    this.setPlayer(this.player);

    const platforms = this.createPlatforms();
    this.leafPlatforms = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, platforms);

    createTranslatedText(this, scaleX(LEVEL2.TITLE_X), scaleY(LEVEL2.TITLE_Y), "level2.title", {
      maxWidth: LEVEL2.TITLE_MAX_WIDTH,
      fontSize: LEVEL2.TITLE_FONT_SIZE,
      color: "#f6f7d7"
    });

    this.createLeafRow(leafValues);
    this.createSubmitButton();
    this.createFeedbackText();
    this.createRangeHint();
    this.createClock();
    this.createObstacles();
    this.spawnSideBug();
    this.time.delayedCall(LEVEL2.NULL_INITIAL_DELAY_MS, () => this.spawnNullPointer());
  }

  private resetLevel2SceneState(): void {
    if (this.transitionFallbackId !== undefined) {
      window.clearTimeout(this.transitionFallbackId);
      this.transitionFallbackId = undefined;
    }
    if (this.gameOverFallbackId !== undefined) {
      window.clearTimeout(this.gameOverFallbackId);
      this.gameOverFallbackId = undefined;
    }
    this.slots = [];
    this.placedCount = 0;
    this.requiredPlacements = LEVEL2.DEFAULT_REQUIRED_PLACEMENTS;
    this.timeLimitMs = LEVEL2.TIME_LIMIT_MS;
    this.leaves = [];
    this.carriedLeaf = undefined;
    this.pileText = undefined;
    this.rangeHint = undefined;
    this.feedbackText = undefined;
    this.submitLabel = undefined;
    this.submitButton = undefined;
    this.submitZone = undefined;
    this.branchGraphics = undefined;
    this.pathGraphics = undefined;
    this.clockFace = undefined;
    this.clockHands = undefined;
    this.clockText = undefined;
    this.obstacleGroup = undefined;
    this.bugTimer = undefined;
    this.nullTimer = undefined;
    this.sideBugTimer = undefined;
    this.nextSideBugFromLeft = true;
    this.levelCompleted = false;
    this.transitionStarted = false;
    this.mistakeCountAtStart = 0;
    this.obstacleSpeedMultiplier = 1;
    this.elapsedScoreMs = 0;
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused || this.levelCompleted) {
      return;
    }

    this.player.setDepth(DEPTH.LEVEL2_PLAYER);
    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED), scale(PLAYER.JUMP_L2));
    this.updateCarriedLeaf();
    this.syncLeafLabels();
    this.updateRangeHint();

    if (this.inputManager.justPressedPickup()) {
      if (this.carriedLeaf) {
        this.tryPlaceCarried();
      } else if (this.isPlayerNearSubmitButton()) {
        this.animateSubmitButton();
        this.trySubmitTree();
      } else {
        this.tryPickupLeaf();
      }
    }

    this.updateObstacles();
    this.updateClock(delta);
    this.hud.updateAll();
    if (isDebug()) {
      this.updateDebugConstraints();
    }
  }

  private addBackground(): void {
    const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, "level2-bst-orchard-bg");
    bg.setDisplaySize(this.scale.width, this.scale.height);
    bg.setDepth(-30);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, LEVEL2.BG_COLOR, 0.08).setDepth(-29);
    this.addLevel2BackgroundPolish();
  }

  private addLevel2BackgroundPolish(): void {
    const g = this.add.graphics().setDepth(-28);
    g.fillStyle(0x0f172a, 0.28);
    g.fillRoundedRect(scaleX(35), scaleY(25), scaleX(570), scaleY(314), scale(8));
    g.lineStyle(scale(2), 0xffffff, 0.1);
    g.strokeRoundedRect(scaleX(35), scaleY(25), scaleX(570), scaleY(314), scale(8));

    g.fillStyle(0x38bdf8, 0.06);
    g.fillRoundedRect(scaleX(74), scaleY(54), scaleX(492), scaleY(36), scale(5));
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(scaleX(104), scaleY(70), scaleX(432), scaleY(4), scale(2));
    g.fillRoundedRect(scaleX(78), scaleY(294), scaleX(484), scaleY(5), scale(3));

    for (const x of [78, 488]) {
      g.fillStyle(0x102332, 0.72);
      g.fillRoundedRect(scaleX(x), scaleY(104), scaleX(74), scaleY(82), scale(5));
      g.lineStyle(scale(1), 0x38bdf8, 0.22);
      g.strokeRoundedRect(scaleX(x), scaleY(104), scaleX(74), scaleY(82), scale(5));
      g.fillStyle(0xfacc15, 0.7);
      g.fillCircle(scaleX(x + 14), scaleY(122), scale(3));
      g.fillStyle(0x22c55e, 0.58);
      g.fillCircle(scaleX(x + 28), scaleY(122), scale(3));
      g.lineStyle(scale(2), 0x8fe388, 0.26);
      for (let i = 0; i < 4; i += 1) {
        g.lineBetween(scaleX(x + 14), scaleY(142 + i * 10), scaleX(x + 60), scaleY(142 + i * 10));
      }
    }

    g.lineStyle(scale(2), 0xffd166, 0.18);
    for (let i = 0; i < 5; i += 1) {
      const y = scaleY(112 + i * 38);
      g.lineBetween(scaleX(72), y, scaleX(568), y);
    }
    g.fillStyle(0x2dd4bf, 0.1);
    g.fillRoundedRect(scaleX(82), scaleY(306), scaleX(476), scaleY(18), scale(5));
  }

  private createPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();
    const ground = platforms
      .create(scaleX(LEVEL2.GROUND_X), scaleY(LEVEL2.GROUND_Y), "platform-smooth")
      .setScale(
        (LEVEL2.GROUND_SCALE_X * scaleX(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE,
        (LEVEL2.GROUND_SCALE_Y * scaleY(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE
      )
      .refreshBody();
    (ground as Phaser.Physics.Arcade.Image).setDepth(DEPTH.LEVEL2_STAIRS);
    this.configureTopOnlyPlatform(ground as Phaser.Physics.Arcade.Image);
    this.shrinkPlatformBody(ground as Phaser.Physics.Arcade.Image, 0.98);

    const shelfYs = LEVEL2.SHELF_YS.map(scaleY);
    const shelfXs = LEVEL2.SHELF_XS.map(scaleX);
    for (const y of shelfYs) {
      for (const x of shelfXs) {
        const shelf = platforms
          .create(x, y, "platform-smooth")
          .setScale(
            (LEVEL2.SHELF_SCALE_X * scaleX(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE,
            (LEVEL2.SHELF_SCALE_Y * scaleY(SCALE.UNIT)) / TEXTURES.HIGH_RES_SCALE
          )
          .refreshBody();
        (shelf as Phaser.Physics.Arcade.Image).setDepth(DEPTH.LEVEL2_STAIRS);
        shelf.setAlpha(0.72);
        this.configureTopOnlyPlatform(shelf as Phaser.Physics.Arcade.Image);
        this.shrinkPlatformBody(shelf as Phaser.Physics.Arcade.Image, LEVEL2.PLATFORM_BODY_WIDTH_RATIO);
      }
    }
    this.addLevel2AccessRails();
    return platforms;
  }

  private addLevel2AccessRails(): void {
    const rails = this.add.graphics().setDepth(DEPTH.LEVEL2_STAIRS + 1);
    rails.lineStyle(scale(5), 0x475569, 0.82);
    rails.lineBetween(scaleX(184), scaleY(136), scaleX(184), scaleY(286));
    rails.lineBetween(scaleX(196), scaleY(136), scaleX(196), scaleY(286));
    rails.lineBetween(scaleX(444), scaleY(136), scaleX(444), scaleY(286));
    rails.lineBetween(scaleX(456), scaleY(136), scaleX(456), scaleY(286));
    rails.lineStyle(scale(2), 0xe2e8f0, 0.42);
    for (const x of [190, 450]) {
      for (const y of LEVEL2.SHELF_YS) {
        rails.lineBetween(scaleX(x - 15), scaleY(y), scaleX(x + 15), scaleY(y));
      }
    }
    rails.fillStyle(0xffd166, 0.66);
    for (const x of [190, 450]) {
      rails.fillCircle(scaleX(x), scaleY(136), scale(4));
      rails.fillCircle(scaleX(x), scaleY(286), scale(4));
    }
  }

  private createSlots(): void {
    this.branchGraphics = this.add.graphics().setDepth(DEPTH.LEVEL2_BRANCH);
    this.pathGraphics = this.add.graphics().setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    const makeSlot = (id: string, x: number, y: number, parent?: Slot, isLeft?: boolean): Slot => {
      const sx = scaleX(x);
      const sy = scaleY(y);
      const image = this.add.image(sx, sy, "leaf-slot-smooth").setDepth(DEPTH.LEVEL2_SLOT);
      image.setScale(scale(LEVEL2.LEAF_SLOT_SIZE) / (LEVEL2.LEAF_SLOT_SIZE * TEXTURES.HIGH_RES_SCALE));
      const slot: Slot = { id, x: sx, y: sy, parent, isLeft, image };
      if (isDebug()) {
        slot.debugText = createDialogText(this, sx, sy - scale(LEVEL2.SLOT_DEBUG_OFFSET_Y), "", {
          maxWidth: LEVEL2.SLOT_DEBUG_MAX_WIDTH,
          fontSize: LEVEL2.SLOT_DEBUG_FONT_SIZE,
          color: "#8fe388",
          align: "center",
          direction: "ltr"
        }).setDepth(DEPTH.LEVEL2_SLOT_HINT);
      }
      this.slots.push(slot);
      return slot;
    };

    const slotMap = new Map<string, Slot>();
    for (const def of LEVEL2_SLOTS) {
      const parent = def.parent ? slotMap.get(def.parent) : undefined;
      const slot = makeSlot(def.id, def.x, def.y, parent, def.isLeft);
      slotMap.set(def.id, slot);
    }
  }

  private assignTargetValues(count: number): number[] {
    for (const slot of this.slots) {
      slot.active = false;
      slot.value = undefined;
    }

    const slotsToUse = this.slots;
    for (const slot of slotsToUse) {
      slot.active = true;
    }
    this.updateSlotVisibility();
    this.drawTreeBranches();

    const values = new Set<number>();
    while (values.size < Math.min(count, this.slots.length)) {
      values.add(rngInt(LEVEL2.VALUE_MIN, LEVEL2.VALUE_MAX));
    }
    return this.shuffle([...values]);
  }

  private updateSlotVisibility(): void {
    for (const slot of this.slots) {
      const visible = Boolean(slot.active);
      slot.image.setVisible(visible);
      slot.debugText?.setVisible(visible);
      slot.image.setAlpha(slot.value === undefined ? 0.86 : 0.38);
    }
  }

  private drawTreeBranches(): void {
    if (!this.branchGraphics) {
      return;
    }
    this.branchGraphics.clear();
    this.branchGraphics.lineStyle(scale(6), 0x3f2d1f, 0.76);
    for (const slot of this.slots) {
      if (!slot.active || !slot.parent?.active) {
        continue;
      }
      this.branchGraphics.lineBetween(slot.parent.x, slot.parent.y, slot.x, slot.y);
    }
    this.branchGraphics.lineStyle(scale(2), 0x9ddf8f, 0.32);
    for (const slot of this.slots) {
      if (!slot.active || !slot.parent?.active) {
        continue;
      }
      this.branchGraphics.lineBetween(slot.parent.x, slot.parent.y, slot.x, slot.y);
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
  }

  private shrinkPlatformBody(platform: Phaser.Physics.Arcade.Image, widthRatio: number): void {
    const body = platform.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (!body) {
      return;
    }
    const width = Math.max(8, platform.displayWidth * widthRatio);
    const height = Math.max(4, platform.displayHeight * LEVEL2.PLATFORM_BODY_HEIGHT_RATIO);
    body.updateFromGameObject();
    body.setSize(width, height);
    body.setOffset((platform.displayWidth - width) / 2, platform.displayHeight - height);
  }

  private shuffle(values: number[]): number[] {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = rngInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private createLeafRow(values: number[]): void {
    const spacing = scaleX(LEVEL2.ROW_SPACING);
    const count = values.length;
    const totalWidth = (count - 1) * spacing;
    const startX = scaleX(LEVEL2.ROW_CENTER_X) - totalWidth / 2;
    const rowY = this.rowY;

    for (let i = 0; i < count; i += 1) {
      const value = values[i];
      const x = startX + i * spacing;
      const leaf = this.createLeafContainer(value, x, rowY);
      this.leaves.push(leaf);
    }

    this.pileText = createTranslatedText(this, scaleX(LEVEL2.PILE_TEXT_X), rowY - scale(LEVEL2.PILE_TEXT_OFFSET_Y), "level2.leaves", {
      params: { count: 0 },
      maxWidth: LEVEL2.PILE_TEXT_MAX_WIDTH,
      fontSize: LEVEL2.PILE_TEXT_FONT_SIZE,
      color: "#f8fafc",
      align: "left",
      originX: DOM_TEXT.ORIGIN_LEFT
    });
    this.updatePileText();
  }

  private createLeafContainer(value: number, x: number, y: number): LeafToken {
    const container = this.add.container(x, y);
    const sprite = this.add.image(0, 0, "leaf-token-smooth");
    const leafScale = scale(LEVEL2.LEAF_SIZE) / (LEVEL2.LEAF_SIZE * TEXTURES.HIGH_RES_SCALE);
    sprite.setScale(leafScale);
    container.add(sprite);
    container.setSize(scale(LEVEL2.LEAF_SIZE), scale(LEVEL2.LEAF_SIZE));
    container.setDepth(DEPTH.LEVEL2_CUBE);
    const label = createDialogText(this, x, y, String(value), {
      maxWidth: LEVEL2.CUBE_LABEL_MAX_WIDTH,
      fontSize: LEVEL2.CUBE_LABEL_FONT_SIZE,
      color: "#142018",
      align: "center",
      direction: "ltr"
    }).setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    return { container, value, placed: false, startX: x, startY: y, label };
  }

  private createSubmitButton(): void {
    const x = scaleX(LEVEL2.SUBMIT_BUTTON_X);
    const y = scaleY(LEVEL2.SUBMIT_BUTTON_Y);
    const poleHeight = scaleY(LEVEL2.SUBMIT_POLE_HEIGHT);
    const radius = scale(LEVEL2.SUBMIT_BUTTON_RADIUS);

    this.submitButton = this.add.graphics().setDepth(DEPTH.LEVEL2_CLOCK_FACE);
    this.submitButton.lineStyle(scale(4), 0x1f2937, 1);
    this.submitButton.lineBetween(x, y, x, y - poleHeight);
    this.submitButton.fillStyle(0x334155, 1);
    this.submitButton.fillRoundedRect(x - scaleX(18), y - scaleY(5), scaleX(36), scaleY(10), scale(4));
    this.submitButton.fillStyle(0xef4444, 1);
    this.submitButton.fillCircle(x, y - poleHeight - radius * 0.18, radius);
    this.submitButton.lineStyle(scale(3), 0x7f1d1d, 1);
    this.submitButton.strokeCircle(x, y - poleHeight - radius * 0.18, radius);
    this.submitButton.fillStyle(0xfca5a5, 0.82);
    this.submitButton.fillCircle(x - radius * 0.35, y - poleHeight - radius * 0.5, radius * 0.28);

    this.submitZone = this.add
      .zone(x, y - poleHeight * 0.5, scaleX(76), poleHeight + radius * 2)
      .setInteractive({ useHandCursor: true });
    this.submitZone.on("pointerdown", () => {
      if (!this.carriedLeaf) {
        this.animateSubmitButton();
        this.trySubmitTree();
      }
    });

    this.submitLabel = createTranslatedText(this, x, y - poleHeight - scaleY(28), "level2.submit", {
      maxWidth: LEVEL2.SUBMIT_LABEL_MAX_WIDTH,
      fontSize: LEVEL2.SUBMIT_LABEL_FONT_SIZE,
      color: "#fecaca"
    }).setDepth(DEPTH.LEVEL2_CLOCK_TEXT);
  }

  private tryPressSubmitButton(): void {
    if (!this.isPlayerNearSubmitButton()) {
      this.showFeedback(t("level2.standNearSubmit"), "#facc15");
      return;
    }
    this.animateSubmitButton();
    this.trySubmitTree();
  }

  private isPlayerNearSubmitButton(): boolean {
    const x = scaleX(LEVEL2.SUBMIT_BUTTON_X);
    const y = scaleY(LEVEL2.SUBMIT_BUTTON_Y - LEVEL2.SUBMIT_POLE_HEIGHT * 0.55);
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= scale(LEVEL2.SUBMIT_BUTTON_RANGE);
  }

  private animateSubmitButton(): void {
    if (!this.submitButton) {
      return;
    }
    this.tweens.add({
      targets: this.submitButton,
      y: scaleY(3),
      duration: 90,
      yoyo: true,
      ease: "Sine.easeInOut"
    });
  }

  private createFeedbackText(): void {
    this.feedbackText = createTranslatedText(this, this.scale.width / 2, scaleY(58), "level2.initialFeedback", {
      maxWidth: 360,
      fontSize: 12,
      color: "#eaf7bf"
    }).setDepth(DEPTH.LEVEL2_RANGE_HINT);
  }

  private createRangeHint(): void {
    this.rangeHint = createDialogText(this, this.scale.width / 2, this.scale.height / 2, "", {
      maxWidth: LEVEL2.RANGE_HINT_MAX_WIDTH,
      fontSize: LEVEL2.RANGE_HINT_FONT_SIZE,
      color: "#eaf7bf"
    })
      .setDepth(DEPTH.LEVEL2_RANGE_HINT)
      .setAlpha(LEVEL2.RANGE_HINT_ALPHA)
      .setVisible(false);
  }

  private updatePileText(): void {
    if (!this.pileText) {
      return;
    }
    setDomText(this.pileText, t("level2.leaves", { count: this.getRemainingLeaves() }));
  }

  private syncLeafLabels(): void {
    for (const leaf of this.leaves) {
      leaf.label?.setPosition(leaf.container.x, leaf.container.y);
    }
  }

  private findNearestLeaf(): LeafToken | null {
    let best: LeafToken | null = null;
    let bestDist: number = MATH.LARGE_NUMBER;
    for (const leaf of this.leaves) {
      if (leaf.placed || leaf === this.carriedLeaf) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, leaf.container.x, leaf.container.y);
      if (dist < scale(LEVEL2.INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = leaf;
      }
    }
    return best;
  }

  private tryPickupLeaf(): void {
    if (this.carriedLeaf) {
      return;
    }
    const leaf = this.findNearestLeaf();
    if (leaf) {
      this.pickUpLeaf(leaf);
      return;
    }
    const placedLeaf = this.findNearestPlacedLeaf();
    if (placedLeaf) {
      this.pickUpPlacedLeaf(placedLeaf);
    }
  }

  private pickUpLeaf(leaf: LeafToken): void {
    if (this.carriedLeaf || leaf.placed) {
      return;
    }
    this.carriedLeaf = leaf;
    this.player.setCarrying(true);
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);
  }

  private findNearestPlacedLeaf(): LeafToken | null {
    let best: LeafToken | null = null;
    let bestDist: number = MATH.LARGE_NUMBER;
    for (const leaf of this.leaves) {
      if (!leaf.placed || leaf === this.carriedLeaf) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, leaf.container.x, leaf.container.y);
      if (dist < scale(LEVEL2.PLACED_PICKUP_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = leaf;
      }
    }
    return best;
  }

  private pickUpPlacedLeaf(leaf: LeafToken): void {
    if (this.carriedLeaf || !leaf.placed) {
      return;
    }
    if (leaf.slot) {
      leaf.slot.value = undefined;
      leaf.slot.image.setAlpha(0.86);
      leaf.slot = undefined;
    }
    leaf.standPlatform?.destroy();
    leaf.standPlatform = undefined;
    leaf.placed = false;
    this.placedCount = Math.max(0, this.placedCount - 1);
    this.carriedLeaf = leaf;
    this.player.setCarrying(true);
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    this.showFeedback(t("level2.leafLifted"), "#bbf7d0");
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);
    this.updatePileText();
  }

  private updateCarriedLeaf(): void {
    if (!this.carriedLeaf) {
      return;
    }
    this.carriedLeaf.container.x = this.player.x;
    this.carriedLeaf.container.y = this.player.y - scale(LEVEL2.CUBE_CARRY_OFFSET_Y);
    this.carriedLeaf.label?.setPosition(this.carriedLeaf.container.x, this.carriedLeaf.container.y);
  }

  private tryPlaceCarried(): void {
    if (!this.carriedLeaf) {
      return;
    }
    this.tryPlaceCarriedAt(this.carriedLeaf.container.x, this.carriedLeaf.container.y);
  }

  private tryPlaceCarriedAt(x: number, y: number): void {
    if (!this.carriedLeaf) {
      return;
    }
    const slot = this.findClosestSlot(x, y);
    if (!slot) {
      this.placeCarriedOnFloor();
      return;
    }

    const validation = this.getPlacementValidation(slot, this.carriedLeaf.value);
    if (!validation.valid) {
      this.highlightPathTo(slot, false);
      this.placeCarriedOnFloor(validation.reason ?? t("level2.wrongPosition"));
      return;
    }

    const leaf = this.carriedLeaf;
    leaf.container.x = slot.x;
    leaf.container.y = slot.y;
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE_PLACED);
    leaf.placed = true;
    this.addLeafStandPlatform(leaf, slot.x, slot.y);
    slot.value = leaf.value;
    leaf.slot = slot;
    slot.image.setAlpha(0.32);
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);
    this.placedCount += 1;
    this.highlightPathTo(slot, true);
    this.showFeedback(t("level2.leafPlaced"), "#8fe388");
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    this.updatePileText();
  }

  private placeCarriedOnFloor(reason?: string): void {
    if (!this.carriedLeaf) {
      return;
    }
    const leaf = this.carriedLeaf;
    const floorY = this.getNearestFloorDropY();
    leaf.container.setPosition(this.player.x, floorY);
    leaf.label?.setPosition(leaf.container.x, leaf.container.y);
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE);
    leaf.placed = false;
    leaf.slot = undefined;
    leaf.startX = leaf.container.x;
    leaf.startY = leaf.container.y;
    leaf.standPlatform?.destroy();
    leaf.standPlatform = undefined;
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);
    this.showFeedback(reason ?? t("level2.leafDropped"), "#facc15");
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);
    this.updatePileText();
  }

  private getNearestFloorDropY(): number {
    const candidates = [LEVEL2.GROUND_Y, ...LEVEL2.SHELF_YS].map((y) => scaleY(y - LEVEL2.LEAF_SLOT_SIZE * 0.5));
    return candidates.reduce((best, candidate) =>
      Math.abs(candidate - this.player.y) < Math.abs(best - this.player.y) ? candidate : best
    );
  }

  private rejectCarriedLeaf(reason: string): void {
    if (!this.carriedLeaf) {
      return;
    }
    const leaf = this.carriedLeaf;
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);
    runState.mistakes += 1;
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
    this.showFeedback(reason, "#fecaca");
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE);
    this.tweens.add({
      targets: leaf.container,
      x: leaf.startX,
      y: leaf.startY,
      duration: LEVEL2.CUBE_REJECT_TWEEN_MS,
      ease: "Sine.easeOut"
    });
    this.updatePileText();
  }

  private returnCarriedLeafFromHazard(): void {
    if (!this.carriedLeaf) {
      return;
    }
    const leaf = this.carriedLeaf;
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);
    leaf.container.setDepth(DEPTH.LEVEL2_CUBE);
    leaf.container.setPosition(leaf.startX, leaf.startY);
    leaf.label?.setPosition(leaf.startX, leaf.startY);
    this.updatePileText();
  }

  private addLeafStandPlatform(leaf: LeafToken, x: number, y: number): void {
    const platform = this.leafPlatforms
      .create(x, y + scale(LEVEL2.LEAF_SLOT_SIZE * 0.25), "leaf-slot-smooth")
      .setScale(scale(LEVEL2.LEAF_SLOT_SIZE) / (LEVEL2.LEAF_SLOT_SIZE * TEXTURES.HIGH_RES_SCALE))
      .setVisible(false)
      .refreshBody() as Phaser.Physics.Arcade.Image;
    platform.disableBody(true, true);
    leaf.standPlatform = platform;
  }

  private getRemainingLeaves(): number {
    return this.leaves.filter((leaf) => !leaf.placed).length;
  }

  private findClosestSlot(x: number, y: number, range: number = LEVEL2.INTERACT_RANGE): Slot | null {
    let best: Slot | null = null;
    let bestDist: number = MATH.LARGE_NUMBER;
    for (const slot of this.slots) {
      if (!slot.active) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(x, y, slot.x, slot.y);
      if (dist < scale(range) && dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    return best;
  }

  private getPlacementValidation(slot: Slot, value: number): PlacementValidation {
    if (slot.value !== undefined) {
      return { valid: false, reason: t("level2.branchOccupied") };
    }
    if (!slot.active) {
      return { valid: false, reason: t("level2.branchInactive") };
    }
    const range = this.getAllowedRange(slot);
    return { valid: true, min: range.min, max: range.max };
  }

  private getAllowedRange(slot: Slot): { min: number; max: number } {
    let min = LEVEL2.VALUE_MIN - 1;
    let max = LEVEL2.VALUE_MAX + 1;
    let node: Slot | undefined = slot;
    while (node?.parent) {
      const parent: Slot = node.parent;
      if (parent.value !== undefined) {
        if (node.isLeft) {
          max = Math.min(max, parent.value);
        } else {
          min = Math.max(min, parent.value);
        }
      }
      node = parent;
    }
    return { min, max };
  }

  private updateRangeHint(): void {
    if (!this.rangeHint) {
      return;
    }
    if (!this.carriedLeaf) {
      this.rangeHint.setVisible(false);
      return;
    }
    const slot = this.findClosestSlot(this.carriedLeaf.container.x, this.carriedLeaf.container.y, LEVEL2.INTERACT_RANGE * 1.8);
    if (!slot) {
      this.rangeHint.setVisible(false);
      return;
    }

    const validation = this.getPlacementValidation(slot, this.carriedLeaf.value);
    const text = validation.reason && !validation.valid ? validation.reason : this.formatRangeHint(slot);
    const color = validation.valid ? "#bbf7d0" : "#fecaca";
    const node = this.rangeHint.node as HTMLDivElement;
    node.style.color = color;
    setDomText(this.rangeHint, text);
    this.rangeHint.setPosition(slot.x, slot.y - scale(LEVEL2.RANGE_HINT_OFFSET_Y));
    this.rangeHint.setVisible(true);
  }

  private formatRangeHint(slot: Slot): string {
    if (!slot.parent) {
      return t("level2.rootAny");
    }
    const range = this.getAllowedRange(slot);
    const min = range.min <= LEVEL2.VALUE_MIN - 1 ? "-" : String(range.min);
    const max = range.max >= LEVEL2.VALUE_MAX + 1 ? "+" : String(range.max);
    return `${min} < n < ${max}`;
  }

  private highlightPathTo(slot: Slot, success: boolean): void {
    if (!this.pathGraphics) {
      return;
    }
    this.pathGraphics.clear();
    const path = this.getPathTo(slot);
    const color = success ? 0x8fe388 : 0xff4d4d;
    this.pathGraphics.lineStyle(scale(4), color, 0.9);
    for (let i = 1; i < path.length; i += 1) {
      this.pathGraphics.lineBetween(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
    }
    for (const pathSlot of path) {
      pathSlot.image.setTint(color);
    }
    this.time.delayedCall(LEVEL2.PATH_HIGHLIGHT_MS, () => {
      this.pathGraphics?.clear();
      for (const pathSlot of path) {
        pathSlot.image.clearTint();
      }
    });
  }

  private getPathTo(slot: Slot): Slot[] {
    const path: Slot[] = [];
    let node: Slot | undefined = slot;
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  }

  private trySubmitTree(): void {
    if (this.levelCompleted) {
      return;
    }
    if (this.placedCount < LEVEL2.MIN_SUBMIT_PLACEMENTS) {
      this.showFeedback(t("level2.placeOne"), "#facc15");
      return;
    }

    const validation = this.validateCurrentTree();
    if (!validation.valid) {
      runState.mistakes += 1;
      this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
      this.showFeedback(validation.reason ?? t("level2.invalidTree"), "#fecaca");
      return;
    }

    const isFull = this.placedCount >= this.requiredPlacements;
    this.completeLevel(isFull);
  }

  private validateCurrentTree(): PlacementValidation {
    for (const slot of this.slots) {
      if (slot.value === undefined) {
        continue;
      }
      const range = this.getAllowedRange(slot);
      if (slot.value <= range.min) {
        return { valid: false, reason: t("level2.mustBeGreater", { value: slot.value, min: range.min }) };
      }
      if (slot.value >= range.max) {
        return { valid: false, reason: t("level2.mustBeSmaller", { value: slot.value, max: range.max }) };
      }
    }
    return { valid: true };
  }

  private createClock(): void {
    this.clockFace = this.add.graphics();
    this.clockFace.fillStyle(LEVEL2.CLOCK_FACE_COLOR, LEVEL2.CLOCK_FACE_ALPHA);
    this.clockFace.fillCircle(this.clockCenterX, this.clockCenterY, this.clockRadius + scale(LEVEL2.CLOCK_RING_PADDING));
    this.clockFace.lineStyle(scale(LEVEL2.CLOCK_RING_STROKE), LEVEL2.CLOCK_RING_COLOR, ALPHA.FULL);
    this.clockFace.strokeCircle(this.clockCenterX, this.clockCenterY, this.clockRadius);
    this.clockFace.setDepth(DEPTH.LEVEL2_CLOCK_FACE);

    this.clockHands = this.add.graphics();
    this.clockHands.setDepth(DEPTH.LEVEL2_CLOCK_HANDS);
    this.clockText = createDialogText(
      this,
      this.clockCenterX + scaleX(LEVEL2.CLOCK_TEXT_OFFSET_X),
      this.clockCenterY - scaleY(LEVEL2.CLOCK_TEXT_OFFSET_Y),
      "1:30",
      {
        maxWidth: LEVEL2.CLOCK_TEXT_MAX_WIDTH,
        fontSize: LEVEL2.CLOCK_TEXT_FONT_SIZE,
        color: "#e8eef2",
        align: "left",
        direction: "ltr",
        originX: DOM_TEXT.ORIGIN_LEFT,
        originY: DOM_TEXT.ORIGIN_MIDDLE
      }
    ).setDepth(DEPTH.LEVEL2_CLOCK_TEXT);
  }

  private updateClock(delta: number): void {
    this.elapsedScoreMs += delta;
    runState.level2ElapsedMs = this.elapsedScoreMs;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    const secondsLeft = Math.ceil(this.timeLeftMs / TIME.MS_PER_SEC);
    const mins = Math.floor(secondsLeft / TIME.SEC_PER_MIN);
    const secs = secondsLeft % TIME.SEC_PER_MIN;
    if (this.clockText) {
      setDomText(this.clockText, `${mins}:${String(secs).padStart(TIME.PAD_TWO, "0")}`);
    }

    if (this.clockHands) {
      const progress = this.timeLeftMs / this.timeLimitMs;
      const minuteAngle = Phaser.Math.DegToRad(LEVEL2.CLOCK_START_DEG + MATH.FULL_CIRCLE_DEG * progress);
      const secondAngle = Phaser.Math.DegToRad(
        LEVEL2.CLOCK_START_DEG +
          MATH.FULL_CIRCLE_DEG * ((this.timeLeftMs / TIME.MS_PER_SEC) % TIME.SEC_PER_MIN) / TIME.SEC_PER_MIN
      );
      const minuteLength = this.clockRadius - scale(LEVEL2.CLOCK_MINUTE_PADDING);
      const secondLength = this.clockRadius - scale(LEVEL2.CLOCK_SECOND_PADDING);
      this.clockHands.clear();
      this.clockHands.lineStyle(scale(LEVEL2.CLOCK_HAND_STROKE), LEVEL2.CLOCK_HAND_MINUTE_COLOR, ALPHA.FULL);
      this.clockHands.lineBetween(
        this.clockCenterX,
        this.clockCenterY,
        this.clockCenterX + Math.cos(minuteAngle) * minuteLength,
        this.clockCenterY + Math.sin(minuteAngle) * minuteLength
      );
      this.clockHands.lineStyle(LEVEL2.CLOCK_HAND_SECOND_STROKE, LEVEL2.CLOCK_HAND_SECOND_COLOR, ALPHA.FULL);
      this.clockHands.lineBetween(
        this.clockCenterX,
        this.clockCenterY,
        this.clockCenterX + Math.cos(secondAngle) * secondLength,
        this.clockCenterY + Math.sin(secondAngle) * secondLength
      );
      this.clockHands.fillStyle(LEVEL2.CLOCK_CENTER_COLOR, ALPHA.FULL);
      this.clockHands.fillCircle(this.clockCenterX, this.clockCenterY, LEVEL2.CLOCK_CENTER_RADIUS);
    }

    if (this.timeLeftMs <= 0) {
      this.scoreSystem.breakCombo();
      const died = this.applyLevel2Damage("timeout");
      if (!died) {
        this.timeLeftMs = this.timeLimitMs;
      }
    }
  }

  private createObstacles(): void {
    this.obstacleGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.obstacleGroup, (_, obstacle) => this.handleObstacleHit(obstacle as Phaser.GameObjects.GameObject));
    this.bugTimer = this.time.addEvent({
      delay: Math.max(1700, LEVEL2.BUG_SPAWN_INTERVAL_MS / this.obstacleSpeedMultiplier),
      loop: true,
      callback: () => this.spawnFallingBug()
    });
    this.nullTimer = this.time.addEvent({
      delay: Math.max(2400, LEVEL2.NULL_SPAWN_INTERVAL_MS / this.obstacleSpeedMultiplier),
      loop: true,
      callback: () => this.spawnNullPointer()
    });
    this.sideBugTimer = this.time.addEvent({
      delay: Math.max(1200, LEVEL2.SIDE_BUG_SPAWN_INTERVAL_MS / this.obstacleSpeedMultiplier),
      loop: true,
      callback: () => this.spawnSideBug()
    });
  }

  private spawnFallingBug(): void {
    if (this.levelCompleted || !this.obstacleGroup) {
      return;
    }
    const x = rngInt(scaleX(70), scaleX(570));
    const warning = this.add.graphics().setDepth(DEPTH.LEVEL2_WARNING);
    warning.lineStyle(scale(2), 0xef4444, 0.95);
    warning.strokeCircle(x, scaleY(76), scale(LEVEL2.BUG_WARNING_RADIUS));
    warning.lineBetween(x, scaleY(58), x, scaleY(94));
    this.tweens.add({
      targets: warning,
      alpha: 0.2,
      yoyo: true,
      repeat: 2,
      duration: LEVEL2.BUG_WARNING_MS / 3,
      onComplete: () => warning.destroy()
    });

    this.time.delayedCall(LEVEL2.BUG_WARNING_MS, () => {
      if (this.levelCompleted || !this.obstacleGroup) {
        return;
      }
      const bug = this.physics.add.image(x, -scale(20), "bst-bug-smooth").setDepth(DEPTH.LEVEL2_OBSTACLE);
      bug.setScale(scale(22) / (24 * TEXTURES.HIGH_RES_SCALE));
      bug.setVelocityY(scaleY(LEVEL2.BUG_SPEED_Y) * this.obstacleSpeedMultiplier);
      const body = bug.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        body.allowGravity = false;
      }
      this.obstacleGroup?.add(bug);
    });
  }

  private spawnNullPointer(): void {
    if (this.levelCompleted || !this.obstacleGroup) {
      return;
    }
    const fromLeft = Phaser.Math.Between(0, 1) === 0;
    const shelfY = LEVEL2.SHELF_YS[rngInt(0, LEVEL2.SHELF_YS.length - 1)] + LEVEL2.NULL_SHELF_OFFSET_Y;
    const x = fromLeft ? -scaleX(LEVEL2.OBSTACLE_CULL_PAD) : this.scale.width + scaleX(LEVEL2.OBSTACLE_CULL_PAD);
    const hazard = this.physics.add.image(x, scaleY(shelfY), "null-pointer-smooth").setDepth(DEPTH.LEVEL2_OBSTACLE);
    hazard.setScale(scale(26) / (18 * TEXTURES.HIGH_RES_SCALE));
    hazard.setFlipX(!fromLeft);
    hazard.setVelocityX((fromLeft ? 1 : -1) * scaleX(LEVEL2.NULL_SPEED_X) * this.obstacleSpeedMultiplier);
    const body = hazard.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = false;
    }
    this.obstacleGroup.add(hazard);
  }

  private spawnSideBug(): void {
    if (this.levelCompleted || !this.obstacleGroup) {
      return;
    }
    const fromLeft = Phaser.Math.Between(0, 1) === 0;
    const lane = LEVEL2.SIDE_BUG_LANES[rngInt(0, LEVEL2.SIDE_BUG_LANES.length - 1)];
    const y = scaleY(lane);
    const x = fromLeft ? -scaleX(LEVEL2.SIDE_BUG_SIZE) : this.scale.width + scaleX(LEVEL2.SIDE_BUG_SIZE);
    const targetX = fromLeft ? this.scale.width + scaleX(LEVEL2.SIDE_BUG_SIZE) : -scaleX(LEVEL2.SIDE_BUG_SIZE);
    const texture = this.textures.exists("level2-beetle-fly-left") ? "level2-beetle-fly-left" : "bst-bug-smooth";
    const bug = this.physics.add.image(x, y, texture).setDepth(DEPTH.LEVEL2_OBSTACLE);
    bug.setDisplaySize(scale(LEVEL2.SIDE_BUG_SIZE), scale(LEVEL2.SIDE_BUG_SIZE));
    bug.setFlipX(fromLeft);
    const speed = scaleX(LEVEL2.SIDE_BUG_SPEED_X) * this.obstacleSpeedMultiplier;
    bug.setVelocityX((fromLeft ? 1 : -1) * speed);
    const body = bug.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = false;
      body.setSize(bug.width * 0.62, bug.height * 0.62, true);
    }
    this.obstacleGroup.add(bug);
    this.physics.add.overlap(this.player, bug, (_, obstacle) => this.handleObstacleHit(obstacle as Phaser.GameObjects.GameObject));
    this.tweens.add({
      targets: bug,
      x: targetX,
      duration: (Math.abs(targetX - x) / speed) * TIME.MS_PER_SEC,
      ease: "Linear",
      onComplete: () => bug.destroy()
    });
  }

  private updateObstacles(): void {
    if (!this.obstacleGroup) {
      return;
    }
    const pad = scale(LEVEL2.OBSTACLE_CULL_PAD);
    for (const child of this.obstacleGroup.getChildren()) {
      const obstacle = child as Phaser.Physics.Arcade.Image;
      if (obstacle.y > this.scale.height + pad || obstacle.x < -pad * 2 || obstacle.x > this.scale.width + pad * 2) {
        obstacle.destroy();
      }
    }
  }

  private handleObstacleHit(obstacle: Phaser.GameObjects.GameObject): void {
    if (this.invulnerable || this.levelCompleted) {
      return;
    }
    obstacle.destroy();
    this.returnCarriedLeafFromHazard();
    this.showFeedback(t("level2.obstacleHit"), "#fecaca");
    this.applyLevel2Damage("obstacle");
  }

  private applyLevel2Damage(reason: "timeout" | "obstacle"): boolean {
    if (this.deathTransitioning || this.levelCompleted) {
      return false;
    }
    if (runState.hearts > 1) {
      const died = super.applyDamage();
      this.hud.updateAll();
      return died;
    }

    runState.hearts = 0;
    this.comboSystem.reset();
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    this.hud.updateAll();
    this.showLevel2GameOver(reason);
    return true;
  }

  private showLevel2GameOver(reason: "timeout" | "obstacle"): void {
    if (this.deathTransitioning) {
      return;
    }
    this.deathTransitioning = true;
    this.levelCompleted = true;
    this.input.enabled = false;
    this.physics.world.isPaused = false;
    this.time.timeScale = 1;
    this.stopLevel2Hazards();

    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);

    const delayMs = reason === "timeout" ? 3000 : 0;
    if (reason === "timeout") {
      this.showFeedback(t("level2.timeUp"), "#fecaca");
      createTranslatedText(this, this.scale.width / 2, this.scale.height / 2, "level2.timeUp", {
        maxWidth: 260,
        fontSize: 28,
        color: "#ff6b6b",
        weight: 900
      })
        .setScrollFactor(0)
        .setDepth(2501);
    }

    this.scheduleGameOver(delayMs);
  }

  private scheduleGameOver(delayMs: number): void {
    const sourceSceneKey = this.sys.settings.key;
    let started = false;
    const startGameOver = (): void => {
      if (started || !this.scene.isActive(sourceSceneKey)) {
        return;
      }
      started = true;
      this.physics.world.isPaused = false;
      this.time.timeScale = 1;
      this.scene.start("GameOverScene");
    };

    this.time.delayedCall(delayMs, startGameOver);
    this.gameOverFallbackId = window.setTimeout(startGameOver, delayMs + 250);
  }

  private stopLevel2Hazards(): void {
    this.bugTimer?.remove(false);
    this.nullTimer?.remove(false);
    this.sideBugTimer?.remove(false);
    this.bugTimer = undefined;
    this.nullTimer = undefined;
    this.sideBugTimer = undefined;
  }

  private showFeedback(text: string, color: string): void {
    if (!this.feedbackText) {
      return;
    }
    setDomText(this.feedbackText, text);
    (this.feedbackText.node as HTMLDivElement).style.color = color;
  }

  private updateDebugConstraints(): void {
    for (const slot of this.slots) {
      if (!slot.debugText) {
        continue;
      }
      if (!slot.active) {
        slot.debugText.setVisible(false);
        continue;
      }
      if (slot.parent && slot.parent.value === undefined) {
        setDomText(slot.debugText, t("level2.lock"));
        continue;
      }
      const range = this.getAllowedRange(slot);
      const min = range.min <= LEVEL2.VALUE_MIN - 1 ? "-" : String(range.min);
      const max = range.max >= LEVEL2.VALUE_MAX + 1 ? "+" : String(range.max);
      setDomText(slot.debugText, `${min}..${max}`);
    }
  }

  private completeLevel(fullTree: boolean): void {
    this.levelCompleted = true;
    this.time.timeScale = 1;
    this.physics.world.isPaused = false;
    this.bugTimer?.remove(false);
    this.nullTimer?.remove(false);
    this.sideBugTimer?.remove(false);
    this.clearActiveObstacles();
    this.carriedLeaf = undefined;
    this.player.setCarrying(false);

    runState.level2ElapsedMs = this.elapsedScoreMs;
    const elapsedSeconds = Math.floor(this.elapsedScoreMs / TIME.MS_PER_SEC);
    const baseScore = Math.max(
      0,
      this.placedCount * LEVEL2.SCORE_PER_PLACED_LEAF - elapsedSeconds * LEVEL2.SCORE_TIME_PENALTY_PER_SEC
    );
    const treeBonus = fullTree
      ? LEVEL2.FULL_TREE_BONUS
      : this.placedCount >= LEVEL2.PARTIAL_TREE_BONUS_MIN_LEAVES
        ? LEVEL2.PARTIAL_TREE_BONUS
        : 0;
    const awardedScore = baseScore + treeBonus;
    this.scoreSystem.addBase(awardedScore);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(
      this,
      scaleX(LEVEL2.COMPLETE_TEXT_X),
      scaleY(LEVEL2.COMPLETE_TEXT_Y),
      fullTree ? t("common.points", { points: awardedScore }) : t("common.partialPoints", { points: awardedScore }),
      "#8fe388"
    );
    this.hud.updateAll();

    if (fullTree) {
      this.showFeedback(t("level2.fullAccepted"), "#bbf7d0");
      this.scheduleLevel3(LEVEL2.COMPLETE_DELAY_MS);
      return;
    }

    this.showFeedback(t("level2.partialAccepted"), "#bbf7d0");
    this.scheduleLevel3(LEVEL2.COMPLETE_DELAY_MS);
  }

  private playInOrderFlash(done: () => void): void {
    const order = this.getInOrderPlacedSlots();
    if (order.length === 0) {
      this.time.delayedCall(LEVEL2.COMPLETE_DELAY_MS, done);
      return;
    }
    order.forEach((slot, index) => {
      this.time.delayedCall(index * (LEVEL2.INORDER_FLASH_MS + LEVEL2.INORDER_FLASH_GAP_MS), () => {
        slot.image.setTint(0xffd166);
        const leaf = this.leaves.find((candidate) => candidate.placed && candidate.value === slot.value);
        leaf?.container.setScale(1.12);
        this.time.delayedCall(LEVEL2.INORDER_FLASH_MS, () => {
          slot.image.clearTint();
          leaf?.container.setScale(1);
        });
      });
    });
    const totalDelay = order.length * (LEVEL2.INORDER_FLASH_MS + LEVEL2.INORDER_FLASH_GAP_MS) + LEVEL2.COMPLETE_DELAY_MS;
    this.time.delayedCall(totalDelay, done);
    this.transitionFallbackId = window.setTimeout(() => {
      if (this.scene.isActive("Level2Scene")) {
        done();
      }
    }, totalDelay + 500);
  }

  private getInOrderPlacedSlots(): Slot[] {
    const result: Slot[] = [];
    const visit = (slot?: Slot): void => {
      if (!slot || slot.value === undefined) {
        return;
      }
      const children = this.slots.filter((candidate) => candidate.parent === slot);
      visit(children.find((candidate) => candidate.isLeft));
      result.push(slot);
      visit(children.find((candidate) => !candidate.isLeft));
    };
    visit(this.slots.find((slot) => slot.id === "root"));
    return result;
  }

  private cleanup(): void {
    this.bugTimer?.remove(false);
    this.nullTimer?.remove(false);
    this.sideBugTimer?.remove(false);
    if (this.transitionFallbackId !== undefined) {
      window.clearTimeout(this.transitionFallbackId);
      this.transitionFallbackId = undefined;
    }
    if (this.gameOverFallbackId !== undefined) {
      window.clearTimeout(this.gameOverFallbackId);
      this.gameOverFallbackId = undefined;
    }
    if (this.deathTransitioning) {
      this.obstacleGroup = undefined;
      return;
    }
    this.obstacleGroup = undefined;
    this.pathGraphics?.clear();
  }

  private clearActiveObstacles(): void {
    if (!this.obstacleGroup) {
      return;
    }
    for (const child of [...this.obstacleGroup.getChildren()]) {
      child.destroy();
    }
    this.obstacleGroup = undefined;
  }

  private scheduleLevel3(delayMs: number): void {
    this.time.timeScale = 1;
    this.physics.world.isPaused = false;
    this.time.delayedCall(delayMs, () => this.startLevel3());
    this.transitionFallbackId = window.setTimeout(() => {
      this.startLevel3();
    }, delayMs + 250);
  }

  private startLevel3(): void {
    if (this.transitionStarted) {
      return;
    }
    this.transitionStarted = true;
    this.physics.world.isPaused = false;
    this.time.timeScale = 1;
    this.scene.start("Level3IntroScene");
  }
}

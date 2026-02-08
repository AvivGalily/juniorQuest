import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { difficultyPresets } from "../../config/difficulty";
import { ALPHA, AUDIO, DEPTH, DOM_TEXT, LEVEL2, LEVEL2_SLOTS, MATH, PLAYER, RUN, SCALE, STAGE, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { isDebug } from "../utils/debug";
import { rngInt } from "../utils/rng";
import { FloatingText } from "../entities/FloatingText";
import { createDialogText, setDomText } from "../utils/domText";
import { scale, scaleX, scaleY } from "../utils/layout";

interface Slot {
  id: string;
  x: number;
  y: number;
  parent?: Slot;
  isLeft?: boolean;
  active?: boolean;
  targetValue?: number;
  value?: number;
  image: Phaser.GameObjects.Image;
  debugText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
}

interface Cube {
  container: Phaser.GameObjects.Container;
  value: number;
  placed: boolean;
  startX: number;
  startY: number;
  label?: Phaser.GameObjects.Text;
}

export class Level2Scene extends BaseLevelScene {
  private player!: Player;
  private slots: Slot[] = [];
  private placedCount = 0;
  private requiredPlacements = LEVEL2.DEFAULT_REQUIRED_PLACEMENTS;
  private cubes: Cube[] = [];
  private carriedCube?: Cube;
  private rowY = scaleY(LEVEL2.ROW_Y);
  private pileText?: Phaser.GameObjects.Text;
  private clockFace?: Phaser.GameObjects.Graphics;
  private clockHands?: Phaser.GameObjects.Graphics;
  private clockText?: Phaser.GameObjects.Text;
  private clockCenterX = scaleX(LEVEL2.CLOCK_CENTER_X);
  private clockCenterY = scaleY(LEVEL2.CLOCK_CENTER_Y);
  private clockRadius = scale(LEVEL2.CLOCK_RADIUS);
  private timeLimitMs = LEVEL2.TIME_LIMIT_MS;
  private timeLeftMs = LEVEL2.TIME_LIMIT_MS;

  constructor() {
    super("Level2Scene");
  }

  create(): void {
    this.initLevel(STAGE.LEVEL2);
    this.audio.playMusic("music-gameplay", AUDIO.MUSIC.GAMEPLAY);
    this.physics.world.gravity.y = LEVEL2.WORLD_GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, LEVEL2.BG_COLOR);

    const diff = difficultyPresets[runState.difficulty];
    this.requiredPlacements = diff.l2.requiredPlacements;
    this.timeLeftMs = this.timeLimitMs;
    this.cubes = [];

    this.createSlots();
    const targetValues = this.assignTargetValues(this.requiredPlacements);

    this.player = new Player(this, scaleX(LEVEL2.PLAYER_START.x), scaleY(LEVEL2.PLAYER_START.y));
    this.setPlayer(this.player);
    const platforms = this.physics.add.staticGroup();
    platforms
      .create(scaleX(LEVEL2.GROUND_X), scaleY(LEVEL2.GROUND_Y), "platform")
      .setScale(LEVEL2.GROUND_SCALE_X * scaleX(SCALE.UNIT), LEVEL2.GROUND_SCALE_Y * scaleY(SCALE.UNIT))
      .refreshBody();
    const shelfYs = LEVEL2.SHELF_YS.map(scaleY);
    const shelfXs = LEVEL2.SHELF_XS.map(scaleX);
    for (const y of shelfYs) {
      for (const x of shelfXs) {
        platforms
          .create(x, y, "platform")
          .setScale(LEVEL2.SHELF_SCALE_X * scaleX(SCALE.UNIT), LEVEL2.SHELF_SCALE_Y * scaleY(SCALE.UNIT))
          .refreshBody();
      }
    }

    this.physics.add.collider(this.player, platforms);

    createDialogText(this, scaleX(LEVEL2.TITLE_X), scaleY(LEVEL2.TITLE_Y), "BST Tower", {
      maxWidth: LEVEL2.TITLE_MAX_WIDTH,
      fontSize: LEVEL2.TITLE_FONT_SIZE,
      color: "#e8eef2"
    });

    this.createCubeRow(targetValues);
    this.createClock();
  }

  update(_: number, delta: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }

    this.player.updatePlatformer(this.inputManager, scale(PLAYER.PLATFORMER_SPEED), scale(PLAYER.JUMP_L2));
    this.updateCarriedCube();
    this.syncCubeLabels();

    if (this.inputManager.justPressedPickup()) {
      if (this.carriedCube) {
        this.tryPlaceCarried();
      } else {
        this.tryPickupCube();
      }
    }

    this.updateClock(delta);
    this.hud.updateAll();
    if (isDebug()) {
      this.updateDebugConstraints();
    }
  }

  private createSlots(): void {
    const makeSlot = (id: string, x: number, y: number, parent?: Slot, isLeft?: boolean): Slot => {
      const sx = scaleX(x);
      const sy = scaleY(y);
      const image = this.add.image(sx, sy, "slot").setDepth(DEPTH.LEVEL2_SLOT);
      image.setScale(scale(LEVEL2.SLOT_SIZE) / LEVEL2.SLOT_SIZE);
      const slot: Slot = { id, x: sx, y: sy, parent, isLeft, image };
      if (isDebug()) {
        slot.debugText = createDialogText(this, sx, sy - scale(LEVEL2.SLOT_DEBUG_OFFSET_Y), "", {
          maxWidth: LEVEL2.SLOT_DEBUG_MAX_WIDTH,
          fontSize: LEVEL2.SLOT_DEBUG_FONT_SIZE,
          color: "#8fe388",
          align: "center"
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
    const slotsToFill = this.slots.slice(0, Math.min(count, this.slots.length));
    const maxAttempts = LEVEL2.MAX_ASSIGN_ATTEMPTS;

    for (const slot of this.slots) {
      slot.active = false;
      slot.targetValue = undefined;
      slot.value = undefined;
      slot.hintText?.destroy();
      slot.hintText = undefined;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const used = new Set<number>();
      let success = true;

      for (const slot of slotsToFill) {
        const range = this.getSlotTargetRange(slot);
        const value = this.pickUniqueValue(range.min, range.max, used);
        if (value === undefined) {
          success = false;
          break;
        }
        slot.active = true;
        slot.targetValue = value;
        used.add(value);
      }

      if (success) {
        for (const slot of slotsToFill) {
          if (slot.targetValue === undefined) {
            continue;
          }
          slot.hintText?.destroy();
          slot.hintText = createDialogText(this, slot.x, slot.y, String(slot.targetValue), {
            maxWidth: LEVEL2.HINT_MAX_WIDTH,
            fontSize: LEVEL2.HINT_FONT_SIZE,
            color: "#94a3b8",
            align: "center"
          }).setDepth(DEPTH.LEVEL2_SLOT_HINT).setAlpha(LEVEL2.HINT_ALPHA);
        }
        return this.shuffle(this.valuesFromSlots(slotsToFill));
      }
    }

    return this.shuffle(this.valuesFromSlots(slotsToFill));
  }

  private getSlotTargetRange(slot: Slot): { min: number; max: number } {
    let min = LEVEL2.VALUE_MIN;
    let max = LEVEL2.VALUE_MAX;
    let node: Slot | undefined = slot;
    while (node?.parent) {
      const parent = node.parent;
      if (parent.targetValue === undefined) {
        break;
      }
      if (node.isLeft) {
        max = Math.min(max, parent.targetValue - 1);
      } else {
        min = Math.max(min, parent.targetValue + 1);
      }
      node = parent;
    }
    return { min, max };
  }

  private pickUniqueValue(min: number, max: number, used: Set<number>): number | undefined {
    if (min > max) {
      return undefined;
    }
    const available: number[] = [];
    for (let value = min; value <= max; value += 1) {
      if (!used.has(value)) {
        available.push(value);
      }
    }
    if (available.length === 0) {
      return undefined;
    }
    return available[rngInt(0, available.length - 1)];
  }

  private shuffle(values: number[]): number[] {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = rngInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private valuesFromSlots(slots: Slot[]): number[] {
    const values: number[] = [];
    for (const slot of slots) {
      if (slot.targetValue !== undefined) {
        values.push(slot.targetValue);
      }
    }
    return values;
  }

  private createCubeRow(values: number[]): void {
    const spacing = scaleX(LEVEL2.ROW_SPACING);
    const count = values.length;
    const totalWidth = (count - 1) * spacing;
    const startX = scaleX(LEVEL2.ROW_CENTER_X) - totalWidth / 2;
    const rowY = this.rowY;

    for (let i = 0; i < count; i += 1) {
      const value = values[i];
      const x = startX + i * spacing;
      const cube = this.createCubeContainer(value, x, rowY);
      this.cubes.push(cube);
    }

    this.pileText = createDialogText(this, scaleX(LEVEL2.PILE_TEXT_X), rowY - scale(LEVEL2.PILE_TEXT_OFFSET_Y), "Cubes: 0", {
      maxWidth: LEVEL2.PILE_TEXT_MAX_WIDTH,
      fontSize: LEVEL2.PILE_TEXT_FONT_SIZE,
      color: "#e8eef2",
      align: "left",
      originX: DOM_TEXT.ORIGIN_LEFT
    });
    this.updatePileText();
  }

  private updatePileText(): void {
    if (!this.pileText) {
      return;
    }
    setDomText(this.pileText, `Cubes: ${this.getRemainingCubes()}`);
  }

  private findNearestCube(): Cube | null {
    let best: Cube | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const cube of this.cubes) {
      if (cube.placed || cube === this.carriedCube) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, cube.container.x, cube.container.y);
      if (dist < scale(LEVEL2.INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = cube;
      }
    }
    return best;
  }

  private tryPickupCube(): void {
    if (this.carriedCube) {
      return;
    }
    const cube = this.findNearestCube();
    if (!cube) {
      return;
    }
    this.pickUpCube(cube);
  }

  private createCubeContainer(value: number, x: number, y: number): Cube {
    const container = this.add.container(x, y);
    const sprite = this.add.image(0, 0, "cube");
    const cubeScale = scale(LEVEL2.CUBE_SIZE) / LEVEL2.CUBE_SIZE;
    sprite.setScale(cubeScale);
    container.add([sprite]);
    container.setSize(scale(LEVEL2.CUBE_SIZE), scale(LEVEL2.CUBE_SIZE));
    container.setDepth(DEPTH.LEVEL2_CUBE);
    const label = createDialogText(this, x, y, String(value), {
      maxWidth: LEVEL2.CUBE_LABEL_MAX_WIDTH,
      fontSize: LEVEL2.CUBE_LABEL_FONT_SIZE,
      color: "#0f172a",
      align: "center"
    }).setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    return { container, value, placed: false, startX: x, startY: y, label };
  }

  private updateCarriedCube(): void {
    if (!this.carriedCube) {
      return;
    }
    this.carriedCube.container.x = this.player.x;
    this.carriedCube.container.y = this.player.y - scale(LEVEL2.CUBE_CARRY_OFFSET_Y);
    this.carriedCube.label?.setPosition(this.carriedCube.container.x, this.carriedCube.container.y);
  }

  private syncCubeLabels(): void {
    for (const cube of this.cubes) {
      cube.label?.setPosition(cube.container.x, cube.container.y);
    }
  }

  private tryPlaceCarried(): void {
    if (!this.carriedCube) {
      return;
    }
    this.tryPlaceCarriedAt(this.carriedCube.container.x, this.carriedCube.container.y);
  }

  private tryPlaceCarriedAt(x: number, y: number): void {
    if (!this.carriedCube) {
      return;
    }
    const slot = this.findClosestSlot(x, y);
    if (!slot) {
      return;
    }
    if (!this.isPlacementValid(slot, this.carriedCube.value)) {
      this.rejectCarriedCube();
      return;
    }
    const cube = this.carriedCube;
    cube.container.x = slot.x;
    cube.container.y = slot.y;
    cube.container.setDepth(DEPTH.LEVEL2_CUBE_PLACED);
    cube.placed = true;
    slot.value = cube.value;
    this.carriedCube = undefined;
    this.player.setCarrying(false);
    this.placedCount += 1;
    this.scoreSystem.addSkill(LEVEL2.CUBE_SUCCESS_SCORE);
    FloatingText.spawn(
      this,
      slot.x,
      slot.y - scale(LEVEL2.SCORE_FLOAT_OFFSET_Y),
      `+${LEVEL2.CUBE_SUCCESS_SCORE}`,
      "#8fe388"
    );
    this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS_MED);
    this.updatePileText();

    if (this.placedCount >= this.requiredPlacements) {
      this.completeLevel();
    }
  }

  private rejectCarriedCube(): void {
    if (!this.carriedCube) {
      return;
    }
    const cube = this.carriedCube;
    this.carriedCube = undefined;
    this.player.setCarrying(false);
    this.scoreSystem.addPenalty(LEVEL2.CUBE_REJECT_PENALTY);
    this.scoreSystem.breakCombo();
    runState.mistakes += 1;
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT_LIGHT);
    cube.container.setDepth(DEPTH.LEVEL2_CUBE);
    this.tweens.add({
      targets: cube.container,
      x: cube.startX,
      y: cube.startY,
      duration: LEVEL2.CUBE_REJECT_TWEEN_MS,
      ease: "Sine.easeOut"
    });
    this.updatePileText();
  }

  private pickUpCube(cube: Cube): void {
    if (this.carriedCube || cube.placed) {
      return;
    }
    this.carriedCube = cube;
    this.player.setCarrying(true);
    cube.container.setDepth(DEPTH.LEVEL2_CUBE_LABEL);
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT_LIGHT);
  }

  private getRemainingCubes(): number {
    return this.cubes.filter((cube) => !cube.placed).length;
  }

  private findClosestSlot(x: number, y: number): Slot | null {
    let best: Slot | null = null;
    let bestDist = MATH.LARGE_NUMBER;
    for (const slot of this.slots) {
      const dist = Phaser.Math.Distance.Between(x, y, slot.x, slot.y);
      if (dist < scale(LEVEL2.INTERACT_RANGE) && dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    return best;
  }

  private isPlacementValid(slot: Slot, value: number): boolean {
    if (slot.value !== undefined) {
      return false;
    }
    if (!slot.active || slot.targetValue === undefined) {
      return false;
    }
    return value === slot.targetValue;
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
      "1:00",
      {
        maxWidth: LEVEL2.CLOCK_TEXT_MAX_WIDTH,
        fontSize: LEVEL2.CLOCK_TEXT_FONT_SIZE,
        color: "#e8eef2",
        align: "left",
        originX: DOM_TEXT.ORIGIN_LEFT,
        originY: DOM_TEXT.ORIGIN_MIDDLE
      }
    ).setDepth(DEPTH.LEVEL2_CLOCK_TEXT);
  }

  private updateClock(delta: number): void {
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
      this.applyDamage();
      this.timeLeftMs = this.timeLimitMs;
    }
  }

  private updateDebugConstraints(): void {
    for (const slot of this.slots) {
      if (!slot.debugText) {
        continue;
      }
      if (slot.parent && slot.parent.value === undefined) {
        setDomText(slot.debugText, "lock");
        continue;
      }
      let min = -Infinity;
      let max = Infinity;
      let node: Slot | undefined = slot;
      while (node?.parent) {
        const parent = node.parent;
        if (parent.value === undefined) {
          break;
        }
        if (node.isLeft) {
          max = Math.min(max, parent.value);
        } else {
          min = Math.max(min, parent.value);
        }
        node = parent;
      }
      setDomText(slot.debugText, `${min === -Infinity ? "-" : min}..${max === Infinity ? "+" : max}`);
    }
  }

  private completeLevel(): void {
    this.scoreSystem.addBase(LEVEL2.COMPLETE_SCORE);
    if (runState.hearts === RUN.DEFAULT_HEARTS) {
      this.scoreSystem.addBase(LEVEL2.PERFECT_HEARTS_BONUS);
    }
    this.scoreSystem.applyTimeBonus(LEVEL2.TIME_BONUS_MS);
    this.audio.playSfx("sfx-level-complete", AUDIO.SFX.LEVEL_COMPLETE);
    FloatingText.spawn(this, scaleX(LEVEL2.COMPLETE_TEXT_X), scaleY(LEVEL2.COMPLETE_TEXT_Y), `+${LEVEL2.COMPLETE_SCORE}`, "#8fe388");
    this.hud.updateAll();
    this.time.delayedCall(LEVEL2.COMPLETE_DELAY_MS, () => this.scene.start("Level3Scene"));
  }
}

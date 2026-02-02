import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { difficultyPresets } from "../../config/difficulty";
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
  private requiredPlacements = 11;
  private cubes: Cube[] = [];
  private carriedCube?: Cube;
  private rowY = scaleY(322);
  private pileText?: Phaser.GameObjects.Text;
  private clockFace?: Phaser.GameObjects.Graphics;
  private clockHands?: Phaser.GameObjects.Graphics;
  private clockText?: Phaser.GameObjects.Text;
  private clockCenterX = scaleX(90);
  private clockCenterY = scaleY(42);
  private clockRadius = scale(20);
  private timeLimitMs = 90000;
  private timeLeftMs = 90000;

  constructor() {
    super("Level2Scene");
  }

  create(): void {
    this.initLevel(2);
    this.audio.playMusic("music-gameplay", 0.2);
    this.physics.world.gravity.y = 700;
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x122033);

    const diff = difficultyPresets[runState.difficulty];
    this.requiredPlacements = diff.l2.requiredPlacements;
    this.timeLeftMs = this.timeLimitMs;
    this.cubes = [];

    this.createSlots();
    const targetValues = this.assignTargetValues(this.requiredPlacements);

    this.player = new Player(this, scaleX(90), scaleY(300));
    this.setPlayer(this.player);
    const platforms = this.physics.add.staticGroup();
    platforms.create(scaleX(320), scaleY(332), "platform").setScale(12 * scaleX(1), 1 * scaleY(1)).refreshBody();
    const shelfYs = [286, 226, 166, 106].map(scaleY);
    const shelfXs = [120, 320, 520].map(scaleX);
    for (const y of shelfYs) {
      for (const x of shelfXs) {
        platforms.create(x, y, "platform").setScale(2.4 * scaleX(1), 1 * scaleY(1)).refreshBody();
      }
    }

    this.physics.add.collider(this.player, platforms);

    createDialogText(this, scaleX(320), scaleY(20), "BST Tower", {
      maxWidth: 200,
      fontSize: 16,
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

    this.player.updatePlatformer(this.inputManager, scale(150), scale(300));
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
      const image = this.add.image(sx, sy, "slot").setDepth(1);
      image.setScale(scale(26) / 26);
      const slot: Slot = { id, x: sx, y: sy, parent, isLeft, image };
      if (isDebug()) {
        slot.debugText = createDialogText(this, sx, sy - scale(16), "", {
          maxWidth: 80,
          fontSize: 12,
          color: "#8fe388",
          align: "center"
        }).setDepth(2);
      }
      this.slots.push(slot);
      return slot;
    };

    const root = makeSlot("root", 320, 90);
    const l1 = makeSlot("l1", 220, 150, root, true);
    const r1 = makeSlot("r1", 420, 150, root, false);

    const l1l = makeSlot("l1l", 160, 210, l1, true);
    const l1r = makeSlot("l1r", 280, 210, l1, false);
    const r1l = makeSlot("r1l", 360, 210, r1, true);
    const r1r = makeSlot("r1r", 480, 210, r1, false);

    makeSlot("l1l1", 100, 270, l1l, true);
    makeSlot("l1l2", 180, 270, l1l, false);
    makeSlot("l1r1", 240, 270, l1r, true);
    makeSlot("l1r2", 320, 270, l1r, false);
    makeSlot("r1l1", 360, 270, r1l, true);
    makeSlot("r1l2", 440, 270, r1l, false);
    makeSlot("r1r1", 500, 270, r1r, true);
    makeSlot("r1r2", 580, 270, r1r, false);
  }

  private assignTargetValues(count: number): number[] {
    const slotsToFill = this.slots.slice(0, Math.min(count, this.slots.length));
    const maxAttempts = 40;

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
            maxWidth: 40,
            fontSize: 12,
            color: "#94a3b8",
            align: "center"
          }).setDepth(2).setAlpha(0.35);
        }
        return this.shuffle(this.valuesFromSlots(slotsToFill));
      }
    }

    return this.shuffle(this.valuesFromSlots(slotsToFill));
  }

  private getSlotTargetRange(slot: Slot): { min: number; max: number } {
    let min = 1;
    let max = 99;
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
    const spacing = scaleX(28);
    const count = values.length;
    const totalWidth = (count - 1) * spacing;
    const startX = scaleX(320) - totalWidth / 2;
    const rowY = this.rowY;

    for (let i = 0; i < count; i += 1) {
      const value = values[i];
      const x = startX + i * spacing;
      const cube = this.createCubeContainer(value, x, rowY);
      this.cubes.push(cube);
    }

    this.pileText = createDialogText(this, scaleX(20), rowY - scale(18), "Cubes: 0", {
      maxWidth: 140,
      fontSize: 12,
      color: "#e8eef2",
      align: "left",
      originX: 0
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
    let bestDist = 9999;
    for (const cube of this.cubes) {
      if (cube.placed || cube === this.carriedCube) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, cube.container.x, cube.container.y);
      if (dist < scale(30) && dist < bestDist) {
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
    const cubeScale = scale(22) / 22;
    sprite.setScale(cubeScale);
    container.add([sprite]);
    container.setSize(scale(22), scale(22));
    container.setDepth(5);
    const label = createDialogText(this, x, y, String(value), {
      maxWidth: 40,
      fontSize: 12,
      color: "#0f172a",
      align: "center"
    }).setDepth(6);
    return { container, value, placed: false, startX: x, startY: y, label };
  }

  private updateCarriedCube(): void {
    if (!this.carriedCube) {
      return;
    }
    this.carriedCube.container.x = this.player.x;
    this.carriedCube.container.y = this.player.y - scale(18);
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
    cube.container.setDepth(2);
    cube.placed = true;
    slot.value = cube.value;
    this.carriedCube = undefined;
    this.player.setCarrying(false);
    this.placedCount += 1;
    this.scoreSystem.addSkill(80);
    FloatingText.spawn(this, slot.x, slot.y - scale(12), "+80", "#8fe388");
    this.audio.playSfx("sfx-success", 0.5);
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
    this.scoreSystem.addPenalty(-10);
    this.scoreSystem.breakCombo();
    runState.mistakes += 1;
    this.audio.playSfx("sfx-hit", 0.4);
    cube.container.setDepth(5);
    this.tweens.add({
      targets: cube.container,
      x: cube.startX,
      y: cube.startY,
      duration: 200,
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
    cube.container.setDepth(6);
    this.audio.playSfx("sfx-select", 0.4);
  }

  private getRemainingCubes(): number {
    return this.cubes.filter((cube) => !cube.placed).length;
  }

  private findClosestSlot(x: number, y: number): Slot | null {
    let best: Slot | null = null;
    let bestDist = 9999;
    for (const slot of this.slots) {
      const dist = Phaser.Math.Distance.Between(x, y, slot.x, slot.y);
      if (dist < scale(30) && dist < bestDist) {
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
    this.clockFace.fillStyle(0x0f172a, 0.9);
    this.clockFace.fillCircle(this.clockCenterX, this.clockCenterY, this.clockRadius + scale(2));
    this.clockFace.lineStyle(scale(3), 0xe2e8f0, 1);
    this.clockFace.strokeCircle(this.clockCenterX, this.clockCenterY, this.clockRadius);
    this.clockFace.setDepth(900);

    this.clockHands = this.add.graphics();
    this.clockHands.setDepth(901);
    this.clockText = createDialogText(this, this.clockCenterX + scaleX(26), this.clockCenterY - scaleY(6), "1:00", {
      maxWidth: 80,
      fontSize: 12,
      color: "#e8eef2",
      align: "left",
      originX: 0,
      originY: 0.5
    }).setDepth(902);
  }

  private updateClock(delta: number): void {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    const secondsLeft = Math.ceil(this.timeLeftMs / 1000);
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    if (this.clockText) {
      setDomText(this.clockText, `${mins}:${String(secs).padStart(2, "0")}`);
    }

    if (this.clockHands) {
      const progress = this.timeLeftMs / this.timeLimitMs;
      const minuteAngle = Phaser.Math.DegToRad(270 + 360 * progress);
      const secondAngle = Phaser.Math.DegToRad(270 + 360 * ((this.timeLeftMs / 1000) % 60) / 60);
      const minuteLength = this.clockRadius - scale(4);
      const secondLength = this.clockRadius - scale(2);
      this.clockHands.clear();
      this.clockHands.lineStyle(scale(3), 0xffd166, 1);
      this.clockHands.lineBetween(
        this.clockCenterX,
        this.clockCenterY,
        this.clockCenterX + Math.cos(minuteAngle) * minuteLength,
        this.clockCenterY + Math.sin(minuteAngle) * minuteLength
      );
      this.clockHands.lineStyle(2, 0x8fe388, 1);
      this.clockHands.lineBetween(
        this.clockCenterX,
        this.clockCenterY,
        this.clockCenterX + Math.cos(secondAngle) * secondLength,
        this.clockCenterY + Math.sin(secondAngle) * secondLength
      );
      this.clockHands.fillStyle(0xe2e8f0, 1);
      this.clockHands.fillCircle(this.clockCenterX, this.clockCenterY, 2);
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
    this.scoreSystem.addBase(1500);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(400);
    }
    this.scoreSystem.applyTimeBonus(90000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, scaleX(320), scaleY(120), "+1500", "#8fe388");
    this.hud.updateAll();
    this.time.delayedCall(1200, () => this.scene.start("Level3Scene"));
  }
}

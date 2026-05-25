import Phaser from "phaser";
import { AUDIO_TONES, NPCS, PRELOAD, TEXTURES } from "../../config/physics";
import { createTranslatedText } from "../utils/domText";
import { BASE_HEIGHT, BASE_WIDTH } from "../utils/resolution";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const envBase = "../img/";
    const playerBase = envBase;
    this.load.image("player-walk-slow-left", new URL(`${playerBase}player-walk-slow-left.png`, import.meta.url).href);
    this.load.image("player-walk-fast-left", new URL(`${playerBase}player-walk-fast-left.png`, import.meta.url).href);
    this.load.image("player-walk-slow-right", new URL(`${playerBase}player-walk-slow-right.png`, import.meta.url).href);
    this.load.image("player-walk-fast-right", new URL(`${playerBase}player-walk-fast-right.png`, import.meta.url).href);
    this.load.image("player-walk-front", new URL(`${playerBase}player-walk-front.png`, import.meta.url).href);
    this.load.image("player-walk-back", new URL(`${playerBase}player-walk-back.png`, import.meta.url).href);
    this.load.image("player-cv-walk-front", new URL(`${playerBase}player-cv-walk-front.png`, import.meta.url).href);
    this.load.image("player-cv-walk-back", new URL(`${playerBase}player-cv-walk-back.png`, import.meta.url).href);
    this.load.image("player-cv-walk-slow-left", new URL(`${playerBase}player-cv-walk-slow-left.png`, import.meta.url).href);
    this.load.image("player-cv-walk-fast-left", new URL(`${playerBase}player-cv-walk-fast-left.png`, import.meta.url).href);
    this.load.image("player-cv-walk-slow-right", new URL(`${playerBase}player-cv-walk-slow-right.png`, import.meta.url).href);
    this.load.image("player-cv-walk-fast-right", new URL(`${playerBase}player-cv-walk-fast-right.png`, import.meta.url).href);
    this.load.image("player-carry-left", new URL(`${playerBase}Player-carry-left.png`, import.meta.url).href);

    const guardBase = "../entities/guard/img/";
    this.load.image("guard-stand", new URL(`${guardBase}gurad-stand.png`, import.meta.url).href);
    this.load.image("guard-walk-front", new URL(`${guardBase}gurad-walk-front.png`, import.meta.url).href);
    this.load.image("guard-walk-slow-left", new URL(`${guardBase}guard-walk-slow-left.png`, import.meta.url).href);
    this.load.image("guard-walk-fast-left", new URL(`${guardBase}guard-walk-fast-left.png`, import.meta.url).href);
    this.load.image("guard-walk-slow-right", new URL(`${guardBase}guard-walk-right-slow.png`, import.meta.url).href);
    this.load.image("guard-walk-fast-right", new URL(`${guardBase}guard-walk-right-fast.png`, import.meta.url).href);

    const hrBase = "../entities/recruiter/img/";
    this.load.image("hr-stand", new URL(`${hrBase}HR-stand.png`, import.meta.url).href);
    this.load.image("hr-walk-slow-left", new URL(`${hrBase}HR-walk-slow-left.png`, import.meta.url).href);
    this.load.image("hr-walk-fast-left", new URL(`${hrBase}HR-walk-fast-left.png`, import.meta.url).href);
    this.load.image("hr-walk-slow-right", new URL(`${hrBase}HR-walk-slow-right.png`, import.meta.url).href);
    this.load.image("hr-walk-fast-right", new URL(`${hrBase}HR-walk-fast-right.png`, import.meta.url).href);
    for (let i = 1; i <= 5; i += 1) {
      this.load.image(`hr-v${i}-stand`, new URL(`${hrBase}HR-v${i}-stand.png`, import.meta.url).href);
      this.load.image(`hr-v${i}-walk-slow-left`, new URL(`${hrBase}HR-v${i}-walk-slow-left.png`, import.meta.url).href);
      this.load.image(`hr-v${i}-walk-fast-left`, new URL(`${hrBase}HR-v${i}-walk-fast-left.png`, import.meta.url).href);
      this.load.image(`hr-v${i}-walk-slow-right`, new URL(`${hrBase}HR-v${i}-walk-slow-right.png`, import.meta.url).href);
      this.load.image(`hr-v${i}-walk-fast-right`, new URL(`${hrBase}HR-v${i}-walk-fast-right.png`, import.meta.url).href);
    }

    const npcBase = envBase;
    const loadNpc = (id: number, hasFast: boolean): void => {
      this.load.image(`npc${id}-walk-front`, new URL(`${npcBase}npc${id}-walk-front.png`, import.meta.url).href);
      this.load.image(`npc${id}-walk-back`, new URL(`${npcBase}npc${id}-walk-back.png`, import.meta.url).href);
      this.load.image(`npc${id}-walk-slow-left`, new URL(`${npcBase}npc${id}-walk-slow-left.png`, import.meta.url).href);
      this.load.image(`npc${id}-walk-slow-right`, new URL(`${npcBase}npc${id}-walk-slow-right.png`, import.meta.url).href);
      if (hasFast) {
        this.load.image(`npc${id}-walk-fast-left`, new URL(`${npcBase}npc${id}-walk-fast-left.png`, import.meta.url).href);
        this.load.image(`npc${id}-walk-fast-right`, new URL(`${npcBase}npc${id}-walk-fast-right.png`, import.meta.url).href);
      }
    };
    NPCS.VARIANTS.forEach((variant) => loadNpc(variant.id, variant.hasFast));
    this.load.image("both1", new URL(`${envBase}both1.png`, import.meta.url).href);
    this.load.image("both2", new URL(`${envBase}both2.png`, import.meta.url).href);
    this.load.image("trash-empty", new URL(`${envBase}trash-bin-empty.png`, import.meta.url).href);
    this.load.image("trash-full", new URL(`${envBase}trash-bin-with-cv.png`, import.meta.url).href);
    this.load.image("level1-job-fair-bg", new URL(`${envBase}level1-job-fair-bg.png`, import.meta.url).href);
    this.load.image("level2-bst-orchard-bg", new URL(`${envBase}level2-bst-orchard-bg.png`, import.meta.url).href);
    this.load.image("level2-beetle-fly-left", new URL(`${envBase}level2-beetle-fly-left.png`, import.meta.url).href);
    this.load.image("level2-beetle-fly-right", new URL(`${envBase}level2-beetle-fly-right.png`, import.meta.url).href);
    this.load.image("level3-snake-bg", new URL(`${envBase}level3-snake-bg.png`, import.meta.url).href);
    this.load.image("level4-hitech-tower-bg", new URL("../img/level4-hitech-tower-bg.png", import.meta.url).href);
    this.load.image("level4-platform", new URL("../img/level4-platform.png", import.meta.url).href);
    this.load.image("level4-docker-whale", new URL("../img/level4-docker-whale.png", import.meta.url).href);
    this.load.image("level4-octocat", new URL("../img/level4-octocat.png", import.meta.url).href);
    this.load.image("level4-python-snake", new URL("../img/level4-python-snake.png", import.meta.url).href);
    this.load.image("level4-jetpack", new URL("../img/level4-jetpack.png", import.meta.url).href);
    this.load.image("level4-player-jetpack", new URL("../img/level4-player-jetpack.png", import.meta.url).href);
    this.load.image("level4-jetpack-smoke", new URL("../img/level4-jetpack-smoke.png", import.meta.url).href);
    this.load.image("level4-java-coffee", new URL("../img/level4-java-coffee.png", import.meta.url).href);
    this.load.image("level4-finish-door", new URL("../img/level4-finish-door.png", import.meta.url).href);
    this.load.image("level5-broken-office-bg", new URL("../img/level5-broken-office-bg.png", import.meta.url).href);
    this.load.image("level5-computer-spider-body-angry", new URL("../img/level5-computer-spider-body-angry.png", import.meta.url).href);
    this.load.image("level5-computer-spider-body-scared", new URL("../img/level5-computer-spider-body-scared.png", import.meta.url).href);
    this.load.image("level5-computer-spider-body-crack-1", new URL("../img/level5-computer-spider-body-crack-1.png", import.meta.url).href);
    this.load.image("level5-computer-spider-body-crack-2", new URL("../img/level5-computer-spider-body-crack-2.png", import.meta.url).href);
    this.load.image("level5-computer-spider-body-broken", new URL("../img/level5-computer-spider-body-broken.png", import.meta.url).href);
    this.load.image("level5-computer-spider-leg", new URL("../img/level5-computer-spider-leg.png", import.meta.url).href);
    this.load.image("level5-player-keyboard-gun-walk-1", new URL("../img/level5-player-keyboard-gun-walk-1.png", import.meta.url).href);
    this.load.image("level5-player-keyboard-gun-walk-2", new URL("../img/level5-player-keyboard-gun-walk-2.png", import.meta.url).href);
    this.load.image("level5-player-keyboard-gun-walk-3", new URL("../img/level5-player-keyboard-gun-walk-3.png", import.meta.url).href);
    this.load.image("level5-player-keyboard-gun-front", new URL("../img/level5-player-keyboard-gun-front.png", import.meta.url).href);
    this.load.image("level5-player-keyboard-gun-back", new URL("../img/level5-player-keyboard-gun-back.png", import.meta.url).href);
    this.load.image("level5-dragon-keyboard-pickup", new URL("../img/level5-dragon-keyboard-pickup.png", import.meta.url).href);
    this.load.image("level5-dragon-beetle-shot", new URL("../img/level5-dragon-beetle-shot.png", import.meta.url).href);
    this.load.image("level5-player-dragon-keyboard-walk-1", new URL("../img/level5-player-dragon-keyboard-walk-1.png", import.meta.url).href);
    this.load.image("level5-player-dragon-keyboard-walk-2", new URL("../img/level5-player-dragon-keyboard-walk-2.png", import.meta.url).href);
    this.load.image("level5-player-dragon-keyboard-walk-3", new URL("../img/level5-player-dragon-keyboard-walk-3.png", import.meta.url).href);
    this.load.image("level5-player-dragon-keyboard-front", new URL("../img/level5-player-dragon-keyboard-front.png", import.meta.url).href);
    this.load.image("level5-player-dragon-keyboard-back", new URL("../img/level5-player-dragon-keyboard-back.png", import.meta.url).href);
    this.load.image("linked-snake-head", new URL(`${envBase}linked-snake-head.png`, import.meta.url).href);
    this.load.image("linked-snake-head-hurt", new URL(`${envBase}linked-snake-head-hurt.png`, import.meta.url).href);
    this.load.image("linked-snake-node", new URL(`${envBase}linked-snake-node.png`, import.meta.url).href);
    this.load.image("linked-snake-tail", new URL(`${envBase}linked-snake-tail.png`, import.meta.url).href);
    this.load.image("linked-snake-fireball", new URL(`${envBase}linked-snake-fireball.png`, import.meta.url).href);
    this.load.image("linked-snake-burst", new URL(`${envBase}linked-snake-burst.png`, import.meta.url).href);
  }

  create(): void {
    createTranslatedText(this, this.scale.width / 2, this.scale.height / 2, "common.loading", {
      maxWidth: PRELOAD.LOADING_MAX_WIDTH,
      fontSize: PRELOAD.LOADING_FONT_SIZE,
      color: "#e8eef2"
    });

    this.createTextures();
    this.applyTextureFilter();
    this.createAudio();

    this.scene.start("MenuScene");
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const rect = (key: string, w: number, h: number, fill: number, stroke?: number): void => {
      g.clear();
      if (stroke !== undefined) {
        g.lineStyle(TEXTURES.RECT_STROKE_WIDTH, stroke, TEXTURES.RECT_STROKE_ALPHA);
      }
      g.fillStyle(fill, TEXTURES.ALPHA_FULL);
      g.fillRect(0, 0, w, h);
      if (stroke !== undefined) {
        g.strokeRect(0, 0, w, h);
      }
      g.generateTexture(key, w, h);
    };

    for (const def of TEXTURES.RECTS) {
      rect(def.key, def.w, def.h, def.fill, def.stroke);
    }
    this.createHighResolutionTextureVariants(g);

    g.clear();
    g.fillStyle(TEXTURES.WATER.TOP_COLOR, TEXTURES.ALPHA_FULL);
    g.fillRect(0, 0, TEXTURES.WATER.SIZE, TEXTURES.WATER.SIZE);
    g.fillStyle(TEXTURES.WATER.STRIP_COLOR, TEXTURES.ALPHA_FULL);
    g.fillRect(0, TEXTURES.WATER.SIZE - TEXTURES.WATER.STRIP_HEIGHT, TEXTURES.WATER.SIZE, TEXTURES.WATER.STRIP_HEIGHT);
    g.generateTexture("water", TEXTURES.WATER.SIZE, TEXTURES.WATER.SIZE);

    g.clear();
    g.fillStyle(TEXTURES.HEART.COLOR, TEXTURES.ALPHA_FULL);
    g.fillCircle(TEXTURES.HEART.CIRCLE_1.x, TEXTURES.HEART.CIRCLE_1.y, TEXTURES.HEART.CIRCLE_RADIUS);
    g.fillCircle(TEXTURES.HEART.CIRCLE_2.x, TEXTURES.HEART.CIRCLE_2.y, TEXTURES.HEART.CIRCLE_RADIUS);
    g.fillTriangle(
      TEXTURES.HEART.TRIANGLE.x1,
      TEXTURES.HEART.TRIANGLE.y1,
      TEXTURES.HEART.TRIANGLE.x2,
      TEXTURES.HEART.TRIANGLE.y2,
      TEXTURES.HEART.TRIANGLE.x3,
      TEXTURES.HEART.TRIANGLE.y3
    );
    g.generateTexture("heart_full", TEXTURES.HEART.SIZE, TEXTURES.HEART.SIZE);

    g.clear();
    g.lineStyle(TEXTURES.HEART.STROKE_WIDTH, TEXTURES.HEART.COLOR, TEXTURES.ALPHA_FULL);
    g.strokeCircle(TEXTURES.HEART.CIRCLE_1.x, TEXTURES.HEART.CIRCLE_1.y, TEXTURES.HEART.CIRCLE_RADIUS);
    g.strokeCircle(TEXTURES.HEART.CIRCLE_2.x, TEXTURES.HEART.CIRCLE_2.y, TEXTURES.HEART.CIRCLE_RADIUS);
    g.strokeTriangle(
      TEXTURES.HEART.TRIANGLE.x1,
      TEXTURES.HEART.TRIANGLE.y1,
      TEXTURES.HEART.TRIANGLE.x2,
      TEXTURES.HEART.TRIANGLE.y2,
      TEXTURES.HEART.TRIANGLE.x3,
      TEXTURES.HEART.TRIANGLE.y3
    );
    g.generateTexture("heart_empty", TEXTURES.HEART.SIZE, TEXTURES.HEART.SIZE);

    g.clear();
    g.lineStyle(TEXTURES.SPEECH_BUBBLE.STROKE_WIDTH, TEXTURES.SPEECH_BUBBLE.STROKE_COLOR, TEXTURES.ALPHA_FULL);
    g.fillStyle(TEXTURES.SPEECH_BUBBLE.FILL_COLOR, TEXTURES.ALPHA_FULL);
    g.fillRoundedRect(0, 0, TEXTURES.SPEECH_BUBBLE.WIDTH, TEXTURES.SPEECH_BUBBLE.HEIGHT, TEXTURES.SPEECH_BUBBLE.RADIUS);
    g.strokeRoundedRect(0, 0, TEXTURES.SPEECH_BUBBLE.WIDTH, TEXTURES.SPEECH_BUBBLE.HEIGHT, TEXTURES.SPEECH_BUBBLE.RADIUS);
    g.generateTexture("speech_bubble", TEXTURES.SPEECH_BUBBLE.WIDTH, TEXTURES.SPEECH_BUBBLE.HEIGHT);

    g.clear();
    g.fillStyle(TEXTURES.ARROW.BG_COLOR, TEXTURES.ALPHA_FULL);
    g.fillRect(0, 0, TEXTURES.ARROW.WIDTH, TEXTURES.ARROW.HEIGHT);
    g.fillStyle(TEXTURES.ARROW.FG_COLOR, TEXTURES.ALPHA_FULL);
    g.fillTriangle(
      TEXTURES.ARROW.RIGHT.x1,
      TEXTURES.ARROW.RIGHT.y1,
      TEXTURES.ARROW.RIGHT.x2,
      TEXTURES.ARROW.RIGHT.y2,
      TEXTURES.ARROW.RIGHT.x3,
      TEXTURES.ARROW.RIGHT.y3
    );
    g.generateTexture("arrow_right", TEXTURES.ARROW.WIDTH, TEXTURES.ARROW.HEIGHT);

    g.clear();
    g.fillStyle(TEXTURES.ARROW.BG_COLOR, TEXTURES.ALPHA_FULL);
    g.fillRect(0, 0, TEXTURES.ARROW.WIDTH, TEXTURES.ARROW.HEIGHT);
    g.fillStyle(TEXTURES.ARROW.FG_COLOR, TEXTURES.ALPHA_FULL);
    g.fillTriangle(
      TEXTURES.ARROW.LEFT.x1,
      TEXTURES.ARROW.LEFT.y1,
      TEXTURES.ARROW.LEFT.x2,
      TEXTURES.ARROW.LEFT.y2,
      TEXTURES.ARROW.LEFT.x3,
      TEXTURES.ARROW.LEFT.y3
    );
    g.generateTexture("arrow_left", TEXTURES.ARROW.WIDTH, TEXTURES.ARROW.HEIGHT);

    this.createJobFairBackgroundTexture(g);
    this.createCrispTrashTextures(g);
    this.createLevel2OrchardTextures(g);
  }

  private createHighResolutionTextureVariants(g: Phaser.GameObjects.Graphics): void {
    const highResRect = (key: string, w: number, h: number, fill: number, stroke?: number): void => {
      const textureScale = TEXTURES.HIGH_RES_SCALE;
      const scaledW = w * textureScale;
      const scaledH = h * textureScale;
      g.clear();
      if (stroke !== undefined) {
        g.lineStyle(TEXTURES.RECT_STROKE_WIDTH * textureScale, stroke, TEXTURES.RECT_STROKE_ALPHA);
      }
      g.fillStyle(fill, TEXTURES.ALPHA_FULL);
      g.fillRect(0, 0, scaledW, scaledH);
      if (stroke !== undefined) {
        g.strokeRect(0, 0, scaledW, scaledH);
      }
      g.generateTexture(`${key}-smooth`, scaledW, scaledH);
    };

    for (const key of ["cube", "slot", "platform"]) {
      const def = TEXTURES.RECTS.find((rectDef) => rectDef.key === key);
      if (def) {
        highResRect(def.key, def.w, def.h, def.fill, def.stroke);
      }
    }
  }

  private createJobFairBackgroundTexture(g: Phaser.GameObjects.Graphics): void {
    const topColor = Phaser.Display.Color.ValueToColor(0x102332);
    const bottomColor = Phaser.Display.Color.ValueToColor(0x224962);
    const bands = 54;

    g.clear();
    for (let i = 0; i < bands; i += 1) {
      const blend = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(blend.r, blend.g, blend.b), 1);
      const y = Math.floor((i / bands) * BASE_HEIGHT);
      const h = Math.ceil(BASE_HEIGHT / bands) + 1;
      g.fillRect(0, y, BASE_WIDTH, h);
    }

    for (let i = 0; i < 26; i += 1) {
      const x = Phaser.Math.Between(0, BASE_WIDTH);
      const y = Phaser.Math.Between(0, BASE_HEIGHT);
      const radius = Phaser.Math.Between(38, 120);
      const alpha = Phaser.Math.FloatBetween(0.03, 0.08);
      g.fillStyle(0xf8fafc, alpha);
      g.fillCircle(x, y, radius);
    }

    g.fillStyle(0x0b1722, 0.28);
    g.fillRect(0, Math.round(BASE_HEIGHT * 0.7), BASE_WIDTH, Math.round(BASE_HEIGHT * 0.3));

    g.fillStyle(0xffffff, 0.08);
    for (let i = 0; i < 14; i += 1) {
      const laneY = Math.round((BASE_HEIGHT * 0.14) + i * (BASE_HEIGHT * 0.05));
      g.fillRect(0, laneY, BASE_WIDTH, 2);
    }

    g.generateTexture("job-fair-bg", BASE_WIDTH, BASE_HEIGHT);
  }

  private createCrispTrashTextures(g: Phaser.GameObjects.Graphics): void {
    const size = 128;
    const bodyX = 24;
    const bodyY = 26;
    const bodyW = 80;
    const bodyH = 92;
    const lidH = 14;
    const stripeW = 8;
    const stripeGap = 7;

    const drawBaseBin = (isFull: boolean): void => {
      g.clear();
      g.fillStyle(0x0f1722, 1);
      g.fillRoundedRect(bodyX, bodyY + lidH, bodyW, bodyH - lidH, 8);
      g.lineStyle(3, 0x94a3b8, 1);
      g.strokeRoundedRect(bodyX, bodyY + lidH, bodyW, bodyH - lidH, 8);

      g.fillStyle(0x1f2937, 1);
      g.fillRoundedRect(bodyX - 4, bodyY, bodyW + 8, lidH, 6);
      g.lineStyle(2, 0xe2e8f0, 0.9);
      g.strokeRoundedRect(bodyX - 4, bodyY, bodyW + 8, lidH, 6);

      g.fillStyle(0x334155, 1);
      for (let i = 0; i < 6; i += 1) {
        const x = bodyX + 8 + i * (stripeW + stripeGap);
        g.fillRect(x, bodyY + lidH + 8, stripeW, bodyH - lidH - 16);
      }

      if (!isFull) {
        return;
      }

      g.fillStyle(0xf8fafc, 1);
      g.fillRect(bodyX + 18, bodyY + 4, 18, 12);
      g.fillRect(bodyX + 44, bodyY + 2, 22, 14);
      g.fillRect(bodyX + 70, bodyY + 5, 14, 11);
      g.lineStyle(1, 0x94a3b8, 0.9);
      g.strokeRect(bodyX + 18, bodyY + 4, 18, 12);
      g.strokeRect(bodyX + 44, bodyY + 2, 22, 14);
      g.strokeRect(bodyX + 70, bodyY + 5, 14, 11);
    };

    drawBaseBin(false);
    g.generateTexture("trash-empty-crisp", size, size);
    drawBaseBin(true);
    g.generateTexture("trash-full-crisp", size, size);
  }

  private createLevel2OrchardTextures(g: Phaser.GameObjects.Graphics): void {
    const scale = TEXTURES.HIGH_RES_SCALE;
    const leafW = 34 * scale;
    const leafH = 26 * scale;

    g.clear();
    g.fillStyle(0x1f7a52, 1);
    g.fillEllipse(leafW * 0.5, leafH * 0.54, leafW * 0.82, leafH * 0.72);
    g.fillStyle(0x7bd774, 1);
    g.fillEllipse(leafW * 0.43, leafH * 0.42, leafW * 0.48, leafH * 0.36);
    g.fillStyle(0xffd166, 0.9);
    g.fillCircle(leafW * 0.58, leafH * 0.53, leafH * 0.25);
    g.lineStyle(2 * scale, 0x0f3d32, 1);
    g.strokeEllipse(leafW * 0.5, leafH * 0.54, leafW * 0.82, leafH * 0.72);
    g.lineStyle(1 * scale, 0xeaf7bf, 0.65);
    g.lineBetween(leafW * 0.18, leafH * 0.62, leafW * 0.78, leafH * 0.38);
    g.lineStyle(2 * scale, 0x6b3f1d, 1);
    g.lineBetween(leafW * 0.12, leafH * 0.67, leafW * 0.28, leafH * 0.58);
    g.generateTexture("leaf-token-smooth", leafW, leafH);

    g.clear();
    g.lineStyle(3 * scale, 0x8fe388, 0.95);
    g.fillStyle(0x10251f, 0.58);
    g.fillEllipse(leafW * 0.5, leafH * 0.54, leafW * 0.88, leafH * 0.78);
    g.strokeEllipse(leafW * 0.5, leafH * 0.54, leafW * 0.88, leafH * 0.78);
    g.lineStyle(1 * scale, 0x4ade80, 0.42);
    g.lineBetween(leafW * 0.18, leafH * 0.62, leafW * 0.82, leafH * 0.38);
    g.generateTexture("leaf-slot-smooth", leafW, leafH);

    const bugSize = 24 * scale;
    g.clear();
    g.fillStyle(0x111827, 1);
    g.fillEllipse(bugSize * 0.5, bugSize * 0.54, bugSize * 0.56, bugSize * 0.48);
    g.fillStyle(0xef4444, 1);
    g.fillCircle(bugSize * 0.38, bugSize * 0.42, 3 * scale);
    g.fillCircle(bugSize * 0.62, bugSize * 0.42, 3 * scale);
    g.lineStyle(2 * scale, 0xfacc15, 1);
    for (const side of [-1, 1]) {
      g.lineBetween(bugSize * 0.5, bugSize * 0.52, bugSize * (0.5 + side * 0.34), bugSize * 0.35);
      g.lineBetween(bugSize * 0.5, bugSize * 0.58, bugSize * (0.5 + side * 0.36), bugSize * 0.68);
    }
    g.generateTexture("bst-bug-smooth", bugSize, bugSize);

    const nullW = 46 * scale;
    const nullH = 18 * scale;
    g.clear();
    g.fillStyle(0x221833, 0.92);
    g.fillRoundedRect(0, 0, nullW, nullH, 5 * scale);
    g.lineStyle(2 * scale, 0xc084fc, 1);
    g.strokeRoundedRect(0, 0, nullW, nullH, 5 * scale);
    g.fillStyle(0xf5d0fe, 1);
    g.fillTriangle(nullW * 0.74, nullH * 0.18, nullW * 0.95, nullH * 0.5, nullW * 0.74, nullH * 0.82);
    g.lineStyle(2 * scale, 0xf5d0fe, 1);
    g.lineBetween(nullW * 0.14, nullH * 0.5, nullW * 0.78, nullH * 0.5);
    g.generateTexture("null-pointer-smooth", nullW, nullH);
  }

  private applyTextureFilter(): void {
    const textures = this.textures.list as Record<string, Phaser.Textures.Texture>;
    for (const key of Object.keys(textures)) {
      textures[key].setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }

  private createAudio(): void {
    const ctx = this.sound.context;
    const makeTone = (freq: number, duration: number, volume: number): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const env = 1 - i / length;
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
      }
      return buffer;
    };

    const add = (key: string, freq: number, duration: number, volume: number): void => {
      this.cache.audio.add(key, makeTone(freq, duration, volume));
    };

    for (const tone of AUDIO_TONES.SFX) {
      add(tone.key, tone.freq, tone.duration, tone.volume);
    }

    const makeLoop = (freq: number): AudioBuffer => makeTone(freq, AUDIO_TONES.MUSIC.LOOP_DURATION, AUDIO_TONES.MUSIC.LOOP_VOLUME);
    const makeMenuLoop = (): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const duration = 4.8;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const notes = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 392.0];
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const step = Math.floor(t / 0.6) % notes.length;
        const local = t % 0.6;
        const env = Math.min(1, local * 10) * Math.exp(-local * 1.8);
        const base = notes[step];
        const melody = Math.sin(2 * Math.PI * base * t) * env * 0.16;
        const harmony = Math.sin(2 * Math.PI * (base * 0.5) * t) * 0.055;
        const pad = Math.sin(2 * Math.PI * 130.81 * t) * 0.045 + Math.sin(2 * Math.PI * 196.0 * t) * 0.03;
        data[i] = (melody + harmony + pad) * AUDIO_TONES.MUSIC.LOOP_VOLUME;
      }
      return buffer;
    };
    const makeActionLoop = (): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const duration = 1.6;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const beatInterval = 0.2;
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const beat = t % beatInterval;
        const kick = Math.sin(2 * Math.PI * (95 - beat * 220) * t) * Math.exp(-beat * 26);
        const hat = (Math.random() * 2 - 1) * Math.exp(-beat * 34) * 0.28;
        const bass = Math.sin(2 * Math.PI * 110 * t) * 0.32 + Math.sin(2 * Math.PI * 165 * t) * 0.18;
        const leadGate = Math.floor(t / 0.1) % 3 === 0 ? 1 : 0.42;
        const lead = Math.sin(2 * Math.PI * 440 * t) * leadGate * 0.12;
        data[i] = (kick * 0.42 + hat + bass + lead) * AUDIO_TONES.MUSIC.LOOP_VOLUME;
      }
      return buffer;
    };
    const makeLevel4RaceLoop = (): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const duration = 1.28;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const notes = [329.63, 392.0, 493.88, 587.33, 493.88, 440.0, 392.0, 523.25];
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const beat = t % 0.16;
        const step = Math.floor(t / 0.16) % notes.length;
        const gate = Math.exp(-beat * 18);
        const kickBeat = t % 0.32;
        const kick = Math.sin(2 * Math.PI * (105 - kickBeat * 210) * t) * Math.exp(-kickBeat * 32) * 0.45;
        const bass = Math.sin(2 * Math.PI * 130.81 * t) * 0.22 + Math.sin(2 * Math.PI * 196.0 * t) * 0.12;
        const lead = Math.sin(2 * Math.PI * notes[step] * t) * gate * 0.2;
        const pulse = Math.sin(2 * Math.PI * notes[(step + 2) % notes.length] * t) * gate * 0.08;
        const hat = (Math.random() * 2 - 1) * Math.exp(-beat * 45) * 0.12;
        data[i] = (kick + bass + lead + pulse + hat) * AUDIO_TONES.MUSIC.LOOP_VOLUME;
      }
      return buffer;
    };
    const makeFairLoop = (): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const duration = 1.92;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const chord = [261.63, 329.63, 392.0, 523.25];
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const beat = t % 0.24;
        const beatGate = Math.exp(-beat * 18);
        const chordIndex = Math.floor(t / 0.48) % chord.length;
        const base = chord[chordIndex];
        const pluck = Math.sin(2 * Math.PI * base * t) * beatGate * 0.22;
        const harmony = Math.sin(2 * Math.PI * base * 1.5 * t) * beatGate * 0.11;
        const bellGate = Math.exp(-(t % 0.96) * 8);
        const bell = Math.sin(2 * Math.PI * 784 * t) * bellGate * 0.08;
        const shaker = (Math.random() * 2 - 1) * Math.exp(beat * -34) * 0.07;
        data[i] = (pluck + harmony + bell + shaker) * AUDIO_TONES.MUSIC.LOOP_VOLUME;
      }
      return buffer;
    };
    this.cache.audio.add("music-menu", makeMenuLoop());
    this.cache.audio.add("music-level1-fair", makeFairLoop());
    this.cache.audio.add("music-gameplay", makeLoop(AUDIO_TONES.MUSIC.GAMEPLAY_FREQ));
    this.cache.audio.add("music-level3-action", makeActionLoop());
    this.cache.audio.add("music-level4-race", makeLevel4RaceLoop());
    this.cache.audio.add("music-boss", makeLoop(AUDIO_TONES.MUSIC.BOSS_FREQ));
  }
}

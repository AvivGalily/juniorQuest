import Phaser from "phaser";
import { AUDIO_TONES, NPCS, PRELOAD, TEXTURES } from "../../config/physics";
import { createDialogText } from "../utils/domText";

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
    this.load.image("trash-empty", new URL(`${envBase}tresh-empty.png`, import.meta.url).href);
    this.load.image("trash-full", new URL(`${envBase}tresh-full.png`, import.meta.url).href);
  }

  create(): void {
    createDialogText(this, this.scale.width / 2, this.scale.height / 2, "Loading...", {
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
    this.cache.audio.add("music-menu", makeLoop(AUDIO_TONES.MUSIC.MENU_FREQ));
    this.cache.audio.add("music-gameplay", makeLoop(AUDIO_TONES.MUSIC.GAMEPLAY_FREQ));
    this.cache.audio.add("music-boss", makeLoop(AUDIO_TONES.MUSIC.BOSS_FREQ));
  }
}

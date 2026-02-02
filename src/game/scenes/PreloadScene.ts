import Phaser from "phaser";
import { createDialogText } from "../utils/domText";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const playerBase = "../entities/player/img/";
    this.load.image("player-walk-slow-left", new URL(`${playerBase}player-walk-slow-left.png`, import.meta.url).href);
    this.load.image("player-walk-fast-left", new URL(`${playerBase}player-walk-fast-left.png`, import.meta.url).href);
    this.load.image("player-walk-slow-right", new URL(`${playerBase}player-walk-slow-right.png`, import.meta.url).href);
    this.load.image("player-walk-fast-right", new URL(`${playerBase}player-walk-fast-right.png`, import.meta.url).href);
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

    const npcBase = "../entities/npc/img/";
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
    loadNpc(1, true);
    loadNpc(2, true);
    loadNpc(3, false);

    const envBase = "../img/";
    this.load.image("both1", new URL(`${envBase}both1.png`, import.meta.url).href);
    this.load.image("both2", new URL(`${envBase}both2.png`, import.meta.url).href);
    this.load.image("trash-empty", new URL(`${envBase}tresh-empty.png`, import.meta.url).href);
    this.load.image("trash-full", new URL(`${envBase}tresh-full.png`, import.meta.url).href);
  }

  create(): void {
    createDialogText(this, this.scale.width / 2, this.scale.height / 2, "Loading...", {
      maxWidth: 200,
      fontSize: 16,
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
        g.lineStyle(2, stroke, 1);
      }
      g.fillStyle(fill, 1);
      g.fillRect(0, 0, w, h);
      if (stroke !== undefined) {
        g.strokeRect(0, 0, w, h);
      }
      g.generateTexture(key, w, h);
    };

    rect("rival", 16, 18, 0xffb347, 0x5a3b16);
    rect("boss", 48, 30, 0x7b65ff, 0x2a1c4a);
    rect("snake_node", 20, 12, 0x8be0e0, 0x1d4a4a);
    rect("cube", 22, 22, 0x9fa8ff, 0x2c3160);
    rect("slot", 26, 26, 0x000000, 0x6b7280);
    rect("button", 120, 28, 0x1f2a33, 0x6b7280);
    rect("notice_board", 100, 36, 0x2b3037, 0x6b7280);
    rect("platform", 64, 12, 0x35424d, 0x111822);
    rect("projectile", 10, 6, 0xffd166, 0x6b4d00);
    rect("bug", 8, 8, 0x7ed957, 0x254b2c);
    rect("cv", 10, 12, 0xf5f5f5, 0x222222);

    g.clear();
    g.fillStyle(0x3498db, 1);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x2b82b8, 1);
    g.fillRect(0, 12, 16, 4);
    g.generateTexture("water", 16, 16);

    g.clear();
    g.fillStyle(0xff4d6d, 1);
    g.fillCircle(4, 4, 3);
    g.fillCircle(8, 4, 3);
    g.fillTriangle(1, 5, 11, 5, 6, 11);
    g.generateTexture("heart_full", 12, 12);

    g.clear();
    g.lineStyle(1, 0xff4d6d, 1);
    g.strokeCircle(4, 4, 3);
    g.strokeCircle(8, 4, 3);
    g.strokeTriangle(1, 5, 11, 5, 6, 11);
    g.generateTexture("heart_empty", 12, 12);

    g.clear();
    g.lineStyle(2, 0x1c1c1c, 1);
    g.fillStyle(0xf9f7f7, 1);
    g.fillRoundedRect(0, 0, 220, 70, 8);
    g.strokeRoundedRect(0, 0, 220, 70, 8);
    g.generateTexture("speech_bubble", 220, 70);

    g.clear();
    g.fillStyle(0x1b1f24, 1);
    g.fillRect(0, 0, 10, 6);
    g.fillStyle(0x42d9f5, 1);
    g.fillTriangle(0, 3, 10, 0, 10, 6);
    g.generateTexture("arrow_right", 10, 6);

    g.clear();
    g.fillStyle(0x1b1f24, 1);
    g.fillRect(0, 0, 10, 6);
    g.fillStyle(0x42d9f5, 1);
    g.fillTriangle(10, 3, 0, 0, 0, 6);
    g.generateTexture("arrow_left", 10, 6);
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

    add("sfx-select", 520, 0.08, 0.4);
    add("sfx-confirm", 620, 0.1, 0.4);
    add("sfx-hit", 180, 0.18, 0.6);
    add("sfx-success", 760, 0.12, 0.5);
    add("sfx-level-complete", 820, 0.18, 0.5);
    add("sfx-gameover", 120, 0.3, 0.5);
    add("sfx-phase", 660, 0.2, 0.5);

    const makeLoop = (freq: number): AudioBuffer => makeTone(freq, 1.2, 0.2);
    this.cache.audio.add("music-menu", makeLoop(220));
    this.cache.audio.add("music-gameplay", makeLoop(180));
    this.cache.audio.add("music-boss", makeLoop(260));
  }
}

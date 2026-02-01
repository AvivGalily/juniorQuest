import Phaser from "phaser";
import { createDialogText } from "../utils/domText";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const base = "../entities/player/img/";
    this.load.image("player-left-stand", new URL(`${base}player-left-stand.png`, import.meta.url).href);
    this.load.image("player-left-walk", new URL(`${base}player-left-walk.png`, import.meta.url).href);
    this.load.image("player-left-up", new URL(`${base}player-left-up.png`, import.meta.url).href);
    this.load.image("player-right-stand", new URL(`${base}player-right-stand.png`, import.meta.url).href);
    this.load.image("player-right-walk", new URL(`${base}player-right-walk.png`, import.meta.url).href);
    this.load.image("player-right-up", new URL(`${base}player-right-up.png`, import.meta.url).href);
  }

  create(): void {
    createDialogText(this, 320, 180, "Loading...", {
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

    rect("player", 16, 20, 0x52d273, 0x1e3d2b);
    rect("recruiter", 14, 18, 0x5aa7ff, 0x1c2e4a);
    // Guard 2-frame + facing variants (simple generated art).
    const guardTex = (key: string, facing: "left" | "right", walk: boolean): void => {
      g.clear();
      g.fillStyle(0xff5d5d, 1);
      g.fillRect(0, 0, 16, 20);
      g.lineStyle(2, 0x4a1c1c, 1);
      g.strokeRect(0, 0, 16, 20);

      // Helmet visor (shows facing).
      g.fillStyle(0x0f172a, 1);
      g.fillRect(facing === "left" ? 2 : 10, 4, 4, 4);

      // Footstep marker (very small walk cue).
      g.fillStyle(0x4a1c1c, 1);
      g.fillRect(walk ? (facing === "left" ? 3 : 9) : 6, 18, 4, 2);

      g.generateTexture(key, 16, 20);
    };
    guardTex("guard-left-stand", "left", false);
    guardTex("guard-left-walk", "left", true);
    guardTex("guard-right-stand", "right", false);
    guardTex("guard-right-walk", "right", true);
    // Keep the old key for backwards compatibility (unused by the new Guard class).
    rect("guard", 16, 20, 0xff5d5d, 0x4a1c1c);
    rect("rival", 16, 18, 0xffb347, 0x5a3b16);
    rect("boss", 48, 30, 0x7b65ff, 0x2a1c4a);
    rect("snake_node", 20, 12, 0x8be0e0, 0x1d4a4a);
    rect("cube", 22, 22, 0x9fa8ff, 0x2c3160);
    rect("slot", 26, 26, 0x000000, 0x6b7280);
    rect("button", 120, 28, 0x1f2a33, 0x6b7280);
    rect("notice_board", 100, 36, 0x2b3037, 0x6b7280);
    rect("booth", 40, 26, 0x22303b, 0x45525c);
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

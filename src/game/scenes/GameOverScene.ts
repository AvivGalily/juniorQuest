import Phaser from "phaser";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText } from "../utils/domText";

export class GameOverScene extends Phaser.Scene {
  private audio!: AudioManager;

  constructor() {
    super("GameOverScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playSfx("sfx-gameover", 0.6);
    this.audio.playMusic("music-menu", 0.2);

    this.add.rectangle(320, 180, 640, 360, 0x101317);
    createDialogText(this, 320, 120, "GAME OVER", { maxWidth: 260, fontSize: 28, color: "#ff6b6b" });

    createDialogText(this, 320, 160, `Score: ${runState.runScore}`, { maxWidth: 220, fontSize: 16, color: "#e8eef2" });

    const btn = this.add.image(320, 220, "button").setInteractive();
    createDialogText(this, 320, 220, "Back to Menu", { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

    btn.on("pointerdown", () => {
      this.audio.playSfx("sfx-confirm", 0.6);
      this.scene.start("MenuScene");
    });
  }
}

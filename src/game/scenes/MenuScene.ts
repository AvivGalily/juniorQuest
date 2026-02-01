import Phaser from "phaser";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText } from "../utils/domText";

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  private modal?: { panel: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", 0.25);

    this.add.rectangle(320, 180, 640, 360, 0x121821);
    createDialogText(this, 320, 80, "Junior Quest", { maxWidth: 360, fontSize: 28, color: "#ffd166" });

    createDialogText(this, 320, 112, "The Job Hunt", { maxWidth: 260, fontSize: 16, color: "#9aa7b1" });

    this.createButton(320, 170, "Start Game", true, () => {
      this.startGame();
    });

    this.createButton(320, 210, "About", false, () => this.showModal("Coming soon"));
    this.createButton(320, 250, "Leaderboard", false, () => this.showModal("Coming soon"));

    createDialogText(this, 320, 320, "WASD / Arrows to move. Space or click to confirm.", {
      maxWidth: 420,
      fontSize: 14,
      color: "#9aa7b1"
    });

    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
  }

  private startGame(): void {
    this.audio.playSfx("sfx-confirm", 0.6);
    runState.resetRun();
    this.scene.start("Level1Scene");
  }

  private createButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void): void {
    const btn = this.add.image(x, y, "button").setInteractive();
    btn.setAlpha(enabled ? 1 : 0.6);
    const text = createDialogText(this, x, y, label, { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

    btn.on("pointerover", () => {
      if (enabled) {
        btn.setTint(0x334155);
      }
    });
    btn.on("pointerout", () => btn.clearTint());

    btn.on("pointerdown", () => {
      this.audio.playSfx("sfx-select", 0.5);
      onClick();
    });
  }

  private showModal(message: string): void {
    if (this.modal) {
      this.modal.panel.destroy();
      this.modal.text.destroy();
      this.modal = undefined;
    }
    const panel = this.add.image(320, 180, "speech_bubble");
    const text = createDialogText(this, 320, 180, message, {
      maxWidth: 220,
      fontSize: 16,
      color: "#1b1f24",
      padding: "6px 8px"
    });
    this.modal = { panel, text };
    this.time.delayedCall(1200, () => {
      if (this.modal) {
        this.modal.panel.destroy();
        this.modal.text.destroy();
        this.modal = undefined;
      }
    });
  }
}

import Phaser from "phaser";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText } from "../utils/domText";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  private modal?: { panel: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", 0.25);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x121821);
    createDialogText(this, scaleX(320), scaleY(80), "Junior Quest", { maxWidth: 360, fontSize: 28, color: "#ffd166" });

    createDialogText(this, scaleX(320), scaleY(112), "The Job Hunt", { maxWidth: 260, fontSize: 16, color: "#9aa7b1" });

    this.createButton(scaleX(320), scaleY(170), "Start Game", true, () => {
      this.startGame();
    });

    this.createButton(scaleX(320), scaleY(210), "About", false, () => this.showModal("Coming soon"));
    this.createButton(scaleX(320), scaleY(250), "Leaderboard", false, () => this.showModal("Coming soon"));

    createDialogText(this, scaleX(320), scaleY(320), "WASD / Arrows to move. Space or click to confirm.", {
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
    btn.setScale(getUiScale());
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
    const panel = this.add.image(this.scale.width / 2, this.scale.height / 2, "speech_bubble");
    panel.setScale(getUiScale());
    const text = createDialogText(this, this.scale.width / 2, this.scale.height / 2, message, {
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

import Phaser from "phaser";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { addLeaderboardEntry, loadLeaderboard, LeaderboardEntry } from "../systems/SaveSystem";
import { createDialogText, setDomText } from "../utils/domText";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class VictoryScene extends Phaser.Scene {
  private audio!: AudioManager;
  private leaderboardText?: Phaser.GameObjects.Text;
  private submitted = false;

  constructor() {
    super("VictoryScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", 0.25);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0f141b);
    createDialogText(this, scaleX(320), scaleY(60), "Victory", { maxWidth: 220, fontSize: 26, color: "#8fe388" });

    createDialogText(this, scaleX(320), scaleY(92), "Congrats on the new job! But the company shut down.", {
      maxWidth: 420,
      fontSize: 14,
      color: "#e8eef2"
    });

    createDialogText(this, scaleX(320), scaleY(112), "Good luck searching.", { maxWidth: 200, fontSize: 14, color: "#e8eef2" });

    createDialogText(this, scaleX(320), scaleY(140), `Final Score: ${runState.runScore}`, {
      maxWidth: 260,
      fontSize: 16,
      color: "#ffd166"
    });

    const uiScale = getUiScale();
    const inputStyle = `width:${Math.round(120 * uiScale)}px; padding:${Math.round(4 * uiScale)}px; font-size:${Math.round(
      12 * uiScale
    )}px; text-transform:uppercase; background:#111; color:#e8eef2; border:1px solid #374151;`;
    const input = this.add.dom(scaleX(320), scaleY(165), "input", inputStyle) as Phaser.GameObjects.DOMElement;
    const inputNode = input.node as HTMLInputElement;
    inputNode.setAttribute("maxlength", "10");
    inputNode.placeholder = "NAME";

    inputNode.addEventListener("input", () => {
      inputNode.value = inputNode.value.replace(/[^A-Za-z0-9\u0590-\u05FF]/g, "").toUpperCase();
    });

    const submitBtn = this.add.image(scaleX(320), scaleY(198), "button").setInteractive();
    submitBtn.setScale(uiScale);
    createDialogText(this, scaleX(320), scaleY(198), "Submit Score", { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

    const submitScore = (): void => {
      if (this.submitted) {
        return;
      }
      this.submitted = true;
      const name = inputNode.value.trim() || "ANON";
      const entries = addLeaderboardEntry(name, runState.runScore);
      this.refreshLeaderboard(entries);
      this.audio.playSfx("sfx-success", 0.6);
    };

    submitBtn.on("pointerdown", submitScore);
    this.input.keyboard.on("keydown-ENTER", submitScore);

    const backBtn = this.add.image(scaleX(320), scaleY(316), "button").setInteractive();
    backBtn.setScale(uiScale);
    createDialogText(this, scaleX(320), scaleY(316), "Back to Menu", { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

    backBtn.on("pointerdown", () => {
      this.scene.start("MenuScene");
    });

    this.refreshLeaderboard(loadLeaderboard().entries);
  }

  private refreshLeaderboard(entries: LeaderboardEntry[]): void {
    const lines = entries.slice(0, 8).map((entry, index) => {
      return `${index + 1}. ${entry.name} - ${entry.score}`;
    });
    const body = lines.length > 0 ? lines.join("\n") : "No local scores yet";
    if (this.leaderboardText) {
      setDomText(this.leaderboardText, body);
      return;
    }
    this.leaderboardText = createDialogText(this, scaleX(40), scaleY(220), body, {
      maxWidth: 240,
      fontSize: 13,
      color: "#9aa7b1",
      align: "left",
      originX: 0,
      originY: 0
    });
  }
}

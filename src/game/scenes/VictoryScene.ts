import Phaser from "phaser";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { addLeaderboardEntry, loadLeaderboard, LeaderboardEntry } from "../systems/SaveSystem";
import { createDialogText, setDomText } from "../utils/domText";

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

    this.add.rectangle(320, 180, 640, 360, 0x0f141b);
    createDialogText(this, 320, 60, "Victory", { maxWidth: 220, fontSize: 26, color: "#8fe388" });

    createDialogText(this, 320, 92, "Congrats on the new job! But the company shut down.", {
      maxWidth: 420,
      fontSize: 14,
      color: "#e8eef2"
    });

    createDialogText(this, 320, 112, "Good luck searching.", { maxWidth: 200, fontSize: 14, color: "#e8eef2" });

    createDialogText(this, 320, 140, `Final Score: ${runState.runScore}`, {
      maxWidth: 260,
      fontSize: 16,
      color: "#ffd166"
    });

    const input = this.add.dom(320, 165, "input", "width:120px; padding:4px; font-size:12px; text-transform:uppercase; background:#111; color:#e8eef2; border:1px solid #374151;") as Phaser.GameObjects.DOMElement;
    const inputNode = input.node as HTMLInputElement;
    inputNode.setAttribute("maxlength", "10");
    inputNode.placeholder = "NAME";

    inputNode.addEventListener("input", () => {
      inputNode.value = inputNode.value.replace(/[^A-Za-z0-9\u0590-\u05FF]/g, "").toUpperCase();
    });

    const submitBtn = this.add.image(320, 198, "button").setInteractive();
    createDialogText(this, 320, 198, "Submit Score", { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

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

    const backBtn = this.add.image(320, 316, "button").setInteractive();
    createDialogText(this, 320, 316, "Back to Menu", { maxWidth: 200, fontSize: 16, color: "#e8eef2" });

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
    this.leaderboardText = createDialogText(this, 40, 220, body, {
      maxWidth: 240,
      fontSize: 13,
      color: "#9aa7b1",
      align: "left",
      originX: 0,
      originY: 0
    });
  }
}

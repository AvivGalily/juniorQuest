import Phaser from "phaser";
import { runState } from "../RunState";
import { createDialogText, setDomText } from "../utils/domText";

export class UIHud {
  private scene: Phaser.Scene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private scoreText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private stageText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, stageNumber: number) {
    this.scene = scene;
    const topY = 10;
    const rightX = scene.scale.width - 8;

    for (let i = 0; i < 3; i += 1) {
      const heart = scene.add.image(rightX - i * 18, topY, "heart_full").setScrollFactor(0).setDepth(1000);
      this.hearts.push(heart);
    }

    this.stageText = createDialogText(scene, 320, 8, `Stage ${stageNumber}/5`, {
      maxWidth: 200,
      fontSize: 14,
      color: "#e8eef2",
      align: "center",
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.scoreText = createDialogText(scene, rightX, 28, "SCORE 0", {
      maxWidth: 160,
      fontSize: 14,
      color: "#e8eef2",
      align: "right",
      originX: 1,
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.comboText = createDialogText(scene, rightX, 44, "FLOW x1.0", {
      maxWidth: 160,
      fontSize: 13,
      color: "#8fe388",
      align: "right",
      originX: 1,
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.timerText = createDialogText(scene, rightX, 60, "TIME 0", {
      maxWidth: 160,
      fontSize: 12,
      color: "#9aa7b1",
      align: "right",
      originX: 1,
      originY: 0
    }).setScrollFactor(0).setDepth(1000);
  }

  updateHearts(): void {
    for (let i = 0; i < this.hearts.length; i += 1) {
      const texture = i < runState.hearts ? "heart_full" : "heart_empty";
      this.hearts[i].setTexture(texture);
    }
  }

  updateAll(): void {
    this.updateHearts();
    setDomText(this.scoreText, `SCORE ${runState.runScore}`);
    const mult = 1 + Math.min(runState.comboSteps, 8) * 0.1;
    setDomText(this.comboText, `FLOW x${mult.toFixed(1)}`);
    const elapsed = Math.floor((Date.now() - runState.levelStartTimeMs) / 1000);
    setDomText(this.timerText, `TIME ${elapsed}`);
  }
}

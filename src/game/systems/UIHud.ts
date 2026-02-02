import Phaser from "phaser";
import { runState } from "../RunState";
import { createDialogText, setDomText } from "../utils/domText";
import { getUiScale } from "../utils/resolution";

export class UIHud {
  private scene: Phaser.Scene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private scoreText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private stageText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, stageNumber: number) {
    this.scene = scene;
    const uiScale = getUiScale();
    const topY = 10 * uiScale;
    const rightX = scene.scale.width - 8 * uiScale;
    const heartSpacing = 18 * uiScale;

    for (let i = 0; i < 3; i += 1) {
      const heart = scene.add.image(rightX - i * heartSpacing, topY, "heart_full").setScrollFactor(0).setDepth(1000);
      heart.setScale(uiScale);
      this.hearts.push(heart);
    }

    this.stageText = createDialogText(scene, scene.scale.width / 2, 8 * uiScale, `Stage ${stageNumber}/5`, {
      maxWidth: 200,
      fontSize: 14,
      color: "#e8eef2",
      align: "center",
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.scoreText = createDialogText(scene, rightX, 28 * uiScale, "SCORE 0", {
      maxWidth: 160,
      fontSize: 14,
      color: "#e8eef2",
      align: "right",
      originX: 1,
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.comboText = createDialogText(scene, rightX, 44 * uiScale, "FLOW x1.0", {
      maxWidth: 160,
      fontSize: 13,
      color: "#8fe388",
      align: "right",
      originX: 1,
      originY: 0
    }).setScrollFactor(0).setDepth(1000);

    this.timerText = createDialogText(scene, rightX, 60 * uiScale, "TIME 0", {
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

import Phaser from "phaser";
import { COMBO, DEPTH, DOM_TEXT, HUD, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { createTranslatedText, setTranslatedText } from "../utils/domText";
import { getUiScale } from "../utils/resolution";

export class UIHud {
  private scene: Phaser.Scene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private readonly heartTopY: number;
  private readonly heartRightX: number;
  private readonly heartSpacing: number;
  private readonly uiScale: number;
  private scoreText: Phaser.GameObjects.DOMElement;
  private comboText: Phaser.GameObjects.DOMElement;
  private timerText: Phaser.GameObjects.DOMElement;

  constructor(scene: Phaser.Scene, _stageNumber: number) {
    this.scene = scene;
    const uiScale = getUiScale();
    this.uiScale = uiScale;
    this.heartTopY = HUD.TOP_Y * uiScale;
    this.heartRightX = scene.scale.width - HUD.RIGHT_X_OFFSET * uiScale;
    this.heartSpacing = HUD.HEART_SPACING * uiScale;

    for (let i = 0; i < HUD.HEART_COUNT; i += 1) {
      this.addHeartSlot(i);
    }

    this.scoreText = createTranslatedText(scene, this.heartRightX, HUD.SCORE_Y * uiScale, "hud.score", {
      params: { score: 0 },
      maxWidth: HUD.SCORE_MAX_WIDTH,
      fontSize: HUD.SCORE_FONT_SIZE,
      color: "#e8eef2",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.comboText = createTranslatedText(scene, this.heartRightX, HUD.COMBO_Y * uiScale, "hud.flow", {
      params: { mult: "1.0" },
      maxWidth: HUD.COMBO_MAX_WIDTH,
      fontSize: HUD.COMBO_FONT_SIZE,
      color: "#8fe388",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.timerText = createTranslatedText(scene, this.heartRightX, HUD.TIMER_Y * uiScale, "hud.time", {
      params: { seconds: 0 },
      maxWidth: HUD.TIMER_MAX_WIDTH,
      fontSize: HUD.TIMER_FONT_SIZE,
      color: "#9aa7b1",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);
  }

  private addHeartSlot(index: number): void {
    const heart = this.scene.add
      .image(this.heartRightX - index * this.heartSpacing, this.heartTopY, "heart_full")
      .setScrollFactor(0)
      .setDepth(DEPTH.HUD);
    heart.setScale(this.uiScale);
    this.hearts.push(heart);
  }

  updateHearts(): void {
    while (this.hearts.length < Math.max(HUD.HEART_COUNT, runState.hearts)) {
      this.addHeartSlot(this.hearts.length);
    }
    for (let i = 0; i < this.hearts.length; i += 1) {
      const texture = i < runState.hearts ? "heart_full" : "heart_empty";
      this.hearts[i].setTexture(texture);
    }
  }

  updateAll(): void {
    this.updateHearts();
    setTranslatedText(this.scoreText, "hud.score", { score: runState.runScore });
    const mult = COMBO.BASE_MULTIPLIER + Math.min(runState.comboSteps, COMBO.MAX_STEPS) * COMBO.STEP_MULTIPLIER;
    setTranslatedText(this.comboText, "hud.flow", { mult: mult.toFixed(COMBO.DISPLAY_DECIMALS) });
    const elapsed = Math.floor((Date.now() - runState.levelStartTimeMs) / TIME.MS_PER_SEC);
    setTranslatedText(this.timerText, "hud.time", { seconds: elapsed });
  }
}

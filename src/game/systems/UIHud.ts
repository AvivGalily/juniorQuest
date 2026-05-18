import Phaser from "phaser";
import { COMBO, DEPTH, DOM_TEXT, HUD, RUN, TIME } from "../../config/physics";
import { runState } from "../RunState";
import { createTranslatedText, setTranslatedText } from "../utils/domText";
import { getUiScale } from "../utils/resolution";

export class UIHud {
  private scene: Phaser.Scene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private scoreText: Phaser.GameObjects.DOMElement;
  private comboText: Phaser.GameObjects.DOMElement;
  private stageText: Phaser.GameObjects.DOMElement;
  private timerText: Phaser.GameObjects.DOMElement;

  constructor(scene: Phaser.Scene, stageNumber: number) {
    this.scene = scene;
    const uiScale = getUiScale();
    const topY = HUD.TOP_Y * uiScale;
    const rightX = scene.scale.width - HUD.RIGHT_X_OFFSET * uiScale;
    const heartSpacing = HUD.HEART_SPACING * uiScale;

    for (let i = 0; i < HUD.HEART_COUNT; i += 1) {
      const heart = scene.add.image(rightX - i * heartSpacing, topY, "heart_full").setScrollFactor(0).setDepth(DEPTH.HUD);
      heart.setScale(uiScale);
      this.hearts.push(heart);
    }

    this.stageText = createTranslatedText(
      scene,
      scene.scale.width / 2,
      HUD.STAGE_Y * uiScale,
      "hud.stage",
      {
      params: { current: stageNumber, total: RUN.TOTAL_LEVELS },
      maxWidth: HUD.STAGE_MAX_WIDTH,
      fontSize: HUD.STAGE_FONT_SIZE,
      color: "#e8eef2",
      align: "center",
      originY: DOM_TEXT.ORIGIN_TOP
      }
    ).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.scoreText = createTranslatedText(scene, rightX, HUD.SCORE_Y * uiScale, "hud.score", {
      params: { score: 0 },
      maxWidth: HUD.SCORE_MAX_WIDTH,
      fontSize: HUD.SCORE_FONT_SIZE,
      color: "#e8eef2",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.comboText = createTranslatedText(scene, rightX, HUD.COMBO_Y * uiScale, "hud.flow", {
      params: { mult: "1.0" },
      maxWidth: HUD.COMBO_MAX_WIDTH,
      fontSize: HUD.COMBO_FONT_SIZE,
      color: "#8fe388",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.timerText = createTranslatedText(scene, rightX, HUD.TIMER_Y * uiScale, "hud.time", {
      params: { seconds: 0 },
      maxWidth: HUD.TIMER_MAX_WIDTH,
      fontSize: HUD.TIMER_FONT_SIZE,
      color: "#9aa7b1",
      align: "right",
      originX: DOM_TEXT.ORIGIN_RIGHT,
      originY: DOM_TEXT.ORIGIN_TOP
    }).setScrollFactor(0).setDepth(DEPTH.HUD);
  }

  updateHearts(): void {
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

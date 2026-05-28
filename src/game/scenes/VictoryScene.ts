import Phaser from "phaser";
import { AUDIO, LEADERBOARD, VICTORY } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { addLeaderboardEntry } from "../systems/SaveSystem";
import { createTranslatedText } from "../utils/domText";
import { configureGameTextInput } from "../utils/domInput";
import { t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class VictoryScene extends Phaser.Scene {
  private audio!: AudioManager;
  private submitStatusText?: Phaser.GameObjects.DOMElement;
  private submitted = false;

  constructor() {
    super("VictoryScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-victory", AUDIO.MUSIC.VICTORY);

    this.add.image(this.scale.width / 2, this.scale.height / 2, "victory-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, VICTORY.BG_COLOR, 0.58);
    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.TITLE_Y), "victory.title", {
      maxWidth: VICTORY.TITLE_MAX_WIDTH,
      fontSize: VICTORY.TITLE_FONT_SIZE,
      color: "#8fe388",
      originY: 0
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.BLURB_Y), "victory.blurb", {
      maxWidth: VICTORY.BLURB_MAX_WIDTH,
      fontSize: VICTORY.BLURB_FONT_SIZE,
      color: "#e8eef2",
      originY: 0
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SUBTITLE_Y), "victory.subtitle", {
      maxWidth: VICTORY.SUBTITLE_MAX_WIDTH,
      fontSize: VICTORY.SUBTITLE_FONT_SIZE,
      color: "#e8eef2",
      originY: 0
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SCORE_Y), "common.finalScore", {
      params: { score: runState.runScore },
      maxWidth: VICTORY.SCORE_MAX_WIDTH,
      fontSize: VICTORY.SCORE_FONT_SIZE,
      color: "#ffd166",
      originY: 0
    });

    const uiScale = getUiScale();
    const inputStyle = `width:${Math.round(VICTORY.INPUT_WIDTH * uiScale)}px; padding:${Math.round(
      VICTORY.INPUT_PADDING_Y * uiScale
    )}px ${Math.round(VICTORY.INPUT_PADDING_X * uiScale)}px; font-size:${Math.round(
      VICTORY.INPUT_FONT_SIZE * uiScale
    )}px; text-transform:uppercase; background:#111; color:#e8eef2; border:${VICTORY.INPUT_BORDER_WIDTH}px solid #374151;`;
    const input = this.add.dom(scaleX(VICTORY.TITLE_X), scaleY(VICTORY.INPUT_Y), "input", inputStyle) as Phaser.GameObjects.DOMElement;
    const inputNode = input.node as HTMLInputElement;
    inputNode.setAttribute("maxlength", String(LEADERBOARD.NAME_MAX_LEN));
    inputNode.placeholder = t("victory.namePlaceholder");

    inputNode.addEventListener("input", () => {
      inputNode.value = inputNode.value.replace(/[^A-Za-z0-9\u0590-\u05FF]/g, "").toUpperCase();
    });

    const submitBtn = this.add.image(scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SUBMIT_Y), "button").setInteractive();
    submitBtn.setScale(uiScale);
    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SUBMIT_Y), "victory.submitScore", {
      maxWidth: VICTORY.BUTTON_MAX_WIDTH,
      fontSize: VICTORY.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    const submitScore = async (): Promise<void> => {
      if (this.submitted) {
        return;
      }
      this.submitted = true;
      const name = inputNode.value.trim() || t("victory.defaultName");
      inputNode.disabled = true;
      try {
        await addLeaderboardEntry(name, runState.runScore);
        this.submitStatusText?.destroy();
        this.submitStatusText = createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.LEADERBOARD_Y), "victory.saved", {
          maxWidth: VICTORY.SCORE_MAX_WIDTH,
          fontSize: VICTORY.LEADERBOARD_FONT_SIZE,
          color: "#8fe388",
          align: "center"
        });
        this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS);
      } catch {
        this.submitted = false;
        inputNode.disabled = false;
        inputNode.focus();
        this.submitStatusText?.destroy();
        this.submitStatusText = createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.LEADERBOARD_Y), "victory.saveFailed", {
          maxWidth: VICTORY.SCORE_MAX_WIDTH,
          fontSize: VICTORY.LEADERBOARD_FONT_SIZE,
          color: "#ff6b6b",
          align: "center"
        });
        this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
      }
    };
    configureGameTextInput(inputNode, { onEnter: () => void submitScore() });

    submitBtn.on("pointerdown", () => void submitScore());

    const backBtn = this.add.image(scaleX(VICTORY.TITLE_X), scaleY(VICTORY.BACK_Y), "button").setInteractive();
    backBtn.setScale(uiScale);
    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.BACK_Y), "common.backToMenu", {
      maxWidth: VICTORY.BUTTON_MAX_WIDTH,
      fontSize: VICTORY.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    backBtn.on("pointerdown", () => {
      this.scene.start("MenuScene");
    });
  }
}

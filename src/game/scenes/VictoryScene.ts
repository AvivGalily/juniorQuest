import Phaser from "phaser";
import { AUDIO, DOM_TEXT, LEADERBOARD, VICTORY } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { addLeaderboardEntry, loadLeaderboard, LeaderboardEntry } from "../systems/SaveSystem";
import { createTranslatedText, setDomText } from "../utils/domText";
import { t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class VictoryScene extends Phaser.Scene {
  private audio!: AudioManager;
  private leaderboardText?: Phaser.GameObjects.DOMElement;
  private submitted = false;

  constructor() {
    super("VictoryScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, VICTORY.BG_COLOR);
    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.TITLE_Y), "victory.title", {
      maxWidth: VICTORY.TITLE_MAX_WIDTH,
      fontSize: VICTORY.TITLE_FONT_SIZE,
      color: "#8fe388"
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.BLURB_Y), "victory.blurb", {
      maxWidth: VICTORY.BLURB_MAX_WIDTH,
      fontSize: VICTORY.BLURB_FONT_SIZE,
      color: "#e8eef2"
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SUBTITLE_Y), "victory.subtitle", {
      maxWidth: VICTORY.SUBTITLE_MAX_WIDTH,
      fontSize: VICTORY.SUBTITLE_FONT_SIZE,
      color: "#e8eef2"
    });

    createTranslatedText(this, scaleX(VICTORY.TITLE_X), scaleY(VICTORY.SCORE_Y), "common.finalScore", {
      params: { score: runState.runScore },
      maxWidth: VICTORY.SCORE_MAX_WIDTH,
      fontSize: VICTORY.SCORE_FONT_SIZE,
      color: "#ffd166"
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

    const submitScore = (): void => {
      if (this.submitted) {
        return;
      }
      this.submitted = true;
      const name = inputNode.value.trim() || t("victory.defaultName");
      const entries = addLeaderboardEntry(name, runState.runScore);
      this.refreshLeaderboard(entries);
      this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS);
    };

    submitBtn.on("pointerdown", submitScore);
    this.input.keyboard.on("keydown-ENTER", submitScore);

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

    this.refreshLeaderboard(loadLeaderboard().entries);
  }

  private refreshLeaderboard(entries: LeaderboardEntry[]): void {
    const lines = entries.slice(0, LEADERBOARD.DISPLAY_COUNT).map((entry, index) => {
      return `${index + 1}. ${entry.name} - ${entry.score}`;
    });
    const body = lines.length > 0 ? lines.join("\n") : t("victory.noScores");
    if (this.leaderboardText) {
      setDomText(this.leaderboardText, body);
      return;
    }
    this.leaderboardText = createTranslatedText(this, scaleX(VICTORY.LEADERBOARD_X), scaleY(VICTORY.LEADERBOARD_Y), "victory.noScores", {
      maxWidth: VICTORY.LEADERBOARD_MAX_WIDTH,
      fontSize: VICTORY.LEADERBOARD_FONT_SIZE,
      color: "#9aa7b1",
      align: "left",
      originX: DOM_TEXT.ORIGIN_LEFT,
      originY: DOM_TEXT.ORIGIN_TOP
    });
    setDomText(this.leaderboardText, body);
  }
}

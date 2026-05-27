import Phaser from "phaser";
import { AUDIO, GAME_OVER, LEADERBOARD } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { addLeaderboardEntry } from "../systems/SaveSystem";
import { createTranslatedText } from "../utils/domText";
import { t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";
import { getDirection } from "../i18n/i18n";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class GameOverScene extends Phaser.Scene {
  private audio!: AudioManager;
  private submitStatusText?: Phaser.GameObjects.DOMElement;
  private rejectionEmail?: Phaser.GameObjects.DOMElement;
  private rejectionContinueZone?: Phaser.GameObjects.Zone;
  private submitted = false;
  private emailDismissed = false;

  constructor() {
    super("GameOverScene");
  }

  create(): void {
    this.submitted = false;
    this.emailDismissed = false;
    this.submitStatusText = undefined;
    this.rejectionEmail = undefined;
    this.rejectionContinueZone = undefined;
    this.input.enabled = true;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupRejectionEmail, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupRejectionEmail, this);
    this.removeStaleDomText();
    this.stopPreviousLevelScenes();
    this.audio = new AudioManager(this);
    this.audio.playSfx("sfx-gameover", AUDIO.SFX.GAME_OVER);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU_LOW);

    this.showRejectionEmail();
  }

  private showScoreboard(): void {
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, GAME_OVER.BG_COLOR);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, scaleX(520), scaleY(318), 0x020617, 0.68)
      .setStrokeStyle(scaleX(2), 0x64748b, 0.68);

    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.TITLE_Y), "gameOver.title", {
      maxWidth: GAME_OVER.TITLE_MAX_WIDTH,
      fontSize: GAME_OVER.TITLE_FONT_SIZE,
      color: "#ff6b6b"
    });

    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.BLURB_Y), "gameOver.blurb", {
      maxWidth: GAME_OVER.BLURB_MAX_WIDTH,
      fontSize: GAME_OVER.BLURB_FONT_SIZE,
      color: "#cbd5e1"
    });

    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SCORE_Y), "common.score", {
      params: { score: runState.runScore },
      maxWidth: GAME_OVER.SCORE_MAX_WIDTH,
      fontSize: GAME_OVER.SCORE_FONT_SIZE,
      color: "#e8eef2"
    });

    const uiScale = getUiScale();
    const inputStyle = `width:${Math.round(GAME_OVER.INPUT_WIDTH * uiScale)}px; padding:${Math.round(
      GAME_OVER.INPUT_PADDING_Y * uiScale
    )}px ${Math.round(GAME_OVER.INPUT_PADDING_X * uiScale)}px; font-size:${Math.round(
      GAME_OVER.INPUT_FONT_SIZE * uiScale
    )}px; text-transform:uppercase; background:#111827; color:#e8eef2; border:${GAME_OVER.INPUT_BORDER_WIDTH}px solid #475569;`;
    const input = this.add.dom(scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.INPUT_Y), "input", inputStyle) as Phaser.GameObjects.DOMElement;
    const inputNode = input.node as HTMLInputElement;
    inputNode.setAttribute("maxlength", String(LEADERBOARD.NAME_MAX_LEN));
    inputNode.placeholder = t("victory.namePlaceholder");
    inputNode.addEventListener("input", () => {
      inputNode.value = inputNode.value.replace(/[^A-Za-z0-9\u0590-\u05FF]/g, "").toUpperCase();
    });

    const submitBtn = this.add.image(scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SUBMIT_Y), "button").setInteractive();
    submitBtn.setScale(uiScale);
    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SUBMIT_Y), "gameOver.saveScore", {
      maxWidth: GAME_OVER.BUTTON_MAX_WIDTH,
      fontSize: GAME_OVER.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    const submitScore = async (): Promise<void> => {
      if (this.submitted) {
        return;
      }
      this.submitted = true;
      const name = inputNode.value.trim() || t("victory.defaultName");
      inputNode.disabled = true;
      await addLeaderboardEntry(name, runState.runScore);
      this.submitStatusText?.destroy();
      this.submitStatusText = createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.LEADERBOARD_Y), "gameOver.saved", {
        maxWidth: GAME_OVER.SCORE_MAX_WIDTH,
        fontSize: GAME_OVER.LEADERBOARD_FONT_SIZE,
        color: "#8fe388",
        align: "center"
      });
      this.audio.playSfx("sfx-success", AUDIO.SFX.SUCCESS);
    };
    submitBtn.on("pointerdown", () => void submitScore());
    this.input.keyboard?.on("keydown-ENTER", () => void submitScore());

    const skipBtn = this.add.image(scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SKIP_Y), "button").setInteractive();
    skipBtn.setScale(uiScale);
    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SKIP_Y), "gameOver.skipSave", {
      maxWidth: GAME_OVER.BUTTON_MAX_WIDTH,
      fontSize: GAME_OVER.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    skipBtn.on("pointerdown", () => {
      this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT);
      this.scene.start("MenuScene");
    });

    const btn = this.add.image(scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.BUTTON_Y), "button").setInteractive();
    btn.setScale(uiScale);
    createTranslatedText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.BUTTON_Y), "common.backToMenu", {
      maxWidth: GAME_OVER.BUTTON_MAX_WIDTH,
      fontSize: GAME_OVER.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    btn.on("pointerdown", () => {
      this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
      this.scene.start("MenuScene");
    });
  }

  private showRejectionEmail(): void {
    this.add.image(this.scale.width / 2, this.scale.height / 2, "level1-job-fair-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 0.64);
    this.createRejectionEmailCard();
    this.input.keyboard?.once("keydown-X", () => this.continueToScoreboard());
  }

  private createRejectionEmailCard(): void {
    const recruiterSrc = new URL("../img/recruiter-linkedin-avatar.png", import.meta.url).href;
    const cardW = Math.round(scaleX(548));
    const cardH = Math.round(scaleY(318));
    const headerH = Math.round(scaleY(42));
    const pad = Math.round(scaleX(24));
    const smallFont = Math.round(scaleY(10));
    const bodyFont = Math.round(scaleY(10.1));
    const subjectFont = Math.round(scaleY(12.2));
    const ctaFont = Math.round(scaleY(12));
    const direction = getDirection();
    const textAlign = direction === "rtl" ? "right" : "left";

    const html = `
      <div data-game-over-rejection-email="true" style="
        width:${cardW}px;
        height:${cardH}px;
        box-sizing:border-box;
        overflow:hidden;
        background:#f8fafc;
        border:6px solid #1f2937;
        box-shadow:${Math.round(scaleX(8))}px ${Math.round(scaleY(10))}px 0 rgba(2, 6, 23, 0.45);
        font-family:'Courier New', Courier, monospace;
        color:#1e293b;
        direction:${direction};
      ">
        <div style="
          height:${headerH}px;
          background:#102332;
          color:#e8eef2;
          display:flex;
          align-items:center;
          justify-content:space-between;
          box-sizing:border-box;
          padding:0 ${pad}px;
          direction:ltr;
          font-size:${smallFont}px;
          font-weight:700;
        ">
          <span>${escapeHtml(t("rejectionEmail.appTitle"))}</span>
          <span style="display:flex;gap:${Math.round(scaleX(5))}px;">
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#ef4444;display:block;"></i>
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#facc15;display:block;"></i>
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#22c55e;display:block;"></i>
          </span>
        </div>
        <div style="
          height:${cardH - headerH}px;
          box-sizing:border-box;
          padding:${Math.round(scaleY(13))}px ${pad}px ${Math.round(scaleY(12))}px ${pad}px;
          display:flex;
          flex-direction:column;
          gap:${Math.round(scaleY(7))}px;
        ">
          <div style="
            display:grid;
            grid-template-columns:${Math.round(scaleX(58))}px 1fr;
            column-gap:${Math.round(scaleX(14))}px;
            align-items:center;
            direction:ltr;
          ">
            <div style="
              width:${Math.round(scaleX(46))}px;
              height:${Math.round(scaleY(46))}px;
              border-radius:50%;
              overflow:hidden;
              background:#dbeafe;
              border:3px solid #38bdf8;
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <img src="${recruiterSrc}" alt="" style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
                border-radius:50%;
              " />
            </div>
            <div style="direction:${direction};text-align:${textAlign};font-size:${smallFont}px;line-height:1.35;color:#475569;font-weight:700;overflow:hidden;">
              <div>${escapeHtml(t("rejectionEmail.from"))}</div>
              <div>${escapeHtml(t("rejectionEmail.to"))}</div>
            </div>
          </div>
          <div style="height:3px;background:#cbd5e1;"></div>
          <div style="
            font-size:${subjectFont}px;
            line-height:1.2;
            color:#0f172a;
            font-weight:800;
            text-align:${textAlign};
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">${escapeHtml(t("rejectionEmail.subject"))}</div>
          <div style="height:3px;background:#e2e8f0;"></div>
          <div style="
            flex:1;
            min-height:0;
            overflow:hidden;
            font-size:${bodyFont}px;
            line-height:1.24;
            color:#1e293b;
            font-weight:700;
            text-align:${textAlign};
          ">
            <p style="margin:0 0 ${Math.round(scaleY(8))}px 0;">${escapeHtml(t("rejectionEmail.body1"))}</p>
            <p style="margin:0 0 ${Math.round(scaleY(8))}px 0;">${escapeHtml(t("rejectionEmail.body2"))}</p>
            <p style="margin:0;">${escapeHtml(t("rejectionEmail.body3"))}</p>
          </div>
          <div data-action="continue" style="
            height:${Math.round(scaleY(30))}px;
            flex:0 0 ${Math.round(scaleY(30))}px;
            box-sizing:border-box;
            border:3px solid #38bdf8;
            background:#e0f2fe;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#0f172a;
            font-size:${ctaFont}px;
            font-weight:800;
            text-align:center;
            cursor:pointer;
          ">${escapeHtml(t("rejectionEmail.continue"))}</div>
        </div>
      </div>
    `;

    const card = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html).setOrigin(0.5);
    this.rejectionEmail = card;
    card.addListener("click");
    card.on("click", (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action='continue']")) {
        this.continueToScoreboard();
      }
    });

    const ctaH = Math.round(scaleY(30));
    this.rejectionContinueZone = this.add
      .zone(this.scale.width / 2, this.scale.height / 2 + cardH / 2 - Math.round(scaleY(12)) - ctaH / 2, cardW - pad * 2, ctaH)
      .setInteractive({ useHandCursor: true })
      .setDepth(10000)
      .on("pointerdown", () => this.continueToScoreboard());
  }

  private continueToScoreboard(): void {
    if (this.emailDismissed) {
      return;
    }
    this.emailDismissed = true;
    this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
    this.cleanupRejectionEmail();
    this.children.removeAll(true);
    this.showScoreboard();
  }

  private cleanupRejectionEmail(): void {
    this.rejectionEmail?.destroy();
    this.rejectionContinueZone?.destroy();
    this.rejectionEmail = undefined;
    this.rejectionContinueZone = undefined;
    document.querySelectorAll<HTMLElement>("[data-game-over-rejection-email='true']").forEach((node) => {
      node.remove();
    });
  }

  private stopPreviousLevelScenes(): void {
    for (const key of ["Level1Scene", "Level2Scene", "Level3Scene", "Level4Scene", "Level5Scene"]) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) {
        this.scene.stop(key);
      }
    }
  }

  private removeStaleDomText(): void {
    document.querySelectorAll<HTMLElement>("[data-junior-quest-dom-text='true']").forEach((node) => {
      node.remove();
    });
  }
}

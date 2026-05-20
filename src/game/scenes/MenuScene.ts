import Phaser from "phaser";
import { AUDIO, MENU, RUN, STAGE } from "../../config/physics";
import { Level2IntroScene } from "./Level2IntroScene";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText, createTranslatedText, setDomText } from "../utils/domText";
import { t, toggleLocale } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  private modal?: { panel: Phaser.GameObjects.Image; text: Phaser.GameObjects.DOMElement };
  private selectedLevel = RUN.DEFAULT_LEVEL;
  private levelButtonLabel?: Phaser.GameObjects.DOMElement;

  constructor() {
    super("MenuScene");
  }

  init(data?: { selectedLevel?: number }): void {
    if (typeof data?.selectedLevel === "number") {
      this.selectedLevel = Phaser.Math.Clamp(Math.round(data.selectedLevel), RUN.DEFAULT_LEVEL, RUN.TOTAL_LEVELS);
    }
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio.stopMusic("music-menu");
    });

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, MENU.BG_COLOR);
    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(MENU.TITLE_Y), "menu.title", {
      maxWidth: MENU.TITLE_MAX_WIDTH,
      fontSize: MENU.TITLE_FONT_SIZE,
      color: "#ffd166"
    });

    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(MENU.SUBTITLE_Y), "menu.subtitle", {
      maxWidth: MENU.SUBTITLE_MAX_WIDTH,
      fontSize: MENU.SUBTITLE_FONT_SIZE,
      color: "#9aa7b1"
    });

    this.createButton(scaleX(MENU.TITLE_X), scaleY(MENU.START_BUTTON_Y), t("menu.startGame"), true, () => {
      this.startGame();
    });

    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(MENU.LEVEL_LABEL_Y), "menu.selectLevel", {
      maxWidth: MENU.BUTTON_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#9aa7b1"
    });
    const levelButton = this.createButton(
      scaleX(MENU.TITLE_X),
      scaleY(MENU.LEVEL_SELECT_Y),
      this.getLevelButtonLabel(),
      true,
      () => this.cycleSelectedLevel()
    );
    this.levelButtonLabel = levelButton.text;

    this.createButton(scaleX(MENU.TITLE_X), scaleY(MENU.ABOUT_BUTTON_Y), t("menu.about"), false, () => this.showModal("menu.comingSoon"));
    this.createButton(
      scaleX(MENU.TITLE_X),
      scaleY(MENU.LEADERBOARD_BUTTON_Y),
      t("menu.leaderboard"),
      false,
      () => this.showModal("menu.comingSoon")
    );

    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(MENU.FOOTER_Y), "menu.footer", {
      maxWidth: MENU.FOOTER_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#9aa7b1"
    });

    this.createLanguageButton();

    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
  }

  private startGame(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
    this.audio.stopMusic("music-menu");
    runState.resetRun();
    const level = Math.min(Math.max(this.selectedLevel, RUN.DEFAULT_LEVEL), RUN.TOTAL_LEVELS);
    this.scene.start(this.getLevelStartScene(level));
  }

  private getLevelStartScene(level: number): string {
    if (level === STAGE.LEVEL1) {
      return "Level1IntroScene";
    }
    if (level === STAGE.LEVEL2) {
      if (!this.scene.get("Level2IntroScene")) {
        this.scene.add("Level2IntroScene", Level2IntroScene, false);
      }
      return "Level2IntroScene";
    }
    if (level === STAGE.LEVEL3) {
      return "Level3IntroScene";
    }
    if (level === STAGE.LEVEL4) {
      return "Level4IntroScene";
    }
    return `Level${level}Scene`;
  }

  private cycleSelectedLevel(): void {
    const next = this.selectedLevel + 1;
    this.selectedLevel = next > RUN.TOTAL_LEVELS ? RUN.DEFAULT_LEVEL : next;
    if (this.levelButtonLabel) {
      setDomText(this.levelButtonLabel, this.getLevelButtonLabel());
    }
  }

  private getLevelButtonLabel(): string {
    return t("menu.level", { level: this.selectedLevel });
  }

  private createLanguageButton(): void {
    const x = scaleX(560);
    const y = scaleY(42);
    const radius = scaleX(15);
    const hit = this.add.rectangle(x, y, scaleX(82), scaleY(32), 0x1f2937, 0.88).setInteractive({ useHandCursor: true });
    hit.setStrokeStyle(scaleX(1), 0x38bdf8, 0.75);

    const globe = this.add.graphics();
    globe.lineStyle(scaleX(1), 0x9bdcff, 1);
    globe.strokeCircle(x - scaleX(22), y, radius * 0.58);
    globe.lineBetween(x - scaleX(22) - radius * 0.58, y, x - scaleX(22) + radius * 0.58, y);
    globe.strokeEllipse(x - scaleX(22), y, radius * 0.5, radius * 1.16);
    globe.strokeEllipse(x - scaleX(22), y, radius * 1.16, radius * 0.5);

    createTranslatedText(this, x + scaleX(12), y, "menu.languageButton", {
      maxWidth: 38,
      fontSize: 13,
      color: "#e8eef2",
      weight: 800,
      direction: "ltr"
    });

    hit.on("pointerdown", () => {
      this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT);
      toggleLocale();
      this.scene.restart({ selectedLevel: this.selectedLevel });
    });
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void
  ): { button: Phaser.GameObjects.Image; text: Phaser.GameObjects.DOMElement } {
    const btn = this.add.image(x, y, "button").setInteractive();
    btn.setScale(getUiScale());
    btn.setAlpha(enabled ? MENU.BUTTON_ALPHA_ENABLED : MENU.BUTTON_ALPHA_DISABLED);
    const text = createDialogText(this, x, y, label, {
      maxWidth: MENU.BUTTON_MAX_WIDTH,
      fontSize: MENU.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    btn.on("pointerover", () => {
      if (enabled) {
        btn.setTint(MENU.BUTTON_HOVER_TINT);
      }
    });
    btn.on("pointerout", () => btn.clearTint());

    btn.on("pointerdown", () => {
      this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT);
      onClick();
    });

    return { button: btn, text };
  }

private showModal(messageKey: string): void {
  if (this.modal) {
    this.modal.bg?.destroy();
    this.modal.panel.destroy();
    this.modal.text.destroy();
    this.modal = undefined;
  }

  const x = this.scale.width / 2;
  const y = this.scale.height / 2;
  const depth = 9999;

const bg = this.add.rectangle(
  x,
  y,
  this.scale.width,
  220,
  0xffffff,
  1
);

  bg.setDepth(depth);

  const panel = this.add.image(x, y, "speech_bubble");
  panel.setScale(getUiScale());
  panel.setAlpha(1);
  panel.setDepth(depth + 1);

  const text = createTranslatedText(this, x, y, messageKey, {
    maxWidth: MENU.MODAL_MAX_WIDTH,
    fontSize: MENU.MODAL_FONT_SIZE,
    color: "#1b1f24",
    padding: `${MENU.MODAL_PADDING_Y}px ${MENU.MODAL_PADDING_X}px`
  });

  text.setDepth(depth + 2);

  this.modal = { bg, panel, text };

  this.time.delayedCall(MENU.MODAL_DURATION_MS, () => {
    if (this.modal) {
      this.modal.bg?.destroy();
      this.modal.panel.destroy();
      this.modal.text.destroy();
      this.modal = undefined;
    }
  });
}
}

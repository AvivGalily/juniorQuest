import Phaser from "phaser";
import { Difficulty, difficultyOrder } from "../../config/difficulty";
import { AUDIO, MENU, RUN, STAGE } from "../../config/physics";
import { Level2IntroScene } from "./Level2IntroScene";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText, createTranslatedText, setDomText } from "../utils/domText";
import { getLocale, t, toggleLocale } from "../i18n/i18n";
import { scale, scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

type MenuModal = {
  bg: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.DOMElement;
};

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  private modal?: MenuModal;
  private difficultyPopup?: { objects: Phaser.GameObjects.GameObject[] };
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
      this.closeDifficultyPopup();
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

    this.createButton(scaleX(MENU.TITLE_X), scaleY(150), t("menu.startGame"), true, () => {
      this.startGame();
    });

    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(190), "menu.selectLevel", {
      maxWidth: MENU.BUTTON_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#9aa7b1"
    });
    const levelButton = this.createButton(
      scaleX(MENU.TITLE_X),
      scaleY(214),
      this.getLevelButtonLabel(),
      true,
      () => this.cycleSelectedLevel()
    );
    this.levelButtonLabel = levelButton.text;

    this.createButton(scaleX(MENU.TITLE_X), scaleY(252), t("menu.difficulty"), true, () => this.showDifficultyPopup());
    this.createButton(
      scaleX(MENU.TITLE_X),
      scaleY(288),
      t("menu.leaderboard"),
      true,
      () => this.scene.start("LeaderboardScene")
    );
    this.createButton(scaleX(MENU.TITLE_X), scaleY(324), t("menu.about"), false, () => this.showModal("menu.comingSoon"));

    createTranslatedText(this, scaleX(MENU.TITLE_X), scaleY(MENU.FOOTER_Y), "menu.footer", {
      maxWidth: MENU.FOOTER_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#cbd5e1",
      weight: 700
    });

    this.createLanguageButton();

    this.input.keyboard.on("keydown-ENTER", () => {
      if (!this.difficultyPopup) {
        this.startGame();
      }
    });
    this.input.keyboard.on("keydown-SPACE", () => {
      if (!this.difficultyPopup) {
        this.startGame();
      }
    });
    this.input.keyboard.on("keydown-ESC", () => this.closeDifficultyPopup());
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
    if (level === STAGE.LEVEL5) {
      return "Level5IntroScene";
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
    const locale = getLocale();
    const flagKey = locale === "he" ? "flag-israel" : "flag-england";
    const hit = this.add.rectangle(x, y, scaleX(112), scaleY(34), 0x1f2937, 0.9).setInteractive({ useHandCursor: true });
    hit.setStrokeStyle(scaleX(1), 0x38bdf8, 0.75);

    this.add.image(x - scaleX(28), y, flagKey).setDisplaySize(scaleX(30), scaleY(20));

    createTranslatedText(this, x + scaleX(15), y, "menu.languageButton", {
      maxWidth: 54,
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

  private showDifficultyPopup(): void {
    this.closeDifficultyPopup();
    this.setMenuDomVisibility(false);
    const objects: Phaser.GameObjects.GameObject[] = [];
    const depth = 10000;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const overlay = this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x07111c, 1)
      .setInteractive({ useHandCursor: false })
      .setDepth(depth);
    overlay.on("pointerdown", () => this.closeDifficultyPopup());
    objects.push(overlay);

    objects.push(
      createTranslatedText(this, centerX, scaleY(44), "menu.difficultyTitle", {
        maxWidth: 360,
        fontSize: 20,
        color: "#fef08a",
        weight: 900
      }).setDepth(depth + 2)
    );

    const labels: Record<Difficulty, string> = {
      university: "menu.difficultyUniversity",
      college: "menu.difficultyCollege",
      bootcamp: "menu.difficultyBootcamp"
    };
    const rowY = [scaleY(112), scaleY(202), scaleY(292)];

    difficultyOrder.forEach((difficulty, index) => {
      const selected = runState.difficulty === difficulty;
      const y = rowY[index];
      const row = this.add
        .rectangle(centerX, y, scaleX(460), scaleY(76), selected ? 0x1e3a5f : 0x111827, 0.98)
        .setStrokeStyle(scale(2), selected ? 0x8fe388 : 0x475569, selected ? 0.95 : 0.72)
        .setInteractive({ useHandCursor: true })
        .setDepth(depth + 2);
      row.on("pointerover", () => row.setFillStyle(0x1f2937, 0.98));
      row.on("pointerout", () => row.setFillStyle(selected ? 0x1e3a5f : 0x111827, 0.94));
      row.on("pointerdown", () => {
        runState.setDifficulty(difficulty);
        this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
        this.closeDifficultyPopup();
      });
      objects.push(row);

      const icon = this.add
        .image(centerX - scaleX(170), y, `difficulty-${difficulty}`)
        .setDisplaySize(scaleX(64), scaleY(64))
        .setDepth(depth + 3);
      objects.push(icon);
      objects.push(
        createTranslatedText(this, centerX - scaleX(120), y - (selected ? scaleY(6) : 0), labels[difficulty], {
          maxWidth: 230,
          fontSize: 15,
          color: "#e8eef2",
          align: "left",
          originX: 0,
          weight: 800
        }).setDepth(depth + 3)
      );

      if (selected) {
        objects.push(
          createTranslatedText(this, centerX + scaleX(136), y + scaleY(18), "menu.difficultySelected", {
            maxWidth: 90,
            fontSize: 10,
            color: "#8fe388",
            weight: 800
          }).setDepth(depth + 3)
        );
      }
    });

    this.difficultyPopup = { objects };
  }

  private closeDifficultyPopup(): void {
    this.difficultyPopup?.objects.forEach((object) => object.destroy());
    this.difficultyPopup = undefined;
    this.setMenuDomVisibility(true);
  }

  private setMenuDomVisibility(visible: boolean): void {
    document.querySelectorAll<HTMLElement>("[data-scene-key='MenuScene']").forEach((node) => {
      node.style.visibility = visible ? "visible" : "hidden";
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

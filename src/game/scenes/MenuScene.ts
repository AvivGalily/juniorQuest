import Phaser from "phaser";
import { AUDIO, MATH, MENU, RUN } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText } from "../utils/domText";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  private modal?: { panel: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  private selectedLevel = RUN.DEFAULT_LEVEL;
  private levelSelect?: Phaser.GameObjects.DOMElement;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, MENU.BG_COLOR);
    createDialogText(this, scaleX(MENU.TITLE_X), scaleY(MENU.TITLE_Y), "Junior Quest", {
      maxWidth: MENU.TITLE_MAX_WIDTH,
      fontSize: MENU.TITLE_FONT_SIZE,
      color: "#ffd166"
    });

    createDialogText(this, scaleX(MENU.TITLE_X), scaleY(MENU.SUBTITLE_Y), "The Job Hunt", {
      maxWidth: MENU.SUBTITLE_MAX_WIDTH,
      fontSize: MENU.SUBTITLE_FONT_SIZE,
      color: "#9aa7b1"
    });

    this.createButton(scaleX(MENU.TITLE_X), scaleY(MENU.START_BUTTON_Y), "Start Game", true, () => {
      this.startGame();
    });

    createDialogText(this, scaleX(MENU.TITLE_X), scaleY(MENU.LEVEL_LABEL_Y), "Select Level", {
      maxWidth: MENU.BUTTON_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#9aa7b1"
    });
    this.createLevelSelect(scaleX(MENU.TITLE_X), scaleY(MENU.LEVEL_SELECT_Y));

    this.createButton(scaleX(MENU.TITLE_X), scaleY(MENU.ABOUT_BUTTON_Y), "About", false, () => this.showModal("Coming soon"));
    this.createButton(
      scaleX(MENU.TITLE_X),
      scaleY(MENU.LEADERBOARD_BUTTON_Y),
      "Leaderboard",
      false,
      () => this.showModal("Coming soon")
    );

    createDialogText(this, scaleX(MENU.TITLE_X), scaleY(MENU.FOOTER_Y), "WASD / Arrows to move. Space/Enter or click to confirm.", {
      maxWidth: MENU.FOOTER_MAX_WIDTH,
      fontSize: MENU.FOOTER_FONT_SIZE,
      color: "#9aa7b1"
    });

    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
  }

  private startGame(): void {
    this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
    runState.resetRun();
    const level = Math.min(Math.max(this.selectedLevel, RUN.DEFAULT_LEVEL), RUN.TOTAL_LEVELS);
    this.scene.start(`Level${level}Scene`);
  }

  private createLevelSelect(x: number, y: number): void {
    const uiScale = getUiScale();
    const style = [
      `width:${Math.round(MENU.SELECT_WIDTH * uiScale)}px`,
      `font-family:\"Courier New\", Courier, monospace`,
      `font-size:${Math.round(MENU.SELECT_FONT_SIZE * uiScale)}px`,
      `padding:${Math.round(MENU.SELECT_PADDING_Y * uiScale)}px ${Math.round(MENU.SELECT_PADDING_X * uiScale)}px`,
      "background:#1f2a33",
      "color:#e8eef2",
      `border:${MENU.SELECT_BORDER_WIDTH}px solid #6b7280`,
      `border-radius:${MENU.SELECT_BORDER_RADIUS}px`,
      "outline:none"
    ].join(";");
    const select = this.add.dom(x, y, "select", style);
    const node = select.node as HTMLSelectElement;
    node.style.pointerEvents = "auto";
    node.style.cursor = "pointer";
    for (let level = RUN.DEFAULT_LEVEL; level <= RUN.TOTAL_LEVELS; level += 1) {
      const option = document.createElement("option");
      option.value = `${level}`;
      option.text = `Level ${level}`;
      node.add(option);
    }
    node.value = `${this.selectedLevel}`;
    node.onchange = () => {
      this.selectedLevel = Number.parseInt(node.value, MATH.DECIMAL_RADIX);
    };
    this.levelSelect = select;
  }

  private createButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void): void {
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
  }

  private showModal(message: string): void {
    if (this.modal) {
      this.modal.panel.destroy();
      this.modal.text.destroy();
      this.modal = undefined;
    }
    const panel = this.add.image(this.scale.width / 2, this.scale.height / 2, "speech_bubble");
    panel.setScale(getUiScale());
    const text = createDialogText(this, this.scale.width / 2, this.scale.height / 2, message, {
      maxWidth: MENU.MODAL_MAX_WIDTH,
      fontSize: MENU.MODAL_FONT_SIZE,
      color: "#1b1f24",
      padding: `${MENU.MODAL_PADDING_Y}px ${MENU.MODAL_PADDING_X}px`
    });
    this.modal = { panel, text };
    this.time.delayedCall(MENU.MODAL_DURATION_MS, () => {
      if (this.modal) {
        this.modal.panel.destroy();
        this.modal.text.destroy();
        this.modal = undefined;
      }
    });
  }
}

import Phaser from "phaser";
import { AUDIO, GAME_OVER } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { createDialogText } from "../utils/domText";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

export class GameOverScene extends Phaser.Scene {
  private audio!: AudioManager;

  constructor() {
    super("GameOverScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playSfx("sfx-gameover", AUDIO.SFX.GAME_OVER);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU_LOW);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, GAME_OVER.BG_COLOR);
    createDialogText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.TITLE_Y), "GAME OVER", {
      maxWidth: GAME_OVER.TITLE_MAX_WIDTH,
      fontSize: GAME_OVER.TITLE_FONT_SIZE,
      color: "#ff6b6b"
    });

    createDialogText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.SCORE_Y), `Score: ${runState.runScore}`, {
      maxWidth: GAME_OVER.SCORE_MAX_WIDTH,
      fontSize: GAME_OVER.SCORE_FONT_SIZE,
      color: "#e8eef2"
    });

    const btn = this.add.image(scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.BUTTON_Y), "button").setInteractive();
    btn.setScale(getUiScale());
    createDialogText(this, scaleX(GAME_OVER.TITLE_X), scaleY(GAME_OVER.BUTTON_Y), "Back to Menu", {
      maxWidth: GAME_OVER.BUTTON_MAX_WIDTH,
      fontSize: GAME_OVER.BUTTON_FONT_SIZE,
      color: "#e8eef2"
    });

    btn.on("pointerdown", () => {
      this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
      this.scene.start("MenuScene");
    });
  }
}

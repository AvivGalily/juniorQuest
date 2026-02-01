import Phaser from "phaser";
import { runState } from "../RunState";
import { InputManager } from "../systems/InputManager";
import { AudioManager } from "../systems/AudioManager";
import { ComboSystem } from "../systems/ComboSystem";
import { ScoreSystem } from "../systems/ScoreSystem";
import { UIHud } from "../systems/UIHud";
import { flashTween } from "../utils/tween";
import { Player } from "../entities/player/Player";
import { createDialogText } from "../utils/domText";

export class BaseLevelScene extends Phaser.Scene {
  protected inputManager!: InputManager;
  protected audio!: AudioManager;
  protected comboSystem!: ComboSystem;
  protected scoreSystem!: ScoreSystem;
  protected hud!: UIHud;
  protected player?: Player;
  protected invulnerable = false;
  protected paused = false;
  private pauseText?: Phaser.GameObjects.Text;
  private lastEscPressMs = 0;
  private escDoubleWindowMs = 350;

  protected initLevel(stageNumber: number): void {
    runState.currentLevel = stageNumber;
    runState.resetLevel();
    this.inputManager = new InputManager(this);
    this.audio = new AudioManager(this);
    this.comboSystem = new ComboSystem();
    this.scoreSystem = new ScoreSystem(this.comboSystem);
    this.hud = new UIHud(this, stageNumber);
    this.hud.updateAll();
    this.createPauseOverlay();
  }

  protected setPlayer(player: Player): void {
    this.player = player;
  }

  protected handlePauseToggle(): void {
    if (!this.inputManager) {
      return;
    }
    if (this.inputManager.justPressedPause()) {
      const now = Date.now();
      if (now - this.lastEscPressMs <= this.escDoubleWindowMs) {
        this.scene.start("MenuScene");
        return;
      }
      this.lastEscPressMs = now;
      this.togglePause();
    }
  }

  protected togglePause(): void {
    this.paused = !this.paused;
    this.physics.world.isPaused = this.paused;
    this.time.timeScale = this.paused ? 0 : 1;
    if (this.pauseText) {
      this.pauseText.setVisible(this.paused);
    }
  }

  protected applyDamage(respawn?: () => void): void {
    if (this.invulnerable) {
      return;
    }
    runState.hearts -= 1;
    this.comboSystem.reset();
    this.audio.playSfx("sfx-hit", 0.6);
    if (this.player) {
      flashTween(this, this.player, 800);
    }
    this.invulnerable = true;
    this.time.delayedCall(800, () => {
      this.invulnerable = false;
    });
    if (respawn) {
      respawn();
    }
    if (runState.hearts <= 0) {
      this.scene.start("GameOverScene");
    }
  }

  protected createPauseOverlay(): void {
    this.pauseText = createDialogText(this, 320, 180, "PAUSED", {
      maxWidth: 200,
      fontSize: 20,
      color: "#ffd166"
    }).setScrollFactor(0).setDepth(1000).setVisible(false);
  }
}

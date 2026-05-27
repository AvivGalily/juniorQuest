import Phaser from "phaser";
import { AUDIO, BASE_LEVEL, DEPTH } from "../../config/physics";
import { runState } from "../RunState";
import { InputManager } from "../systems/InputManager";
import { VirtualGamepad } from "../systems/VirtualGamepad";
import { AudioManager } from "../systems/AudioManager";
import { ComboSystem } from "../systems/ComboSystem";
import { ScoreSystem } from "../systems/ScoreSystem";
import { UIHud } from "../systems/UIHud";
import { flashTween } from "../utils/tween";
import { Player } from "../entities/player/Player";
import { createTranslatedText } from "../utils/domText";

export class BaseLevelScene extends Phaser.Scene {
  protected inputManager!: InputManager;
  protected audio!: AudioManager;
  protected comboSystem!: ComboSystem;
  protected scoreSystem!: ScoreSystem;
  protected hud!: UIHud;
  protected player?: Player;
  protected invulnerable = false;
  protected paused = false;
  protected deathTransitioning = false;
  private pauseOverlayObjects: Phaser.GameObjects.GameObject[] = [];

  protected initLevel(stageNumber: number): void {
    this.paused = false;
    this.invulnerable = false;
    this.deathTransitioning = false;
    this.time.timeScale = 1;
    this.physics.world.isPaused = false;
    runState.currentLevel = stageNumber;
    runState.resetLevel();
    VirtualGamepad.setLayout(stageNumber === 1 || stageNumber === 5 ? "topdown" : "platformer");
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
    VirtualGamepad.updateState();
    if (!this.inputManager) {
      return;
    }
    if (this.inputManager.justPressedPause()) {
      if (this.paused) {
        this.setPaused(false);
        this.scene.start("MenuScene");
        return;
      }
      this.setPaused(true);
      return;
    }
    if (this.paused && Phaser.Input.Keyboard.JustDown(this.inputManager.keys.ENTER)) {
      this.setPaused(false);
    }
  }

  protected togglePause(): void {
    this.setPaused(!this.paused);
  }

  protected setPaused(paused: boolean): void {
    this.paused = paused;
    this.physics.world.isPaused = this.paused;
    this.time.timeScale = this.paused ? 0 : 1;
    this.pauseOverlayObjects.forEach((object) => object.setVisible(this.paused));
  }

  protected applyDamage(respawn?: () => void): boolean {
    if (this.invulnerable || this.deathTransitioning) {
      return false;
    }
    runState.hearts -= 1;
    this.comboSystem.reset();
    this.audio.playSfx("sfx-hit", AUDIO.SFX.HIT);
    if (runState.hearts <= 0) {
      this.deathTransitioning = true;
      this.input.enabled = false;
      this.startGameOverAfterPhysicsStep();
      return true;
    }
    if (this.player) {
      flashTween(this, this.player, BASE_LEVEL.FLASH_DURATION_MS);
    }
    this.invulnerable = true;
    this.time.delayedCall(BASE_LEVEL.INVULNERABLE_MS, () => {
      this.invulnerable = false;
    });
    if (respawn) {
      respawn();
    }
    return false;
  }

  private startGameOverAfterPhysicsStep(): void {
    const sourceSceneKey = this.sys.settings.key;
    let started = false;
    const startGameOver = (): void => {
      if (started || !this.scene.isActive(sourceSceneKey)) {
        return;
      }
      started = true;
      this.physics.world.isPaused = false;
      this.time.timeScale = 1;
      this.scene.start("GameOverScene");
    };

    window.setTimeout(startGameOver, 0);
    this.time.delayedCall(1, startGameOver);
  }

  protected createPauseOverlay(): void {
    this.pauseOverlayObjects.forEach((object) => object.destroy());
    this.pauseOverlayObjects = [];

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const panelWidth = 340;
    const panelHeight = 142;
    const buttonWidth = 252;
    const buttonHeight = 28;
    const baseDepth = DEPTH.PAUSE_OVERLAY + 50;

    const panel = this.add
      .rectangle(centerX, centerY, panelWidth, panelHeight, 0x0f172a, 0.94)
      .setStrokeStyle(2, 0x38bdf8, 0.95)
      .setScrollFactor(0)
      .setDepth(baseDepth)
      .setVisible(false);

    const title = createTranslatedText(this, centerX, centerY - 48, "common.paused", {
      maxWidth: BASE_LEVEL.PAUSE_MAX_WIDTH,
      fontSize: BASE_LEVEL.PAUSE_FONT_SIZE,
      color: "#ffd166",
      weight: 800
    })
      .setScrollFactor(0)
      .setDepth(baseDepth + 2)
      .setVisible(false);

    const exitButton = this.createPauseButton(centerX, centerY - 10, buttonWidth, buttonHeight, () => {
      if (!this.paused) {
        return;
      }
      this.setPaused(false);
      this.scene.start("MenuScene");
    });
    const exitLabel = createTranslatedText(this, centerX, centerY - 10, "common.pauseExit", {
      maxWidth: buttonWidth - 20,
      fontSize: 15,
      color: "#f8fafc",
      weight: 700
    })
      .setScrollFactor(0)
      .setDepth(baseDepth + 2)
      .setVisible(false);

    const continueButton = this.createPauseButton(centerX, centerY + 30, buttonWidth, buttonHeight, () => {
      if (this.paused) {
        this.setPaused(false);
      }
    });
    const continueLabel = createTranslatedText(this, centerX, centerY + 30, "common.pauseContinue", {
      maxWidth: buttonWidth - 20,
      fontSize: 15,
      color: "#f8fafc",
      weight: 700
    })
      .setScrollFactor(0)
      .setDepth(baseDepth + 2)
      .setVisible(false);

    this.pauseOverlayObjects.push(panel, title, exitButton, exitLabel, continueButton, continueLabel);
  }

  private createPauseButton(
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void
  ): Phaser.GameObjects.Rectangle {
    const button = this.add
      .rectangle(x, y, width, height, 0x1f2937, 0.96)
      .setStrokeStyle(1, 0x94a3b8, 0.9)
      .setScrollFactor(0)
      .setDepth(DEPTH.PAUSE_OVERLAY + 51)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    button.on("pointerover", () => button.setFillStyle(0x334155, 0.98));
    button.on("pointerout", () => button.setFillStyle(0x1f2937, 0.96));
    button.on("pointerdown", onClick);

    return button;
  }
}

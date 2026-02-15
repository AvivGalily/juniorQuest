import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MenuScene } from "./scenes/MenuScene";
import { Level1Scene } from "./scenes/Level1Scene";
import { Level2Scene } from "./scenes/Level2Scene";
import { Level3Scene } from "./scenes/Level3Scene";
import { Level4Scene } from "./scenes/Level4Scene";
import { Level5Scene } from "./scenes/Level5Scene";
import { GameOverScene } from "./scenes/GameOverScene";
import { VictoryScene } from "./scenes/VictoryScene";
import { PHASER } from "../config/physics";
import { isDebug } from "./utils/debug";
import { BASE_HEIGHT, BASE_WIDTH, getInitialRenderResolution } from "./utils/resolution";

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: "game",
  backgroundColor: "#0f1318",
  antialias: true,
  antialiasGL: true,
  pixelArt: false,
  roundPixels: false,
  mipmapFilter: "LINEAR_MIPMAP_LINEAR",
  // Pick a render resolution that matches the initial FIT scale, so the browser doesn't upscale the canvas.
  // This is the biggest win for readable UI text.
  resolution: getInitialRenderResolution(),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: false,
    zoom: Phaser.Scale.Zoom.MAX_ZOOM,
    width: BASE_WIDTH,
    height: BASE_HEIGHT
  },
  dom: {
    createContainer: true
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: PHASER.DEFAULT_GRAVITY_Y },
      debug: isDebug()
    }
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    Level1Scene,
    Level2Scene,
    Level3Scene,
    Level4Scene,
    Level5Scene,
    GameOverScene,
    VictoryScene
  ]
};

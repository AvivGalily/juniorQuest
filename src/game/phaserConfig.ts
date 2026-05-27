import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MenuScene } from "./scenes/MenuScene";
import { AboutScene } from "./scenes/AboutScene";
import { Level1IntroScene } from "./scenes/Level1IntroScene";
import { Level1Scene } from "./scenes/Level1Scene";
import { Level2IntroScene } from "./scenes/Level2IntroScene";
import { Level2Scene } from "./scenes/Level2Scene";
import { Level3IntroScene } from "./scenes/Level3IntroScene";
import { Level3Scene } from "./scenes/Level3Scene";
import { Level4IntroScene } from "./scenes/Level4IntroScene";
import { Level4Scene } from "./scenes/Level4Scene";
import { Level5IntroScene } from "./scenes/Level5IntroScene";
import { Level5Scene } from "./scenes/Level5Scene";
import { FinalHrScene } from "./scenes/FinalHrScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
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
    AboutScene,
    Level1IntroScene,
    Level1Scene,
    Level2IntroScene,
    Level2Scene,
    Level3IntroScene,
    Level3Scene,
    Level4IntroScene,
    Level4Scene,
    Level5IntroScene,
    Level5Scene,
    FinalHrScene,
    GameOverScene,
    LeaderboardScene,
    VictoryScene
  ]
};

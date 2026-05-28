import "./style.css";
import Phaser from "phaser";
import { phaserConfig } from "./game/phaserConfig";
import { MobileViewport } from "./game/systems/MobileViewport";
import { OrientationOverlay } from "./game/systems/OrientationOverlay";

OrientationOverlay.initialize();

const game = new Phaser.Game(phaserConfig);
MobileViewport.initialize(game);

(window as typeof window & { __JUNIOR_QUEST_GAME__?: Phaser.Game }).__JUNIOR_QUEST_GAME__ = game;

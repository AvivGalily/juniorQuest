import "./style.css";
import Phaser from "phaser";
import { phaserConfig } from "./game/phaserConfig";

const game = new Phaser.Game(phaserConfig);

(window as typeof window & { __JUNIOR_QUEST_GAME__?: Phaser.Game }).__JUNIOR_QUEST_GAME__ = game;

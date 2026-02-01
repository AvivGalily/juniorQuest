import Phaser from "phaser";
import { seedFromQueryOrDate } from "../utils/rng";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    seedFromQueryOrDate();
    this.scene.start("PreloadScene");
  }
}

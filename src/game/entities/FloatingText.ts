import Phaser from "phaser";
import { DEPTH, FLOATING_TEXT } from "../../config/physics";
import { createDialogText } from "../utils/domText";
import { scale } from "../utils/layout";

export class FloatingText {
  static spawn(scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffd166"): void {
    const label = createDialogText(scene, x, y, text, {
      maxWidth: FLOATING_TEXT.MAX_WIDTH,
      fontSize: FLOATING_TEXT.FONT_SIZE,
      color,
      weight: FLOATING_TEXT.WEIGHT
    }).setDepth(DEPTH.FLOATING_TEXT);
    scene.tweens.add({
      targets: label,
      y: y - scale(FLOATING_TEXT.DRIFT_Y),
      alpha: FLOATING_TEXT.ALPHA_END,
      duration: FLOATING_TEXT.DURATION_MS,
      onComplete: () => label.destroy()
    });
  }
}

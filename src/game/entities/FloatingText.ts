import Phaser from "phaser";
import { createDialogText } from "../utils/domText";

export class FloatingText {
  static spawn(scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffd166"): void {
    const label = createDialogText(scene, x, y, text, {
      maxWidth: 220,
      fontSize: 14,
      color,
      weight: 700
    }).setDepth(900);
    scene.tweens.add({
      targets: label,
      y: y - 20,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy()
    });
  }
}

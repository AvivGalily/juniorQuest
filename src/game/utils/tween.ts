import Phaser from "phaser";
import { ANIMATION } from "../../config/physics";

export const flashTween = (
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  durationMs: number,
  flashes = ANIMATION.FLASH_DEFAULT_COUNT
): void => {
  if (!(target as Phaser.GameObjects.Components.Alpha).setAlpha) {
    return;
  }
  scene.tweens.add({
    targets: target,
    alpha: ANIMATION.FLASH_ALPHA,
    yoyo: true,
    repeat: flashes,
    duration: durationMs / (flashes * 2 + 1)
  });
};

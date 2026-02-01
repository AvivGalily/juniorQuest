import Phaser from "phaser";

export const flashTween = (
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  durationMs: number,
  flashes = 6
): void => {
  if (!(target as Phaser.GameObjects.Components.Alpha).setAlpha) {
    return;
  }
  scene.tweens.add({
    targets: target,
    alpha: 0.2,
    yoyo: true,
    repeat: flashes,
    duration: durationMs / (flashes * 2 + 1)
  });
};

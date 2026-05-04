import Phaser from "phaser";

type ScalableSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

const getSourceSize = (sprite: ScalableSprite): { width: number; height: number } => {
  const source = sprite.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  const width = source?.width ?? sprite.width;
  const height = source?.height ?? sprite.height;
  return { width, height };
};

export const scaleSpriteToHeight = (sprite: ScalableSprite, targetHeight: number): void => {
  const { width, height } = getSourceSize(sprite);
  if (!height) {
    return;
  }
  const rawScale = targetHeight / height;
  const clampedScale = Math.min(1, rawScale);
  sprite.setScale(clampedScale);
  const body = (sprite as Phaser.Physics.Arcade.Sprite).body;
  if (body) {
    if (!(sprite instanceof Phaser.GameObjects.Sprite)) {
      body.setSize(sprite.displayWidth, sprite.displayHeight, true);
      return;
    }
    const bodyWidth = width * 0.28;
    const bodyHeight = height * 0.72;
    body.setSize(bodyWidth, bodyHeight, false);
    body.setOffset((width - bodyWidth) / 2, height - bodyHeight);
  }
};

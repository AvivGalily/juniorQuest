import Phaser from "phaser";
import { getTextResolution } from "./resolution";

// High-quality Canvas Text (non-pixelated, anti-aliased).
export const tuneText = (text: Phaser.GameObjects.Text): Phaser.GameObjects.Text => {
  const renderer = text.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | Phaser.Renderer.Canvas.CanvasRenderer;
  const rendererResolution = (renderer as unknown as { resolution?: number }).resolution ?? 1;
  const textResolution = getTextResolution(rendererResolution);

  text.setResolution(textResolution);
  text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  text.updateText();

  return text;
};

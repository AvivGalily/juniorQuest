import Phaser from "phaser";
import { LEVEL3, SCALE } from "../../config/physics";
import { createDialogText } from "../utils/domText";
import { scale } from "../utils/layout";

export class SnakeNode extends Phaser.GameObjects.Container {
  private arrow: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.DOMElement;
  flipped = false;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string) {
    super(scene, x, y);
    const body = scene.add.image(0, 0, "snake_node");
    const nodeScale = scale(SCALE.UNIT);
    body.setScale(nodeScale);
    this.arrow = scene.add.image(LEVEL3.NODE_ARROW_OFFSET_X * nodeScale, 0, "arrow_right");
    this.arrow.setScale(nodeScale);
    this.add([body, this.arrow]);
    scene.add.existing(this);
    this.label = createDialogText(scene, x, y, label, {
      maxWidth: LEVEL3.NODE_LABEL_MAX_WIDTH,
      fontSize: LEVEL3.NODE_LABEL_FONT_SIZE,
      color: "#112a2e",
      align: "center"
    }).setDepth(this.depth + 1);
  }

  override setPosition(x?: number, y?: number, z?: number, w?: number): this {
    super.setPosition(x, y, z, w);
    this.label.setPosition(this.x, this.y);
    return this;
  }

  override setVisible(value: boolean): this {
    super.setVisible(value);
    this.label.setVisible(value);
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.label.destroy();
    super.destroy(fromScene);
  }

  setFlipped(flipped: boolean): void {
    this.flipped = flipped;
    this.arrow.setTexture(flipped ? "arrow_left" : "arrow_right");
  }
}

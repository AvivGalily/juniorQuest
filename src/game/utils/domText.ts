import Phaser from "phaser";

const buildStyle = (
  maxWidth: number,
  fontSize: number,
  color: string,
  padding: string,
  weight: number,
  align: "left" | "center" | "right"
): string =>
  [
    `width:${maxWidth}px`,
    `padding:${padding}`,
    "font-family:\"Courier New\", Courier, monospace",
    `font-size:${fontSize}px`,
    `font-weight:${weight}`,
    "line-height:1.3",
    `text-align:${align}`,
    `color:${color}`,
    "background:transparent",
    "white-space:normal",
    "user-select:none"
  ].join(";");

export const createDialogText = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options?: {
    maxWidth?: number;
    fontSize?: number;
    color?: string;
    padding?: string;
    weight?: number;
    align?: "left" | "center" | "right";
    originX?: number;
    originY?: number;
  }
): Phaser.GameObjects.DOMElement => {
  const maxWidth = options?.maxWidth ?? 200;
  const fontSize = options?.fontSize ?? 16;
  const color = options?.color ?? "#1b1f24";
  const padding = options?.padding ?? "0";
  const weight = options?.weight ?? 600;
  const align = options?.align ?? "center";

  const element = scene.add.dom(x, y, "div", buildStyle(maxWidth, fontSize, color, padding, weight, align), text);
  element.setOrigin(options?.originX ?? 0.5, options?.originY ?? 0.5);
  (element.node as HTMLDivElement).style.pointerEvents = "none";

  return element;
};

export const setDomText = (element: Phaser.GameObjects.DOMElement, text: string): void => {
  (element.node as HTMLDivElement).textContent = text;
};

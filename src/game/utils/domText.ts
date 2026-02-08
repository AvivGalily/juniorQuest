import Phaser from "phaser";
import { DOM_TEXT } from "../../config/physics";
import { getUiScale } from "./resolution";

const scaleCssValue = (value: string, scale: number): string =>
  value.replace(/(\d+(\.\d+)?)px/g, (_, num) => `${Math.round(parseFloat(num) * scale)}px`);

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
    `line-height:${DOM_TEXT.LINE_HEIGHT}`,
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
  const uiScale = getUiScale();
  const maxWidth = options?.maxWidth ?? DOM_TEXT.DEFAULT_MAX_WIDTH;
  const fontSize = options?.fontSize ?? DOM_TEXT.DEFAULT_FONT_SIZE;
  const color = options?.color ?? "#1b1f24";
  const padding = options?.padding ?? "0";
  const weight = options?.weight ?? DOM_TEXT.DEFAULT_WEIGHT;
  const align = options?.align ?? "center";

  const element = scene.add.dom(
    x,
    y,
    "div",
    buildStyle(
      Math.round(maxWidth * uiScale),
      Math.round(fontSize * uiScale),
      color,
      scaleCssValue(padding, uiScale),
      weight,
      align
    ),
    text
  );
  element.setOrigin(options?.originX ?? DOM_TEXT.DEFAULT_ORIGIN, options?.originY ?? DOM_TEXT.DEFAULT_ORIGIN);
  (element.node as HTMLDivElement).style.pointerEvents = "none";

  return element;
};

export const setDomText = (element: Phaser.GameObjects.DOMElement, text: string): void => {
  (element.node as HTMLDivElement).textContent = text;
};

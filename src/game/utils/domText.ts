import Phaser from "phaser";
import { DOM_TEXT } from "../../config/physics";
import { getDirection, t, TranslateParams } from "../i18n/i18n";
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
    "box-sizing:border-box",
    "font-family:\"Courier New\", Courier, monospace",
    `font-size:${fontSize}px`,
    `font-weight:${weight}`,
    `line-height:${DOM_TEXT.LINE_HEIGHT}`,
    `text-align:${align}`,
    `color:${color}`,
    "background:transparent",
    "white-space:normal",
    "overflow-wrap:break-word",
    "user-select:none"
  ].join(";");

type DialogTextOptions = {
  maxWidth?: number;
  fontSize?: number;
  color?: string;
  padding?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  originX?: number;
  originY?: number;
  direction?: "ltr" | "rtl";
};

type TranslatedTextOptions = DialogTextOptions & {
  params?: TranslateParams;
};

const applyDirection = (element: Phaser.GameObjects.DOMElement, direction?: "ltr" | "rtl"): void => {
  const node = element.node as HTMLDivElement;
  const stored = node.dataset.direction;
  const resolved = direction ?? (stored === "ltr" || stored === "rtl" ? stored : getDirection());
  node.dir = resolved;
  node.style.direction = resolved;
};

export const createDialogText = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options?: DialogTextOptions
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
  const node = element.node as HTMLDivElement;
  node.style.pointerEvents = "none";
  node.dataset.juniorQuestDomText = "true";
  node.dataset.sceneKey = scene.sys.settings.key;
  node.dataset.direction = options?.direction ?? "auto";
  applyDirection(element);

  return element;
};

export const setDomText = (element: Phaser.GameObjects.DOMElement, text: string): void => {
  (element.node as HTMLDivElement).textContent = text;
  applyDirection(element);
};

export const createTranslatedText = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  options?: TranslatedTextOptions
): Phaser.GameObjects.DOMElement => createDialogText(scene, x, y, t(key, options?.params), options);

export const setTranslatedText = (
  element: Phaser.GameObjects.DOMElement,
  key: string,
  params?: TranslateParams
): void => {
  setDomText(element, t(key, params));
};

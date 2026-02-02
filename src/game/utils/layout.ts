import { BASE_HEIGHT, BASE_WIDTH, DESIGN_HEIGHT, DESIGN_WIDTH } from "./resolution";

export const scaleX = (value: number): number => (value / DESIGN_WIDTH) * BASE_WIDTH;
export const scaleY = (value: number): number => (value / DESIGN_HEIGHT) * BASE_HEIGHT;
export const scale = (value: number): number => value * Math.min(BASE_WIDTH / DESIGN_WIDTH, BASE_HEIGHT / DESIGN_HEIGHT);

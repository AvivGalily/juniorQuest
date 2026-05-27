import { LEVEL1, LEVEL2, LEVEL3, LEVEL4, LEVEL5 } from "./physics";

export const Level1Physics = LEVEL1;
export const Level2Physics = LEVEL2;
export const Level4Physics = LEVEL4;
export const Level5Physics = LEVEL5;

export const Level3Physics = {
  ...LEVEL3,
  snakeInitialNodeSpacing: 42,
  snakePathStartX: 500,
  snakePathEndX: 120,
  snakeNodeDisplayWidth: 36,
  snakeNodeDisplayHeight: 28,
  snakeHeadDisplayWidth: 104,
  snakeHeadDisplayHeight: 88,
  snakeTailDisplayWidth: 96,
  snakeTailDisplayHeight: 64,
  snakeWaveAmplitudeY: 8,
  snakeHeadTrailGap: 78,
  snakeFigureEightCenterX: 320,
  snakeFigureEightAmplitudeX: 250,
  snakeFigureEightAmplitudeY: 34,
  snakePathSampleSpacing: 5,
  interviewerNpcX: 590,
  interviewerNpcY: 156,
  interviewerNpcWidth: 26,
  interviewerNpcHeight: 51,
  interviewerBubbleOffsetX: 78,
  interviewerBubbleOffsetY: 26,
  interviewerBubbleWidth: 132,
  interviewerBubbleHeight: 34,
  interviewerBubbleTextWrapWidth: 118,
  interviewerBubbleFontSize: 8,
  interviewerFirstTauntDelayMs: 1000,
  interviewerTauntIntervalMs: 8000,
  heartPickupFirstDelayMs: 1000,
  heartPickupMinIntervalMs: 10000,
  heartPickupMaxIntervalMs: 20000,
  heartPickupVisibleMs: 7000,
  heartPickupMarginX: 92,
  heartPickupMinY: 112,
  heartPickupMaxY: 284,
  heartPickupSize: 24,
  heartPickupBobY: 6,
  heartPickupPulseScale: 1.12,
  heartPickupPulseAlpha: 0.78,
  heartPickupPulseMs: 520
} as const;

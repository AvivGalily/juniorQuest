const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// Internal logical resolution (gameplay space)
export const BASE_WIDTH = 640;
export const BASE_HEIGHT = 360;

// Render at a higher internal resolution so text stays sharp after FIT scaling.
const MIN_RENDER_RESOLUTION = 2;
const MAX_RENDER_RESOLUTION = 4;

export const getDevicePixelRatio = (): number => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

// Phaser.Scale.FIT scale factor for the current viewport.
export const getFitScale = (parentW?: number, parentH?: number): number => {
  if (typeof window === "undefined") {
    return 1;
  }
  const w = parentW ?? window.innerWidth;
  const h = parentH ?? window.innerHeight;
  if (!w || !h) {
    return 1;
  }
  return Math.min(w / BASE_WIDTH, h / BASE_HEIGHT);
};

// Internal renderer resolution: clamp to [2..4] so text is supersampled but sprites stay performant.
export const getInitialRenderResolution = (): number => {
  const dpr = getDevicePixelRatio();
  const target = Math.round(dpr * 2); // DPR 1 => 2x, DPR 2 => 4x (capped)
  return clamp(target, MIN_RENDER_RESOLUTION, MAX_RENDER_RESOLUTION);
};

// Text render resolution: match renderer to avoid double-scaling artifacts.
export const getTextResolution = (rendererResolution: number): number => clamp(rendererResolution, 1, MAX_RENDER_RESOLUTION);

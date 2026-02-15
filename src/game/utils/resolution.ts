const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// Design-time logical resolution (legacy layout space)
export const DESIGN_WIDTH = 640;
export const DESIGN_HEIGHT = 360;

// Internal logical resolution (gameplay space)
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Render at a higher internal resolution so text/sprites stay sharp after FIT scaling.
const MIN_RENDER_RESOLUTION = 3;
const MAX_RENDER_RESOLUTION = 8;

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

// Internal renderer resolution: clamp to [2..8] so text/sprites stay sharp but remain performant.
export const getInitialRenderResolution = (): number => {
  const dpr = getDevicePixelRatio();
  const fit = getFitScale();
  const target = Math.ceil(dpr * fit);
  return clamp(target, MIN_RENDER_RESOLUTION, MAX_RENDER_RESOLUTION);
};

// Text render resolution: match renderer to avoid double-scaling artifacts.
export const getTextResolution = (rendererResolution: number): number => clamp(rendererResolution, 1, MAX_RENDER_RESOLUTION);

export const getUiScale = (): number => Math.min(BASE_WIDTH / DESIGN_WIDTH, BASE_HEIGHT / DESIGN_HEIGHT);

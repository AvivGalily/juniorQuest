let state = 1 >>> 0;

const normalizeSeed = (seed: number): number => {
  const value = Number.isFinite(seed) ? Math.floor(seed) : 1;
  return (value >>> 0) || 1;
};

export const seedRng = (seed?: number): void => {
  state = normalizeSeed(seed ?? state);
};

export const seedFromQueryOrDate = (): void => {
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get("seed");
  if (seedParam) {
    seedRng(Number(seedParam));
    return;
  }
  const now = new Date();
  const stamp = Number(
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  );
  seedRng(stamp);
};

export const rngFloat = (): number => {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 0xffffffff;
};

export const rngInt = (min: number, max: number): number => {
  return Math.floor(rngFloat() * (max - min + 1)) + min;
};

export const rngPick = <T>(items: T[]): T => {
  return items[Math.max(0, Math.min(items.length - 1, rngInt(0, items.length - 1)))];
};

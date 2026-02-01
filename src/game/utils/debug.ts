export const isDebug = (): boolean => {
  return new URLSearchParams(window.location.search).get("debug") === "1";
};

export const getSeedParam = (): string | null => {
  return new URLSearchParams(window.location.search).get("seed");
};

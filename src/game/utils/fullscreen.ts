type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(platform) || (/Mac/.test(platform) && navigator.maxTouchPoints > 1) || /iPad|iPhone|iPod/.test(userAgent);
};

export const isIPhone = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/.test(navigator.platform || "") || /iPhone|iPod/.test(navigator.userAgent || "");
};

export const isStandaloneDisplay = (): boolean => {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches);
};

export const getFullscreenElement = (): Element | null => {
  const doc = document as WebkitDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
};

export const canUseElementFullscreen = (): boolean => {
  if (typeof document === "undefined") return false;
  if (isIPhone() && !isStandaloneDisplay()) return false;

  const doc = document as WebkitDocument;
  const root = document.documentElement as FullscreenElement;
  return Boolean((document.fullscreenEnabled && root.requestFullscreen) || (doc.webkitFullscreenEnabled && root.webkitRequestFullscreen));
};

export const enterAppFullscreen = async (): Promise<boolean> => {
  if (typeof document === "undefined") return false;
  if (getFullscreenElement() || isStandaloneDisplay()) return true;
  if (!canUseElementFullscreen()) return false;

  const root = document.documentElement as FullscreenElement;

  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return true;
    }

    await root.webkitRequestFullscreen?.();
    return Boolean(getFullscreenElement());
  } catch {
    return false;
  }
};

export const exitAppFullscreen = async (): Promise<boolean> => {
  if (typeof document === "undefined" || !getFullscreenElement()) return true;

  const doc = document as WebkitDocument;

  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }

    await doc.webkitExitFullscreen?.();
    return !getFullscreenElement();
  } catch {
    return false;
  }
};

export const shouldShowIOSInstallFullscreenHint = (): boolean => isIPhone() && !isStandaloneDisplay();

import type Phaser from "phaser";
import { isIOS, isStandaloneDisplay } from "../utils/fullscreen";

export class MobileViewport {
  private static initialized = false;
  private static game?: Phaser.Game;
  private static resizeFrame = 0;

  public static initialize(game: Phaser.Game): void {
    MobileViewport.game = game;

    if (MobileViewport.initialized || typeof window === "undefined") {
      MobileViewport.refresh();
      return;
    }

    MobileViewport.initialized = true;
    document.documentElement.classList.toggle("is-ios", isIOS());
    document.documentElement.classList.toggle("is-standalone", isStandaloneDisplay());

    const scheduleRefresh = () => {
      if (MobileViewport.resizeFrame) {
        window.cancelAnimationFrame(MobileViewport.resizeFrame);
      }

      MobileViewport.resizeFrame = window.requestAnimationFrame(() => {
        MobileViewport.resizeFrame = 0;
        MobileViewport.refresh();
      });
    };

    window.addEventListener("resize", scheduleRefresh, { passive: true });
    window.addEventListener("orientationchange", () => {
      scheduleRefresh();
      window.setTimeout(scheduleRefresh, 250);
      window.setTimeout(scheduleRefresh, 700);
    }, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleRefresh, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleRefresh, { passive: true });
    document.addEventListener("visibilitychange", scheduleRefresh);

    MobileViewport.refresh();
  }

  private static refresh(): void {
    if (typeof window === "undefined") return;

    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width || window.innerWidth);
    const height = Math.round(viewport?.height || window.innerHeight);

    document.documentElement.style.setProperty("--app-width", `${width}px`);
    document.documentElement.style.setProperty("--app-height", `${height}px`);
    document.documentElement.classList.toggle("is-standalone", isStandaloneDisplay());

    MobileViewport.game?.scale.refresh();
  }
}

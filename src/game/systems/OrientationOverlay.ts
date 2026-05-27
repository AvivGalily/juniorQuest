import { isTouchDevice } from "../utils/isMobile";

export class OrientationOverlay {
  private static instance?: OrientationOverlay;
  private container!: HTMLDivElement;

  public static initialize(): void {
    if (!OrientationOverlay.instance) {
      OrientationOverlay.instance = new OrientationOverlay();
    }
  }

  private constructor() {
    if (!isTouchDevice()) return;
    this.createDomElement();
    this.checkOrientation();
    window.addEventListener("resize", this.checkOrientation.bind(this));
    window.addEventListener("orientationchange", this.checkOrientation.bind(this));
    this.tryLockOrientation();
  }

  private createDomElement(): void {
    this.container = document.createElement("div");
    this.container.id = "orientation-overlay";
    this.container.style.display = "none";
    this.container.innerHTML = `
      <div class="orientation-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <path d="M12 18h.01"></path>
          <path d="M3 12h2"></path>
          <path d="M19 12h2"></path>
        </svg>
        <p>Please rotate your device to landscape mode</p>
      </div>
    `;

    const style = document.createElement("style");
    style.innerHTML = `
      #orientation-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #0f1318;
        color: #e8eef2;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: monospace;
      }
      .orientation-content {
        text-align: center;
      }
      .orientation-content svg {
        margin-bottom: 20px;
        animation: rotatePhone 2s infinite ease-in-out;
      }
      @keyframes rotatePhone {
        0% { transform: rotate(0deg); }
        50% { transform: rotate(90deg); }
        100% { transform: rotate(90deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.container);
  }

  private checkOrientation(): void {
    if (window.matchMedia("(orientation: portrait)").matches) {
      this.container.style.display = "flex";
    } else {
      this.container.style.display = "none";
    }
  }

  private async tryLockOrientation(): Promise<void> {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) {
      // Locking might fail due to missing user gesture or lack of browser support, we gracefully ignore
    }
  }
}

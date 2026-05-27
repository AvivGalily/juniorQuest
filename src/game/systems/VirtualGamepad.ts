import { isTouchDevice } from "../utils/isMobile";
import { t } from "../i18n/i18n";

export type VirtualGamepadLayout = "none" | "topdown" | "platformer";

export class VirtualGamepad {
  private static instance?: VirtualGamepad;

  private container!: HTMLDivElement;
  private joystickArea!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private actionArea!: HTMLDivElement;
  private btnA!: HTMLDivElement;
  private btnB!: HTMLDivElement;
  private btnPause!: HTMLDivElement;
  private btnFullscreen!: HTMLDivElement;

  private layout: VirtualGamepadLayout = "none";
  private visible = false;

  private joystickActive = false;
  private joystickBase = { x: 0, y: 0 };
  private joystickCurrent = { x: 0, y: 0 };
  private joystickRadius = 50;

  // State
  public axisX = 0;
  public axisY = 0;
  
  private btnAPressed = false;
  private btnBPressed = false;
  private btnPausePressed = false;

  // Just pressed states
  private btnAJustPressed = false;
  private btnBJustPressed = false;
  private btnPauseJustPressed = false;

  private btnALastState = false;
  private btnBLastState = false;
  private btnPauseLastState = false;

  public static getInstance(): VirtualGamepad {
    if (!VirtualGamepad.instance) {
      VirtualGamepad.instance = new VirtualGamepad();
    }
    return VirtualGamepad.instance;
  }

  public static setLayout(layout: VirtualGamepadLayout): void {
    VirtualGamepad.getInstance().setLayout(layout);
  }

  public static show(): void {
    VirtualGamepad.getInstance().show();
  }

  public static hide(): void {
    VirtualGamepad.getInstance().hide();
  }

  public static updateState(): void {
    VirtualGamepad.getInstance().updateState();
  }

  private constructor() {
    if (!isTouchDevice()) {
      return;
    }
    this.createDomElements();
    this.bindEvents();
    this.injectStyles();
  }

  private createDomElements(): void {
    this.container = document.createElement("div");
    this.container.id = "virtual-gamepad";
    this.container.style.display = "none";

    this.joystickArea = document.createElement("div");
    this.joystickArea.className = "vg-joystick-area";
    this.joystickKnob = document.createElement("div");
    this.joystickKnob.className = "vg-joystick-knob";
    this.joystickArea.appendChild(this.joystickKnob);

    this.actionArea = document.createElement("div");
    this.actionArea.className = "vg-action-area";

    this.btnB = document.createElement("div");
    this.btnB.className = "vg-btn vg-btn-b";
    this.btnB.innerText = "X";

    this.btnA = document.createElement("div");
    this.btnA.className = "vg-btn vg-btn-a";
    this.btnA.innerText = "SPACE";

    this.actionArea.appendChild(this.btnB);
    this.actionArea.appendChild(this.btnA);

    this.btnPause = document.createElement("div");
    this.btnPause.className = "vg-btn vg-btn-small vg-btn-pause";
    this.btnPause.innerText = "ESC";

    this.btnFullscreen = document.createElement("div");
    this.btnFullscreen.className = "vg-btn vg-btn-small vg-btn-fs";
    this.btnFullscreen.innerHTML = "&#x26F6;"; // Fullscreen icon

    this.container.appendChild(this.joystickArea);
    this.container.appendChild(this.actionArea);
    this.container.appendChild(this.btnPause);
    this.container.appendChild(this.btnFullscreen);

    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.innerHTML = `
      #virtual-gamepad {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
        touch-action: none;
      }
      .vg-joystick-area {
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 140px;
        height: 140px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        pointer-events: auto;
      }
      .vg-joystick-knob {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 60px;
        height: 60px;
        margin-top: -30px;
        margin-left: -30px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(0px, 0px);
        transition: transform 0.05s linear;
      }
      .vg-action-area {
        position: absolute;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 15px;
        align-items: flex-end;
      }
      .vg-btn {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        border: 2px solid rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 14px;
        font-weight: bold;
        pointer-events: auto;
        user-select: none;
      }
      .vg-btn.active {
        background: rgba(255, 255, 255, 0.4);
      }
      .vg-btn-small {
        position: absolute;
        width: 44px;
        height: 44px;
        font-size: 14px;
      }
      .vg-btn-pause {
        top: 20px;
        right: 20px;
        font-size: 12px;
      }
      .vg-btn-fs {
        top: 20px;
        right: 80px;
        font-size: 20px;
      }
    `;
    document.head.appendChild(style);
  }

  private bindEvents(): void {
    // Joystick
    this.joystickArea.addEventListener("touchstart", this.onJoystickStart.bind(this), { passive: false });
    this.joystickArea.addEventListener("touchmove", this.onJoystickMove.bind(this), { passive: false });
    this.joystickArea.addEventListener("touchend", this.onJoystickEnd.bind(this), { passive: false });
    this.joystickArea.addEventListener("touchcancel", this.onJoystickEnd.bind(this), { passive: false });

    // Button A
    this.btnA.addEventListener("touchstart", (e) => { e.preventDefault(); this.btnAPressed = true; this.btnA.classList.add("active"); }, { passive: false });
    this.btnA.addEventListener("touchend", (e) => { e.preventDefault(); this.btnAPressed = false; this.btnA.classList.remove("active"); }, { passive: false });
    this.btnA.addEventListener("touchcancel", (e) => { e.preventDefault(); this.btnAPressed = false; this.btnA.classList.remove("active"); }, { passive: false });

    // Button B
    this.btnB.addEventListener("touchstart", (e) => { e.preventDefault(); this.btnBPressed = true; this.btnB.classList.add("active"); }, { passive: false });
    this.btnB.addEventListener("touchend", (e) => { e.preventDefault(); this.btnBPressed = false; this.btnB.classList.remove("active"); }, { passive: false });
    this.btnB.addEventListener("touchcancel", (e) => { e.preventDefault(); this.btnBPressed = false; this.btnB.classList.remove("active"); }, { passive: false });

    // Button Pause
    this.btnPause.addEventListener("touchstart", (e) => { e.preventDefault(); this.btnPausePressed = true; this.btnPause.classList.add("active"); }, { passive: false });
    this.btnPause.addEventListener("touchend", (e) => { e.preventDefault(); this.btnPausePressed = false; this.btnPause.classList.remove("active"); }, { passive: false });
    this.btnPause.addEventListener("touchcancel", (e) => { e.preventDefault(); this.btnPausePressed = false; this.btnPause.classList.remove("active"); }, { passive: false });

    // Button Fullscreen
    this.btnFullscreen.addEventListener("touchstart", (e) => { 
      e.preventDefault(); 
      this.btnFullscreen.classList.add("active"); 
      this.toggleFullscreen();
    }, { passive: false });
    this.btnFullscreen.addEventListener("touchend", (e) => { e.preventDefault(); this.btnFullscreen.classList.remove("active"); }, { passive: false });
    this.btnFullscreen.addEventListener("touchcancel", (e) => { e.preventDefault(); this.btnFullscreen.classList.remove("active"); }, { passive: false });
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        alert(t("menu.fullscreenNotSupported"));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  private onJoystickStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = this.joystickArea.getBoundingClientRect();
    this.joystickBase = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    this.joystickActive = true;
    this.updateJoystickPosition(touch.clientX, touch.clientY);
  }

  private onJoystickMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.joystickActive) return;
    const touch = e.changedTouches[0];
    this.updateJoystickPosition(touch.clientX, touch.clientY);
  }

  private onJoystickEnd(e: TouchEvent): void {
    e.preventDefault();
    this.joystickActive = false;
    this.joystickKnob.style.transform = `translate(0px, 0px)`;
    this.axisX = 0;
    this.axisY = 0;
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickBase.x;
    const dy = clientY - this.joystickBase.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let nx = dx;
    let ny = dy;
    
    if (distance > this.joystickRadius) {
      nx = (dx / distance) * this.joystickRadius;
      ny = (dy / distance) * this.joystickRadius;
    }

    this.joystickKnob.style.transform = `translate(${nx}px, ${ny}px)`;

    const normalizedX = distance > 0 ? dx / distance : 0;
    const normalizedY = distance > 0 ? dy / distance : 0;

    // Apply deadzone
    const deadzone = 0.2;
    if (this.layout === "platformer") {
      this.axisX = Math.abs(normalizedX) > deadzone ? Math.sign(normalizedX) : 0;
      this.axisY = 0; // Ignore vertical in platformer
    } else {
      this.axisX = Math.abs(normalizedX) > deadzone ? Math.sign(normalizedX) : 0;
      this.axisY = Math.abs(normalizedY) > deadzone ? Math.sign(normalizedY) : 0;
    }
  }

  public setLayout(layout: VirtualGamepadLayout): void {
    if (!isTouchDevice()) return;
    this.layout = layout;
    if (layout === "none") {
      this.hide();
    } else {
      this.show();
      // Configure buttons based on layout
      if (layout === "platformer") {
        this.btnB.style.display = "flex";
      } else if (layout === "topdown") {
        this.btnA.style.display = "flex";
        this.btnB.style.display = "flex";
      }
    }
  }

  public show(): void {
    if (!isTouchDevice() || this.layout === "none") return;
    this.visible = true;
    this.container.style.display = "block";
  }

  public hide(): void {
    if (!isTouchDevice()) return;
    this.visible = false;
    this.container.style.display = "none";
    this.axisX = 0;
    this.axisY = 0;
    this.btnAPressed = false;
    this.btnBPressed = false;
    this.btnPausePressed = false;
  }

  public updateState(): void {
    this.btnAJustPressed = this.btnAPressed && !this.btnALastState;
    this.btnBJustPressed = this.btnBPressed && !this.btnBLastState;
    this.btnPauseJustPressed = this.btnPausePressed && !this.btnPauseLastState;

    this.btnALastState = this.btnAPressed;
    this.btnBLastState = this.btnBPressed;
    this.btnPauseLastState = this.btnPausePressed;
  }

  // Getters for InputManager
  public isJumpDown(): boolean { return this.btnAPressed; }
  public isActionDown(): boolean { return this.btnBPressed; }
  public justPressedJump(): boolean { return this.btnAJustPressed; }
  public justPressedAction(): boolean { return this.btnBJustPressed; }
  public justPressedPause(): boolean { return this.btnPauseJustPressed; }
}

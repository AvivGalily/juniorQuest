import Phaser from "phaser";
import { AUDIO } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { getDirection, t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class Level4IntroScene extends Phaser.Scene {
  private audio!: AudioManager;
  private dismissed = false;
  private emailCard?: Phaser.GameObjects.DOMElement;
  private continueZone?: Phaser.GameObjects.Zone;

  constructor() {
    super("Level4IntroScene");
  }

  create(): void {
    this.dismissed = false;
    this.emailCard = undefined;
    this.continueZone = undefined;
    this.input.enabled = true;
    this.audio = new AudioManager(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupIntro, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupIntro, this);
    this.stopLeakedLevel3Scene();
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 1);
    this.createRecruiterBackdrop();
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 0.58);

    this.createEmailCard();
    this.input.keyboard?.on("keydown-X", () => this.continueToLevel());
  }

  private createRecruiterBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(0x102332, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);
    g.lineStyle(scaleX(2), 0x38bdf8, 0.16);
    for (let i = 0; i < 12; i += 1) {
      const y = scaleY(36 + i * 28);
      g.lineBetween(scaleX(42), y, scaleX(598), y);
    }
    g.fillStyle(0xf8fafc, 0.08);
    g.fillRoundedRect(scaleX(70), scaleY(72), scaleX(500), scaleY(220), scaleX(8));
    g.fillStyle(0x38bdf8, 0.12);
    g.fillRoundedRect(scaleX(110), scaleY(112), scaleX(420), scaleY(18), scaleX(4));
    g.fillStyle(0x8fe388, 0.1);
    g.fillRoundedRect(scaleX(110), scaleY(154), scaleX(180), scaleY(18), scaleX(4));
    g.fillRoundedRect(scaleX(330), scaleY(154), scaleX(200), scaleY(18), scaleX(4));
    g.fillStyle(0xffd166, 0.1);
    g.fillRoundedRect(scaleX(110), scaleY(196), scaleX(420), scaleY(18), scaleX(4));
  }

  private createEmailCard(): void {
    const recruiterSrc = new URL("../img/recruiter-linkedin-avatar.png", import.meta.url).href;
    const cardW = Math.round(scaleX(548));
    const cardH = Math.round(scaleY(342));
    const headerH = Math.round(scaleY(42));
    const pad = Math.round(scaleX(24));
    const smallFont = Math.round(scaleY(10));
    const bodyFont = Math.round(scaleY(9.2));
    const subjectFont = Math.round(scaleY(12.2));
    const ctaFont = Math.round(scaleY(12));
    const direction = getDirection();
    const textAlign = direction === "rtl" ? "right" : "left";

    const html = `
      <div style="
        width:${cardW}px;
        height:${cardH}px;
        box-sizing:border-box;
        overflow:hidden;
        background:#f8fafc;
        border:6px solid #1f2937;
        box-shadow:${Math.round(scaleX(8))}px ${Math.round(scaleY(10))}px 0 rgba(2, 6, 23, 0.45);
        font-family:'Courier New', Courier, monospace;
        color:#1e293b;
        direction:${direction};
      ">
        <div style="
          height:${headerH}px;
          background:#102332;
          color:#e8eef2;
          display:flex;
          align-items:center;
          justify-content:space-between;
          box-sizing:border-box;
          padding:0 ${pad}px;
          direction:ltr;
          font-size:${smallFont}px;
          font-weight:700;
        ">
          <span>${escapeHtml(t("level4Intro.appTitle"))}</span>
          <span style="display:flex;gap:${Math.round(scaleX(5))}px;">
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#ef4444;display:block;"></i>
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#facc15;display:block;"></i>
            <i style="width:${Math.round(scaleX(5))}px;height:${Math.round(scaleX(5))}px;border-radius:50%;background:#22c55e;display:block;"></i>
          </span>
        </div>
        <div style="
          height:${cardH - headerH}px;
          box-sizing:border-box;
          padding:${Math.round(scaleY(13))}px ${pad}px ${Math.round(scaleY(12))}px ${pad}px;
          display:flex;
          flex-direction:column;
          gap:${Math.round(scaleY(7))}px;
        ">
          <div style="
            display:grid;
            grid-template-columns:${Math.round(scaleX(58))}px 1fr;
            column-gap:${Math.round(scaleX(14))}px;
            align-items:center;
            direction:ltr;
          ">
            <div style="
              width:${Math.round(scaleX(46))}px;
              height:${Math.round(scaleY(46))}px;
              border-radius:50%;
              overflow:hidden;
              background:#dbeafe;
              border:3px solid #38bdf8;
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <img src="${recruiterSrc}" alt="" style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
                border-radius:50%;
              " />
            </div>
            <div style="direction:${direction};text-align:${textAlign};font-size:${smallFont}px;line-height:1.35;color:#475569;font-weight:700;overflow:hidden;">
              <div>${escapeHtml(t("level4Intro.from"))}</div>
              <div>${escapeHtml(t("level4Intro.to"))}</div>
            </div>
          </div>
          <div style="height:3px;background:#cbd5e1;"></div>
          <div style="
            font-size:${subjectFont}px;
            line-height:1.2;
            color:#0f172a;
            font-weight:800;
            text-align:${textAlign};
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">${escapeHtml(t("level4Intro.subject"))}</div>
          <div style="height:3px;background:#e2e8f0;"></div>
          <div style="
            flex:1;
            min-height:0;
            overflow:hidden;
            font-size:${bodyFont}px;
            line-height:1.16;
            color:#1e293b;
            font-weight:700;
            text-align:${textAlign};
          ">
            <p style="margin:0 0 ${Math.round(scaleY(6))}px 0;">${escapeHtml(t("level4Intro.body"))}</p>
            <div style="
              margin-top:${Math.round(scaleY(5))}px;
              padding-top:${Math.round(scaleY(5))}px;
              border-top:2px solid #cbd5e1;
              color:#0f172a;
              font-weight:800;
            ">${escapeHtml(t("level4Intro.instructions"))}</div>
          </div>
          <div data-action="continue" style="
            height:${Math.round(scaleY(30))}px;
            flex:0 0 ${Math.round(scaleY(30))}px;
            box-sizing:border-box;
            border:3px solid #38bdf8;
            background:#e0f2fe;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#0f172a;
            font-size:${ctaFont}px;
            font-weight:800;
            text-align:center;
            cursor:pointer;
          ">${escapeHtml(t("level4Intro.continue"))}</div>
        </div>
      </div>
    `;

    const card = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html).setOrigin(0.5);
    this.emailCard = card;
    (card.node as HTMLElement).dataset.level4IntroCard = "true";
    card.addListener("click");
    card.on("click", (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action='continue']")) {
        this.continueToLevel();
      }
    });

    const ctaH = Math.round(scaleY(30));
    this.continueZone = this.add
      .zone(this.scale.width / 2, this.scale.height / 2 + cardH / 2 - Math.round(scaleY(12)) - ctaH / 2, cardW - pad * 2, ctaH)
      .setInteractive({ useHandCursor: true })
      .setDepth(10000)
      .on("pointerdown", () => this.continueToLevel());
  }

  private continueToLevel(): void {
    if (this.dismissed) {
      return;
    }
    this.dismissed = true;
    try {
      this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
    } catch {
      // Continue even if audio is unavailable during a scene transition.
    }
    runState.levelStartTimeMs = Date.now();
    this.cleanupIntro();
    this.stopLeakedLevel3Scene();
    try {
      this.scene.start("Level4Scene");
    } catch {
      this.scene.manager.start("Level4Scene");
    }
    window.setTimeout(() => {
      try {
        if (this.scene.isActive("Level4IntroScene") || this.scene.isPaused("Level4IntroScene")) {
          this.scene.stop("Level4IntroScene");
        }
      } catch {
        // The intro scene may already be stopped.
      }
      if (!this.scene.isActive("Level4Scene")) {
        this.stopLeakedLevel3Scene();
        this.scene.manager.start("Level4Scene");
      }
    }, 120);
  }

  private stopLeakedLevel3Scene(): void {
    try {
      if (this.scene.isActive("Level3Scene") || this.scene.isPaused("Level3Scene")) {
        this.scene.stop("Level3Scene");
      }
    } catch {
      // Transition can continue even if level 3 has already been stopped.
    }
    document.querySelectorAll<HTMLElement>("[data-scene-key='Level3Scene']").forEach((node) => {
      node.remove();
    });
  }

  private cleanupIntro(): void {
    this.emailCard?.destroy();
    this.continueZone?.destroy();
    this.emailCard = undefined;
    this.continueZone = undefined;
    document.querySelectorAll<HTMLElement>("[data-level4-intro-card='true']").forEach((node) => {
      node.remove();
    });
  }
}

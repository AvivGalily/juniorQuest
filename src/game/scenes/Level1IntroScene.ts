import Phaser from "phaser";
import { AUDIO } from "../../config/physics";
import { runState } from "../RunState";
import { AudioManager } from "../systems/AudioManager";
import { getDirection, t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class Level1IntroScene extends Phaser.Scene {
  private audio!: AudioManager;
  private dismissed = false;

  constructor() {
    super("Level1IntroScene");
  }

  create(): void {
    this.dismissed = false;
    this.audio = new AudioManager(this);
    this.add.image(this.scale.width / 2, this.scale.height / 2, "level1-job-fair-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 0.64);

    this.createEmailCard();
    this.input.keyboard?.on("keydown-X", () => this.continueToLevel());
  }

  private createEmailCard(): void {
    const recruiterSrc = new URL("../img/recruiter-linkedin-avatar.png", import.meta.url).href;
    const cardW = Math.round(scaleX(548));
    const cardH = Math.round(scaleY(342));
    const headerH = Math.round(scaleY(42));
    const pad = Math.round(scaleX(24));
    const smallFont = Math.round(scaleY(10));
    const bodyFont = Math.round(scaleY(9.1));
    const subjectFont = Math.round(scaleY(12.4));
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
          <span>${escapeHtml(t("level1Intro.appTitle"))}</span>
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
          <div data-action="continue" style="
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
              <div>${escapeHtml(t("level1Intro.from"))}</div>
              <div>${escapeHtml(t("level1Intro.to"))}</div>
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
          ">${escapeHtml(t("level1Intro.subject"))}</div>
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
            <p style="margin:0 0 ${Math.round(scaleY(5))}px 0;">${escapeHtml(t("level1Intro.greeting"))}</p>
            <p style="margin:0 0 ${Math.round(scaleY(5))}px 0;">${escapeHtml(t("level1Intro.body1"))}</p>
            <p style="margin:0 0 ${Math.round(scaleY(6))}px 0;">${escapeHtml(t("level1Intro.body2"))}</p>
            <div style="
              margin-top:${Math.round(scaleY(5))}px;
              padding-top:${Math.round(scaleY(5))}px;
              border-top:2px solid #cbd5e1;
              color:#0f172a;
              font-weight:800;
            ">${escapeHtml(t("level1Intro.instructions"))}</div>
          </div>
          <div style="
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
          ">${escapeHtml(t("level1Intro.continue"))}</div>
        </div>
      </div>
    `;

    const card = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html).setOrigin(0.5);
    card.addListener("click");
    card.on("click", (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action='continue']")) {
        this.continueToLevel();
      }
    });

    const ctaH = Math.round(scaleY(30));
    this.add
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
    this.audio.playSfx("sfx-confirm", AUDIO.SFX.CONFIRM);
    runState.levelStartTimeMs = Date.now();
    this.scene.start("Level1Scene");
  }
}

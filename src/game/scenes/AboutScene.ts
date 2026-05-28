import Phaser from "phaser";
import { AUDIO } from "../../config/physics";
import { AudioManager } from "../systems/AudioManager";
import { getDirection, t } from "../i18n/i18n";
import { scaleX, scaleY } from "../utils/layout";

const LINKEDIN_URL = "https://www.linkedin.com/in/aviv-galily-789442217/";
const GITHUB_URL = "https://github.com/AvivGalily/juniorQuest";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class AboutScene extends Phaser.Scene {
  private audio!: AudioManager;

  constructor() {
    super("AboutScene");
  }

  create(): void {
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU);

    this.add.image(this.scale.width / 2, this.scale.height / 2, "level1-job-fair-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 0.68);

    this.createEmailCard();

    this.input.keyboard.on("keydown-ESC", () => this.backToMenu());
    this.input.keyboard.on("keydown-X", () => this.backToMenu());
  }

  private createEmailCard(): void {
    const avivSrc = new URL("../img/about-aviv.png", import.meta.url).href;
    const cardW = Math.round(scaleX(548));
    const cardH = Math.round(scaleY(318));
    const headerH = Math.round(scaleY(42));
    const pad = Math.round(scaleX(24));
    const smallFont = Math.round(scaleY(10));
    const bodyFont = Math.round(scaleY(10.4));
    const subjectFont = Math.round(scaleY(12.4));
    const ctaFont = Math.round(scaleY(12));
    const direction = getDirection();
    const textAlign = direction === "rtl" ? "right" : "left";

    const html = `
      <style>
        @keyframes about-avatar-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      </style>
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
          <span>${escapeHtml(t("about.appTitle"))}</span>
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
            grid-template-columns:${Math.round(scaleX(74))}px 1fr;
            column-gap:${Math.round(scaleX(16))}px;
            align-items:center;
            direction:ltr;
          ">
            <div style="
              width:${Math.round(scaleX(64))}px;
              height:${Math.round(scaleY(64))}px;
              border-radius:50%;
              overflow:hidden;
              background:#e0f2fe;
              border:3px solid #38bdf8;
              box-shadow:0 3px 0 rgba(15, 23, 42, 0.25);
              animation:about-avatar-bob 2.7s ease-in-out infinite;
            ">
              <img src="${avivSrc}" alt="Aviv Galily" style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
              " />
            </div>
            <div style="direction:${direction};text-align:${textAlign};font-size:${smallFont}px;line-height:1.35;color:#475569;font-weight:700;overflow:hidden;">
              <div>${escapeHtml(t("about.from"))}</div>
              <div>${escapeHtml(t("about.to"))}</div>
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
          ">${escapeHtml(t("about.subject"))}</div>
          <div style="height:3px;background:#e2e8f0;"></div>
          <div style="
            flex:1;
            min-height:0;
            overflow:hidden;
            font-size:${bodyFont}px;
            line-height:1.24;
            color:#1e293b;
            font-weight:700;
            text-align:${textAlign};
          ">
            <p style="margin:0 0 ${Math.round(scaleY(7))}px 0;">${escapeHtml(t("about.description"))}</p>
            <p style="margin:0 0 ${Math.round(scaleY(6))}px 0;">${escapeHtml(t("about.createdBy"))}</p>
            <p style="margin:0 0 ${Math.round(scaleY(8))}px 0;">${escapeHtml(t("about.rights"))}</p>
            <p style="
              margin:0;
              display:flex;
              flex-wrap:wrap;
              gap:${Math.round(scaleY(4))}px ${Math.round(scaleX(12))}px;
              justify-content:${direction === "rtl" ? "flex-end" : "flex-start"};
              align-items:center;
            ">
              <a href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:900;text-decoration:underline;">${escapeHtml(t("about.linkedin"))}</a>
              <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:900;text-decoration:underline;">${escapeHtml(t("about.github"))}</a>
            </p>
          </div>
          <button data-action="back" style="
            height:${Math.round(scaleY(30))}px;
            flex:0 0 ${Math.round(scaleY(30))}px;
            box-sizing:border-box;
            border:3px solid #38bdf8;
            background:#e0f2fe;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#0f172a;
            font-family:'Courier New', Courier, monospace;
            font-size:${ctaFont}px;
            font-weight:800;
            text-align:center;
            cursor:pointer;
          ">${escapeHtml(t("about.back"))}</button>
        </div>
      </div>
    `;

    const card = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html).setOrigin(0.5);
    card.addListener("click");
    card.on("click", (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action='back']")) {
        this.backToMenu();
      }
    });
  }

  private backToMenu(): void {
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT);
    this.scene.start("MenuScene");
  }
}

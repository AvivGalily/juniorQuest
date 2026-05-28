import Phaser from "phaser";
import { AUDIO } from "../../config/physics";
import { getDirection, getLocale, t } from "../i18n/i18n";
import { AudioManager } from "../systems/AudioManager";
import { LeaderboardEntry, loadLeaderboard } from "../systems/SaveSystem";
import { createDialogText } from "../utils/domText";
import { scaleX, scaleY } from "../utils/layout";
import { getUiScale } from "../utils/resolution";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class LeaderboardScene extends Phaser.Scene {
  private audio!: AudioManager;
  private leaderboardLoadId = 0;
  private leaderboardActive = false;
  private leaderboardPanel?: Phaser.GameObjects.DOMElement;

  constructor() {
    super("LeaderboardScene");
  }

  create(): void {
    this.leaderboardActive = true;
    const loadId = ++this.leaderboardLoadId;
    this.audio = new AudioManager(this);
    this.audio.playMusic("music-menu", AUDIO.MUSIC.MENU);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.leaderboardActive = false;
      this.leaderboardLoadId += 1;
      this.leaderboardPanel?.destroy();
      this.leaderboardPanel = undefined;
      this.audio.stopMusic("music-menu");
    });

    this.add.image(this.scale.width / 2, this.scale.height / 2, "level4-hitech-tower-bg").setDisplaySize(this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x07111c, 0.5);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0f172a, 0.18);

    void this.createLeaderboardPanel(loadId);
    this.createBackButton();
    this.input.keyboard.on("keydown-ESC", () => this.returnToMenu());
  }

  private async createLeaderboardPanel(loadId: number): Promise<void> {
    const entries = (await loadLeaderboard()).entries;
    if (!this.leaderboardActive || loadId !== this.leaderboardLoadId) {
      return;
    }

    const direction = getDirection();
    const align = direction === "rtl" ? "right" : "left";
    const panelW = Math.round(scaleX(540));
    const panelH = Math.round(scaleY(300));
    const titleFont = Math.round(scaleY(24));
    const subtitleFont = Math.round(scaleY(11));
    const tableFont = Math.round(scaleY(11));
    const pad = Math.round(scaleX(22));

    const rows =
      entries.length > 0
        ? entries.map((entry, index) => this.createRowHtml(entry, index)).join("")
        : `<tr><td colspan="4" style="padding:${Math.round(scaleY(34))}px;text-align:center;color:#cbd5e1;font-weight:800;">${escapeHtml(
            t("leaderboard.noScores")
          )}</td></tr>`;

    const html = `
      <section style="
        width:${panelW}px;
        height:${panelH}px;
        box-sizing:border-box;
        padding:${Math.round(scaleY(18))}px ${pad}px ${Math.round(scaleY(16))}px ${pad}px;
        background:rgba(2, 6, 23, 0.72);
        border:2px solid rgba(148, 163, 184, 0.58);
        box-shadow:${Math.round(scaleX(8))}px ${Math.round(scaleY(10))}px 0 rgba(2, 6, 23, 0.35);
        backdrop-filter:blur(4px);
        color:#e8eef2;
        font-family:'Courier New', Courier, monospace;
        direction:${direction};
        text-align:${align};
      ">
        <header style="display:flex;justify-content:space-between;gap:${Math.round(scaleX(16))}px;align-items:flex-end;direction:${direction};">
          <div>
            <h1 style="margin:0;color:#ffd166;font-size:${titleFont}px;line-height:1;font-weight:900;">${escapeHtml(t("leaderboard.title"))}</h1>
            <p style="margin:${Math.round(scaleY(6))}px 0 0 0;color:#bfdbfe;font-size:${subtitleFont}px;font-weight:800;">${escapeHtml(
              t("leaderboard.subtitle")
            )}</p>
          </div>
          <div style="font-size:${subtitleFont}px;color:#93c5fd;font-weight:800;white-space:nowrap;">${escapeHtml(
            t("leaderboard.total", { count: entries.length })
          )}</div>
        </header>
        <div style="
          margin-top:${Math.round(scaleY(14))}px;
          height:${Math.round(scaleY(210))}px;
          overflow-y:auto;
          border-top:1px solid rgba(148, 163, 184, 0.42);
        ">
          <table style="width:100%;border-collapse:collapse;font-size:${tableFont}px;line-height:1.25;color:#e2e8f0;direction:${direction};">
            <thead>
              <tr style="color:#fef08a;text-transform:uppercase;">
                <th style="${this.headerStyle()}">${escapeHtml(t("leaderboard.rank"))}</th>
                <th style="${this.headerStyle()}">${escapeHtml(t("leaderboard.name"))}</th>
                <th style="${this.headerStyle()}">${escapeHtml(t("leaderboard.score"))}</th>
                <th style="${this.headerStyle()}">${escapeHtml(t("leaderboard.date"))}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;

    this.leaderboardPanel = this.add.dom(this.scale.width / 2, scaleY(172)).createFromHTML(html).setOrigin(0.5);
  }

  private headerStyle(): string {
    return `padding:${Math.round(scaleY(8))}px ${Math.round(scaleX(8))}px;border-bottom:1px solid rgba(148, 163, 184, 0.35);font-weight:900;`;
  }

  private createRowHtml(entry: LeaderboardEntry, index: number): string {
    const rowBg = index % 2 === 0 ? "rgba(15, 23, 42, 0.46)" : "rgba(30, 41, 59, 0.34)";
    const medal = index === 0 ? "#facc15" : index === 1 ? "#cbd5e1" : index === 2 ? "#f59e0b" : "#93c5fd";
    return `
      <tr style="background:${rowBg};">
        <td style="${this.cellStyle()}color:${medal};font-weight:900;">${index + 1}</td>
        <td style="${this.cellStyle()}font-weight:900;color:#f8fafc;">${escapeHtml(entry.name)}</td>
        <td style="${this.cellStyle()}font-weight:900;color:#86efac;">${entry.score}</td>
        <td style="${this.cellStyle()}color:#cbd5e1;">${escapeHtml(this.formatDate(entry.dateISO))}</td>
      </tr>
    `;
  }

  private cellStyle(): string {
    return `padding:${Math.round(scaleY(7))}px ${Math.round(scaleX(8))}px;border-bottom:1px solid rgba(148, 163, 184, 0.14);`;
  }

  private formatDate(dateISO: string): string {
    const date = new Date(dateISO);
    if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
      return "-";
    }
    return new Intl.DateTimeFormat(getLocale() === "he" ? "he-IL" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  private createBackButton(): void {
    const x = scaleX(320);
    const y = scaleY(340);
    const btn = this.add.image(x, y, "button").setInteractive({ useHandCursor: true });
    btn.setScale(getUiScale());
    createDialogText(this, x, y, t("common.backToMenu"), {
      maxWidth: 190,
      fontSize: 16,
      color: "#e8eef2"
    });
    btn.on("pointerover", () => btn.setTint(0x8fe388));
    btn.on("pointerout", () => btn.clearTint());
    btn.on("pointerdown", () => this.returnToMenu());
  }

  private returnToMenu(): void {
    this.audio.playSfx("sfx-select", AUDIO.SFX.SELECT);
    this.scene.start("MenuScene");
  }
}

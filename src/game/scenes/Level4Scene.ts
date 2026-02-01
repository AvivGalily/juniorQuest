import Phaser from "phaser";
import { BaseLevelScene } from "./BaseLevelScene";
import { Player } from "../entities/player/Player";
import { Rival } from "../entities/Rival";
import { difficultyPresets } from "../../config/difficulty";
import { runState } from "../RunState";
import { FloatingText } from "../entities/FloatingText";

export class Level4Scene extends BaseLevelScene {
  private player!: Player;
  private rivals: Rival[] = [];
  private checkpointY = 2200;
  private checkpointEvery = 450;
  private doorZone!: Phaser.GameObjects.Rectangle;
  private pushStrength = 220;

  constructor() {
    super("Level4Scene");
  }

  create(): void {
    this.initLevel(4);
    this.audio.playMusic("music-gameplay", 0.2);
    this.physics.world.gravity.y = 700;
    this.physics.world.setBounds(0, 0, 640, 2400);
    this.cameras.main.setBounds(0, 0, 640, 2400);

    this.add.rectangle(320, 1200, 640, 2400, 0x0f1621);

    const platforms = this.physics.add.staticGroup();
    platforms.create(320, 2360, "platform").setScale(10, 1).refreshBody();

    let y = 2200;
    let offset = 0;
    for (let i = 0; i < 18; i += 1) {
      const x = 120 + (offset % 3) * 180;
      platforms.create(x, y, "platform");
      y -= 120;
      offset += 1;
    }

    this.player = new Player(this, 100, 2300);
    this.setPlayer(this.player);
    this.physics.add.collider(this.player, platforms);

    const diff = difficultyPresets[runState.difficulty];
    this.checkpointEvery = diff.l4.checkpointEveryPx;
    this.pushStrength = diff.l4.pushStrength;

    for (let i = 0; i < diff.l4.rivalsCount; i += 1) {
      const rival = new Rival(this, 180 + i * 40, 2300);
      this.rivals.push(rival);
      this.physics.add.collider(rival, platforms);
      this.physics.add.collider(this.player, rival, () => {
        const pushDir = this.player.x < rival.x ? -1 : 1;
        this.player.setVelocityX(pushDir * this.pushStrength);
        this.player.setVelocityY(this.pushStrength * 0.7);
      });
    }

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.doorZone = this.add.rectangle(320, 80, 80, 40, 0x8fe388, 0.7);
    this.physics.add.existing(this.doorZone, true);

    this.physics.add.overlap(this.player, this.doorZone, () => this.completeLevel());
  }

  update(_: number, __: number): void {
    this.handlePauseToggle();
    if (this.paused) {
      return;
    }
    this.player.updatePlatformer(this.inputManager, 150, 300);

    for (const rival of this.rivals) {
      rival.updateAI(this.player.x);
      if (this.player.y < rival.y && !rival.getData("overtaken")) {
        rival.setData("overtaken", true);
        this.scoreSystem.addSkill(100);
        FloatingText.spawn(this, rival.x, rival.y - 20, "+100", "#8fe388");
      }
    }

    if (this.inputManager.justPressedConfirm()) {
      const rival = this.getNearestRival();
      if (rival) {
        const dir = rival.x < this.player.x ? -1 : 1;
        rival.setVelocityY(-this.pushStrength * 0.9);
        rival.setVelocityX(dir * this.pushStrength);
      }
    }

    if (this.player.y > this.cameras.main.scrollY + 400) {
      this.scoreSystem.addPenalty(-100);
      this.scoreSystem.breakCombo();
      this.applyDamage(() => {
        this.player.setPosition(100, this.checkpointY);
      });
      FloatingText.spawn(this, this.player.x, this.player.y - 20, "-100", "#ff6b6b");
    }

    if (this.player.y < this.checkpointY - this.checkpointEvery) {
      this.checkpointY = this.player.y;
    }

    this.hud.updateAll();
  }

  private getNearestRival(): Rival | null {
    let best: Rival | null = null;
    let bestDist = 9999;
    for (const rival of this.rivals) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, rival.x, rival.y);
      if (dist < 40 && dist < bestDist) {
        bestDist = dist;
        best = rival;
      }
    }
    return best;
  }

  private completeLevel(): void {
    this.scoreSystem.addBase(2500);
    if (runState.hearts === 3) {
      this.scoreSystem.addBase(600);
    }
    this.scoreSystem.applyTimeBonus(150000);
    this.audio.playSfx("sfx-level-complete", 0.6);
    FloatingText.spawn(this, 320, this.cameras.main.scrollY + 80, "+2500", "#8fe388");
    this.hud.updateAll();
    this.time.delayedCall(1200, () => this.scene.start("Level5Scene"));
  }
}

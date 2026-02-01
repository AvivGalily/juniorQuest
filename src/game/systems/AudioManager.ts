import Phaser from "phaser";

export class AudioManager {
  private scene: Phaser.Scene;
  private static currentMusic?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  playSfx(key: string, volume = 0.5): void {
    if (!this.scene.cache.audio.exists(key)) {
      return;
    }
    this.scene.sound.play(key, { volume });
  }

  playMusic(key: string, volume = 0.35): void {
    if (!this.scene.cache.audio.exists(key)) {
      return;
    }
    if (AudioManager.currentMusic?.key === key) {
      return;
    }
    AudioManager.currentMusic?.stop();
    const music = this.scene.sound.add(key, { volume, loop: true });
    music.play();
    AudioManager.currentMusic = music;
  }

  stopMusic(): void {
    AudioManager.currentMusic?.stop();
    AudioManager.currentMusic = undefined;
  }
}

import Phaser from "phaser";

export class InputManager {
  private scene: Phaser.Scene;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  keys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    X: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    ENTER: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys({
      W: "W",
      A: "A",
      S: "S",
      D: "D",
      Q: "Q",
      E: "E",
      F: "F",
      X: "X",
      SHIFT: "SHIFT",
      ENTER: "ENTER",
      SPACE: "SPACE",
      ESC: "ESC"
    }) as typeof this.keys;
  }

  getMoveVector(): Phaser.Math.Vector2 {
    const x = (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
    const y = (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0);
    const vec = new Phaser.Math.Vector2(x, y);
    if (vec.lengthSq() > 1) {
      vec.normalize();
    }
    return vec;
  }

  getAxisX(): number {
    return (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
  }

  getAxisY(): number {
    return (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0);
  }

  justPressedConfirm(): boolean {
    const pointer = this.scene.input.activePointer;
    return Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || pointer.justDown;
  }

  isConfirmDown(): boolean {
    return this.keys.SPACE.isDown || this.keys.ENTER.isDown || this.scene.input.activePointer.isDown;
  }

  justPressedPause(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.ESC);
  }

  justPressedJump(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
  }

  justPressedAttack(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.F);
  }

  justPressedPickup(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.X);
  }

  justPressedShift(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
  }
}

import Phaser from "phaser";
import { VirtualGamepad } from "./VirtualGamepad";

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
    const vg = VirtualGamepad.getInstance();
    const x = (this.keys.D.isDown || this.cursors.right.isDown || vg.axisX > 0 ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown || vg.axisX < 0 ? 1 : 0);
    const y = (this.keys.S.isDown || this.cursors.down.isDown || vg.axisY > 0 ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown || vg.axisY < 0 ? 1 : 0);
    const vec = new Phaser.Math.Vector2(x, y);
    if (vec.lengthSq() > 1) {
      vec.normalize();
    }
    return vec;
  }

  getAxisX(): number {
    const vg = VirtualGamepad.getInstance();
    return (this.keys.D.isDown || this.cursors.right.isDown || vg.axisX > 0 ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown || vg.axisX < 0 ? 1 : 0);
  }

  getAxisY(): number {
    const vg = VirtualGamepad.getInstance();
    return (this.keys.S.isDown || this.cursors.down.isDown || vg.axisY > 0 ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown || vg.axisY < 0 ? 1 : 0);
  }

  isActionDown(): boolean {
    return this.keys.X.isDown || VirtualGamepad.getInstance().isActionDown();
  }

  justPressedConfirm(): boolean {
    const pointer = this.scene.input.activePointer;
    return Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || pointer.justDown || VirtualGamepad.getInstance().justPressedJump() || VirtualGamepad.getInstance().justPressedAction();
  }

  justPressedInteract(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.X) || VirtualGamepad.getInstance().justPressedAction();
  }

  isConfirmDown(): boolean {
    return this.keys.SPACE.isDown || this.keys.ENTER.isDown || this.scene.input.activePointer.isDown || VirtualGamepad.getInstance().isJumpDown() || VirtualGamepad.getInstance().isActionDown();
  }

  justPressedPause(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.ESC) || VirtualGamepad.getInstance().justPressedPause();
  }

  justPressedJump(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || VirtualGamepad.getInstance().justPressedJump();
  }

  justPressedAttack(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.F) || VirtualGamepad.getInstance().justPressedAction();
  }

  justPressedPickup(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.X) || VirtualGamepad.getInstance().justPressedAction();
  }

  justPressedShift(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.SHIFT) || VirtualGamepad.getInstance().justPressedJump();
  }
}

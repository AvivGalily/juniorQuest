import { runState } from "../RunState";
import { ComboSystem } from "./ComboSystem";

export class ScoreSystem {
  private combo: ComboSystem;
  private timeFactorPerSec = 20;

  constructor(combo: ComboSystem) {
    this.combo = combo;
  }

  addSkill(points: number): number {
    const mult = this.combo.increase();
    const add = Math.round(points * mult);
    runState.runScore += add;
    return add;
  }

  addBase(points: number): number {
    runState.runScore += points;
    return points;
  }

  addPenalty(points: number): number {
    runState.runScore += points;
    return points;
  }

  breakCombo(): void {
    this.combo.reset();
  }

  applyTimeBonus(targetMs: number): number {
    const elapsedMs = Date.now() - runState.levelStartTimeMs;
    const bonus = Math.max(0, targetMs - elapsedMs) / 1000 * this.timeFactorPerSec;
    const add = Math.floor(bonus);
    runState.runScore += add;
    return add;
  }
}

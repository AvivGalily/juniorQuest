import { runState } from "../RunState";

export class ComboSystem {
  get multiplier(): number {
    return 1 + Math.min(runState.comboSteps, 8) * 0.1;
  }

  increase(): number {
    runState.comboSteps = Math.min(runState.comboSteps + 1, 8);
    return this.multiplier;
  }

  reset(): void {
    runState.comboSteps = 0;
  }
}

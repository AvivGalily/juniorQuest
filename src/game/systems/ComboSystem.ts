import { COMBO } from "../../config/physics";
import { runState } from "../RunState";

export class ComboSystem {
  get multiplier(): number {
    return COMBO.BASE_MULTIPLIER + Math.min(runState.comboSteps, COMBO.MAX_STEPS) * COMBO.STEP_MULTIPLIER;
  }

  increase(): number {
    runState.comboSteps = Math.min(runState.comboSteps + 1, COMBO.MAX_STEPS);
    return this.multiplier;
  }

  reset(): void {
    runState.comboSteps = 0;
  }
}

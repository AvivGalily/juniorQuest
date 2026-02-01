import { Difficulty } from "../config/difficulty";

class RunState {
  currentLevel = 1;
  runScore = 0;
  hearts = 3;
  comboSteps = 0;
  difficulty: Difficulty = "bootcamp";
  levelStartTimeMs = 0;
  mistakes = 0;

  resetRun(): void {
    this.currentLevel = 1;
    this.runScore = 0;
    this.hearts = 3;
    this.comboSteps = 0;
    this.mistakes = 0;
    this.levelStartTimeMs = Date.now();
  }

  resetLevel(): void {
    this.hearts = 3;
    this.comboSteps = 0;
    this.mistakes = 0;
    this.levelStartTimeMs = Date.now();
  }
}

export const runState = new RunState();

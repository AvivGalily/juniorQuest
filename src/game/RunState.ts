import { Difficulty, readStoredDifficulty, saveDifficulty } from "../config/difficulty";
import { RUN } from "../config/physics";

class RunState {
  currentLevel: number = RUN.DEFAULT_LEVEL;
  runScore: number = RUN.DEFAULT_SCORE;
  hearts: number = RUN.DEFAULT_HEARTS;
  comboSteps: number = RUN.DEFAULT_COMBO_STEPS;
  difficulty: Difficulty = readStoredDifficulty();
  levelStartTimeMs: number = 0;
  level2ElapsedMs: number = 0;
  mistakes: number = RUN.DEFAULT_MISTAKES;

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    saveDifficulty(difficulty);
  }

  resetRun(): void {
    this.currentLevel = RUN.DEFAULT_LEVEL;
    this.runScore = RUN.DEFAULT_SCORE;
    this.hearts = RUN.DEFAULT_HEARTS;
    this.comboSteps = RUN.DEFAULT_COMBO_STEPS;
    this.mistakes = RUN.DEFAULT_MISTAKES;
    this.levelStartTimeMs = Date.now();
    this.level2ElapsedMs = 0;
  }

  resetLevel(): void {
    this.hearts = RUN.DEFAULT_HEARTS;
    this.comboSteps = RUN.DEFAULT_COMBO_STEPS;
    this.mistakes = RUN.DEFAULT_MISTAKES;
    this.levelStartTimeMs = Date.now();
  }
}

export const runState = new RunState();

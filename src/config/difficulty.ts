export type Difficulty = "bootcamp" | "college" | "university";

export interface DifficultyConfig {
  l1: {
    guardFovDeg: number;
    detectionHoldMs: number;
    guardSpeed: number;
    recruiterCount: number;
  };
  l2: {
    waterRisePxPerSec: number;
    waterPenaltyJumpPx: number;
    cubeCount: number;
    requiredPlacements: number;
  };
  l3: {
    nodesCount: number;
    comboWindowMs: number;
    snakeAttackIntervalMs: number;
  };
  l4: {
    rivalsCount: number;
    checkpointEveryPx: number;
    pushStrength: number;
  };
  l5: {
    bossHP: number;
    patternWindowMs: number;
    minReactionWindowMs: number;
    patternSpeed: number;
  };
}

export const difficultyPresets: Record<Difficulty, DifficultyConfig> = {
  bootcamp: {
    l1: {
      guardFovDeg: 60,
      detectionHoldMs: 1000,
      guardSpeed: 60,
      recruiterCount: 10
    },
    l2: {
      waterRisePxPerSec: 3,
      waterPenaltyJumpPx: 16,
      cubeCount: 15,
      requiredPlacements: 11
    },
    l3: {
      nodesCount: 7,
      comboWindowMs: 2000,
      snakeAttackIntervalMs: 2500
    },
    l4: {
      rivalsCount: 4,
      checkpointEveryPx: 450,
      pushStrength: 220
    },
    l5: {
      bossHP: 12,
      patternWindowMs: 1600,
      minReactionWindowMs: 900,
      patternSpeed: 1
    }
  },
  college: {
    l1: {
      guardFovDeg: 70,
      detectionHoldMs: 900,
      guardSpeed: 70,
      recruiterCount: 10
    },
    l2: {
      waterRisePxPerSec: 4,
      waterPenaltyJumpPx: 18,
      cubeCount: 16,
      requiredPlacements: 12
    },
    l3: {
      nodesCount: 8,
      comboWindowMs: 1800,
      snakeAttackIntervalMs: 2300
    },
    l4: {
      rivalsCount: 5,
      checkpointEveryPx: 420,
      pushStrength: 240
    },
    l5: {
      bossHP: 14,
      patternWindowMs: 1500,
      minReactionWindowMs: 800,
      patternSpeed: 1.1
    }
  },
  university: {
    l1: {
      guardFovDeg: 80,
      detectionHoldMs: 800,
      guardSpeed: 80,
      recruiterCount: 10
    },
    l2: {
      waterRisePxPerSec: 5,
      waterPenaltyJumpPx: 20,
      cubeCount: 18,
      requiredPlacements: 13
    },
    l3: {
      nodesCount: 9,
      comboWindowMs: 1700,
      snakeAttackIntervalMs: 2100
    },
    l4: {
      rivalsCount: 6,
      checkpointEveryPx: 400,
      pushStrength: 260
    },
    l5: {
      bossHP: 16,
      patternWindowMs: 1400,
      minReactionWindowMs: 750,
      patternSpeed: 1.2
    }
  }
};

import { LEVEL1, LEVEL2, LEVEL4, LEVEL5, TIME } from "./physics";

export type Difficulty = "university" | "college" | "bootcamp";

export interface DifficultyConfig {
  l1: {
    guardCount: number;
    recruiterCount: number;
    guardFovDeg: number;
    detectionHoldMs: number;
    guardSpeed: number;
  };
  l2: {
    requiredPlacements: number;
    timeLimitMs: number;
  };
  l3: {
    nodesCount: number;
    hazardFrequencyMultiplier: number;
  };
  l4: {
    rivalsCount: number;
    boostSpawnMultiplier: number;
    rivalJumpHeightMultiplier: number;
    pushStrength: number;
  };
  l5: {
    bossHp: number;
    miniBossTriggerHp: number;
    miniBossCount: number;
  };
}

export const DEFAULT_DIFFICULTY: Difficulty = "college";
export const DIFFICULTY_STORAGE_KEY = "juniorquest_difficulty_v1";
export const difficultyOrder: Difficulty[] = ["university", "college", "bootcamp"];

const currentLevel3Nodes = 7;

export const difficultyPresets: Record<Difficulty, DifficultyConfig> = {
  university: {
    l1: {
      guardCount: Math.max(1, 2 - 1),
      recruiterCount: Math.max(1, LEVEL1.RECRUITER_COUNT - 2),
      guardFovDeg: 60,
      detectionHoldMs: 1000,
      guardSpeed: 60
    },
    l2: {
      requiredPlacements: Math.max(1, LEVEL2.DEFAULT_REQUIRED_PLACEMENTS - 2),
      timeLimitMs: LEVEL2.TIME_LIMIT_MS + 30 * TIME.MS_PER_SEC
    },
    l3: {
      nodesCount: Math.max(1, currentLevel3Nodes - 2),
      hazardFrequencyMultiplier: 0.8
    },
    l4: {
      rivalsCount: 4,
      boostSpawnMultiplier: 1.3,
      rivalJumpHeightMultiplier: 1,
      pushStrength: LEVEL4.DEFAULT_PUSH_STRENGTH
    },
    l5: {
      bossHp: 80,
      miniBossTriggerHp: 40,
      miniBossCount: 1
    }
  },
  college: {
    l1: {
      guardCount: 2,
      recruiterCount: LEVEL1.RECRUITER_COUNT,
      guardFovDeg: 60,
      detectionHoldMs: 1000,
      guardSpeed: 60
    },
    l2: {
      requiredPlacements: LEVEL2.DEFAULT_REQUIRED_PLACEMENTS,
      timeLimitMs: LEVEL2.TIME_LIMIT_MS
    },
    l3: {
      nodesCount: currentLevel3Nodes,
      hazardFrequencyMultiplier: 1
    },
    l4: {
      rivalsCount: 4,
      boostSpawnMultiplier: 1,
      rivalJumpHeightMultiplier: 1,
      pushStrength: LEVEL4.DEFAULT_PUSH_STRENGTH
    },
    l5: {
      bossHp: LEVEL5.BOSS_HP,
      miniBossTriggerHp: LEVEL5.MINI_BOSS_TRIGGER_HP,
      miniBossCount: LEVEL5.MINI_BOSS_COUNT
    }
  },
  bootcamp: {
    l1: {
      guardCount: 2 + 3,
      recruiterCount: LEVEL1.RECRUITER_COUNT + 1,
      guardFovDeg: 60,
      detectionHoldMs: 1000,
      guardSpeed: 60
    },
    l2: {
      requiredPlacements: Math.min(LEVEL2.DEFAULT_REQUIRED_PLACEMENTS + 2, 15),
      timeLimitMs: Math.max(30 * TIME.MS_PER_SEC, LEVEL2.TIME_LIMIT_MS - 30 * TIME.MS_PER_SEC)
    },
    l3: {
      nodesCount: currentLevel3Nodes + 2,
      hazardFrequencyMultiplier: 1.2
    },
    l4: {
      rivalsCount: 4,
      boostSpawnMultiplier: 0.5,
      rivalJumpHeightMultiplier: 2,
      pushStrength: LEVEL4.DEFAULT_PUSH_STRENGTH
    },
    l5: {
      bossHp: 150,
      miniBossTriggerHp: 50,
      miniBossCount: 3
    }
  }
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "university" || value === "college" || value === "bootcamp";
}

export function readStoredDifficulty(): Difficulty {
  if (typeof localStorage === "undefined") {
    return DEFAULT_DIFFICULTY;
  }
  const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
  return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
}

export function saveDifficulty(difficulty: Difficulty): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty);
  }
}

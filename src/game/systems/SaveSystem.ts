import { LEADERBOARD } from "../../config/physics";
import seedLeaderboard from "../data/leaderboard.json";

export interface LeaderboardEntry {
  name: string;
  score: number;
  dateISO: string;
}

type LeaderboardData = { entries: LeaderboardEntry[] };

const KEY = `${LEADERBOARD.KEY_PREFIX}${LEADERBOARD.VERSION}`;

const normalizeEntries = (entries: unknown): LeaderboardEntry[] => {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter((entry): entry is Partial<LeaderboardEntry> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name.slice(0, LEADERBOARD.NAME_MAX_LEN) : "ANON",
      score: typeof entry.score === "number" && Number.isFinite(entry.score) ? Math.round(entry.score) : 0,
      dateISO: typeof entry.dateISO === "string" ? entry.dateISO : new Date(0).toISOString()
    }))
    .sort((a, b) => b.score - a.score);
};

const getSeedLeaderboard = (): LeaderboardData => ({
  entries: normalizeEntries((seedLeaderboard as { entries?: unknown }).entries)
});

export const loadLeaderboard = (): LeaderboardData => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return getSeedLeaderboard();
    }
    const parsed = JSON.parse(raw) as { entries?: unknown };
    return { entries: normalizeEntries(parsed.entries) };
  } catch {
    return getSeedLeaderboard();
  }
};

export const saveLeaderboard = (data: LeaderboardData): void => {
  localStorage.setItem(KEY, JSON.stringify({ entries: normalizeEntries(data.entries) }));
};

export const addLeaderboardEntry = (name: string, score: number): LeaderboardEntry[] => {
  const sanitized = name.trim().slice(0, LEADERBOARD.NAME_MAX_LEN) || "ANON";
  const entry: LeaderboardEntry = {
    name: sanitized,
    score,
    dateISO: new Date().toISOString()
  };
  const data = loadLeaderboard();
  data.entries.push(entry);
  data.entries.sort((a, b) => b.score - a.score);
  saveLeaderboard(data);
  return data.entries;
};

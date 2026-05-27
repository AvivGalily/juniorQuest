import { LEADERBOARD } from "../../config/physics";
import seedLeaderboard from "../data/leaderboard.json";

export interface LeaderboardEntry {
  name: string;
  score: number;
  dateISO: string;
}

type LeaderboardData = { entries: LeaderboardEntry[] };
type JuniorQuestConfig = { leaderboardApiUrl?: string };

declare global {
  interface Window {
    JUNIORQUEST_CONFIG?: JuniorQuestConfig;
  }
}

const KEY = `${LEADERBOARD.KEY_PREFIX}${LEADERBOARD.VERSION}`;
const MAX_ENTRIES = 100;

const sanitizeName = (name: string): string =>
  name.trim().replace(/[^A-Za-z0-9\u0590-\u05FF]/g, "").slice(0, LEADERBOARD.NAME_MAX_LEN) || "ANON";

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
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
};

const getSeedLeaderboard = (): LeaderboardData => ({
  entries: normalizeEntries((seedLeaderboard as { entries?: unknown }).entries)
});

const getLeaderboardApiUrl = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.JUNIORQUEST_CONFIG?.leaderboardApiUrl?.trim().replace(/\/+$/, "") ?? "";
};

const loadLocalLeaderboard = (): LeaderboardData => {
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

const saveLocalLeaderboard = (data: LeaderboardData): void => {
  localStorage.setItem(KEY, JSON.stringify({ entries: normalizeEntries(data.entries) }));
};

const loadRemoteLeaderboard = async (apiUrl: string): Promise<LeaderboardData> => {
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Leaderboard load failed with ${response.status}`);
  }
  const data = (await response.json()) as { entries?: unknown };
  return { entries: normalizeEntries(data.entries) };
};

const addRemoteLeaderboardEntry = async (apiUrl: string, name: string, score: number): Promise<LeaderboardData> => {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, score: Math.round(score) })
  });
  if (!response.ok) {
    throw new Error(`Leaderboard save failed with ${response.status}`);
  }
  const data = (await response.json()) as { entries?: unknown };
  return { entries: normalizeEntries(data.entries) };
};

export const loadLeaderboard = async (): Promise<LeaderboardData> => {
  const apiUrl = getLeaderboardApiUrl();
  if (!apiUrl) {
    return loadLocalLeaderboard();
  }

  try {
    return await loadRemoteLeaderboard(apiUrl);
  } catch (error) {
    console.warn("Remote leaderboard unavailable; falling back to local scores.", error);
    return loadLocalLeaderboard();
  }
};

export const saveLeaderboard = (data: LeaderboardData): void => {
  saveLocalLeaderboard(data);
};

export const addLeaderboardEntry = async (name: string, score: number): Promise<LeaderboardEntry[]> => {
  const sanitized = sanitizeName(name);
  const roundedScore = Math.round(score);
  const apiUrl = getLeaderboardApiUrl();

  if (apiUrl) {
    try {
      return (await addRemoteLeaderboardEntry(apiUrl, sanitized, roundedScore)).entries;
    } catch (error) {
      console.warn("Remote leaderboard save failed; saving score locally.", error);
    }
  }

  const entry: LeaderboardEntry = {
    name: sanitized,
    score: roundedScore,
    dateISO: new Date().toISOString()
  };
  const data = loadLocalLeaderboard();
  data.entries.push(entry);
  data.entries.sort((a, b) => b.score - a.score);
  saveLocalLeaderboard(data);
  return data.entries;
};

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
const CACHE_TTL_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

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

// --- In-memory cache ---

let cachedEntries: LeaderboardEntry[] | null = null;
let cacheTimestamp = 0;

const isCacheValid = (): boolean =>
  cachedEntries !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;

const setCache = (entries: LeaderboardEntry[]): void => {
  cachedEntries = entries;
  cacheTimestamp = Date.now();
};

const invalidateCache = (): void => {
  cachedEntries = null;
  cacheTimestamp = 0;
};

// --- Environment detection ---

const getLeaderboardApiUrl = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.JUNIORQUEST_CONFIG?.leaderboardApiUrl?.trim().replace(/\/+$/, "") ?? "";
};

// --- Local storage ---

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

// --- Remote API with retry ---

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      await delay(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw new Error("All retry attempts exhausted");
};

const loadRemoteLeaderboard = async (apiUrl: string): Promise<LeaderboardData> => {
  const response = await fetchWithRetry(apiUrl, {
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
  const response = await fetchWithRetry(apiUrl, {
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

// --- Public API ---

export const loadLeaderboard = async (): Promise<LeaderboardData> => {
  const apiUrl = getLeaderboardApiUrl();

  if (!apiUrl) {
    return loadLocalLeaderboard();
  }

  if (isCacheValid()) {
    return { entries: cachedEntries! };
  }

  try {
    const data = await loadRemoteLeaderboard(apiUrl);
    setCache(data.entries);
    return data;
  } catch (error) {
    console.warn("Remote leaderboard unavailable.", error);
    return { entries: cachedEntries ?? [] };
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
      const result = await addRemoteLeaderboardEntry(apiUrl, sanitized, roundedScore);
      setCache(result.entries);
      return result.entries;
    } catch (error) {
      invalidateCache();
      throw error;
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

export interface LeaderboardEntry {
  name: string;
  score: number;
  dateISO: string;
}

const KEY = "juniorquest_leaderboard_v1";

export const loadLeaderboard = (): { entries: LeaderboardEntry[] } => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return { entries: [] };
    }
    const parsed = JSON.parse(raw) as { entries?: LeaderboardEntry[] };
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
};

export const saveLeaderboard = (data: { entries: LeaderboardEntry[] }): void => {
  localStorage.setItem(KEY, JSON.stringify(data));
};

export const addLeaderboardEntry = (name: string, score: number): LeaderboardEntry[] => {
  const sanitized = name.trim().slice(0, 10) || "ANON";
  const entry: LeaderboardEntry = {
    name: sanitized,
    score,
    dateISO: new Date().toISOString()
  };
  const data = loadLeaderboard();
  data.entries.push(entry);
  data.entries.sort((a, b) => b.score - a.score);
  data.entries = data.entries.slice(0, 20);
  saveLeaderboard(data);
  return data.entries;
};

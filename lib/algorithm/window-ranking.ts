import { OLYMPIC_START, OLYMPIC_DAYS_COUNT } from "../schedule-utils";

const FAIRNESS_WEIGHT = 0.5;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

export type WindowRankingInput = {
  memberScores: {
    memberId: string;
    dailyScores: Map<string, number>;
    dailyBackupScores?: Map<string, { b1: number; b2: number }>;
  }[];
  dateMode: "consecutive" | "specific";
  consecutiveDays?: number;
  startDate?: string;
  endDate?: string;
  /** Dates that every valid window must contain (e.g. purchased session dates). */
  requiredDays?: string[];
};

export type WindowRankingResult = {
  startDate: string;
  endDate: string;
  score: number;
};

function scoreWindow(
  days: string[],
  memberScores: {
    memberId: string;
    dailyScores: Map<string, number>;
    dailyBackupScores?: Map<string, { b1: number; b2: number }>;
  }[]
): { score: number; userScoreStdev: number; resilience: number } {
  const userScores = memberScores.map((m) => {
    let total = 0;
    for (const day of days) {
      total += m.dailyScores.get(day) ?? 0;
    }
    return total;
  });

  const baseScore = userScores.reduce((a, b) => a + b, 0);
  const userScoreStdev = stdev(userScores);
  const fairnessPenalty =
    userScoreStdev * memberScores.length * FAIRNESS_WEIGHT;
  const windowScore = baseScore - fairnessPenalty;

  // Compute resilience: average backup coverage across member-days with sessions
  let coverageSum = 0;
  let coverageCount = 0;
  for (const m of memberScores) {
    for (const day of days) {
      const primary = m.dailyScores.get(day) ?? 0;
      if (primary > 0) {
        coverageCount++;
        const backups = m.dailyBackupScores?.get(day);
        if (backups) {
          coverageSum += Math.min((backups.b1 + backups.b2) / (2 * primary), 1);
        }
      }
    }
  }
  const resilience = coverageCount > 0 ? coverageSum / coverageCount : 0;

  return { score: windowScore, userScoreStdev, resilience };
}

/**
 * Builds the memberScores array from a flat list of combos (DB rows or algo output).
 */
export function buildMemberScores(
  combos: { memberId: string; day: string; rank: string; score: number }[]
): WindowRankingInput["memberScores"] {
  const primaryMap = new Map<string, Map<string, number>>();
  const backupMap = new Map<string, Map<string, { b1: number; b2: number }>>();

  for (const c of combos) {
    if (c.rank === "primary") {
      if (!primaryMap.has(c.memberId)) {
        primaryMap.set(c.memberId, new Map());
      }
      primaryMap.get(c.memberId)!.set(c.day, c.score);
    } else if (c.rank === "backup1" || c.rank === "backup2") {
      if (!backupMap.has(c.memberId)) {
        backupMap.set(c.memberId, new Map());
      }
      const existing = backupMap.get(c.memberId)!.get(c.day) ?? {
        b1: 0,
        b2: 0,
      };
      if (c.rank === "backup1") existing.b1 = c.score;
      else existing.b2 = c.score;
      backupMap.get(c.memberId)!.set(c.day, existing);
    }
  }

  return [...primaryMap.entries()].map(([memberId, dailyScores]) => ({
    memberId,
    dailyScores,
    dailyBackupScores: backupMap.get(memberId),
  }));
}

export function computeWindowRankings(
  input: WindowRankingInput
): WindowRankingResult[] {
  const { memberScores, dateMode, consecutiveDays, startDate, endDate } = input;

  if (memberScores.length === 0) return [];

  if (dateMode === "specific") {
    if (!startDate || !endDate) return [];
    const days = daysInRange(startDate, endDate);
    const { score } = scoreWindow(days, memberScores);
    return [{ startDate, endDate, score }];
  }

  // Consecutive mode: slide N-day window across Olympic days
  if (!consecutiveDays || consecutiveDays < 1) return [];

  const olympicEnd = addDays(OLYMPIC_START, OLYMPIC_DAYS_COUNT - 1);
  let windows: (WindowRankingResult & {
    stdev: number;
    resilience: number;
  })[] = [];

  for (
    let offset = 0;
    offset <= OLYMPIC_DAYS_COUNT - consecutiveDays;
    offset++
  ) {
    const winStart = addDays(OLYMPIC_START, offset);
    const winEnd = addDays(winStart, consecutiveDays - 1);
    if (winEnd > olympicEnd) break;

    const days = daysInRange(winStart, winEnd);
    const { score, userScoreStdev, resilience } = scoreWindow(
      days,
      memberScores
    );
    windows.push({
      startDate: winStart,
      endDate: winEnd,
      score,
      stdev: userScoreStdev,
      resilience,
    });
  }

  // Filter to windows that contain all required days (purchased session dates)
  if (input.requiredDays && input.requiredDays.length > 0) {
    const required = input.requiredDays;
    windows = windows.filter((w) =>
      required.every((d) => d >= w.startDate && d <= w.endDate)
    );
  }

  // Sort by score desc, tie-break by lower stdev, then higher resilience, then earlier start
  windows.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    if (Math.abs(a.stdev - b.stdev) > 1e-9) return a.stdev - b.stdev;
    if (Math.abs(b.resilience - a.resilience) > 1e-9)
      return b.resilience - a.resilience;
    return a.startDate.localeCompare(b.startDate);
  });

  return windows.map(({ startDate, endDate, score }) => ({
    startDate,
    endDate,
    score,
  }));
}

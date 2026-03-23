const FAIRNESS_WEIGHT = 0.5;

// All 19 Olympic days: Jul 12 - Jul 30, 2028
const OLYMPIC_START = "2028-07-12";
const OLYMPIC_DAYS = 19;

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

  // Compute resilience: average backup coverage across all members and days
  let coverageSum = 0;
  let coverageCount = 0;
  for (const m of memberScores) {
    for (const day of days) {
      coverageCount++;
      const primary = m.dailyScores.get(day) ?? 0;
      const backups = m.dailyBackupScores?.get(day);
      if (primary > 0 && backups) {
        coverageSum += Math.min((backups.b1 + backups.b2) / (2 * primary), 1);
      }
    }
  }
  const resilience = coverageCount > 0 ? coverageSum / coverageCount : 0;

  return { score: windowScore, userScoreStdev, resilience };
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

  const olympicEnd = addDays(OLYMPIC_START, OLYMPIC_DAYS - 1);
  const windows: (WindowRankingResult & {
    stdev: number;
    resilience: number;
  })[] = [];

  for (let offset = 0; offset <= OLYMPIC_DAYS - consecutiveDays; offset++) {
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

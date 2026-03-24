import { SPORT_COLORS } from "@/lib/constants";

// ── Sport color types & helpers ─────────────────────────────────────────────

export type SportColor = {
  bg: string;
  border: string;
  text: string;
  title: string;
};

export const FALLBACK_SPORT_COLOR: SportColor = {
  bg: "#f1f5f9",
  border: "#94a3b8",
  text: "#475569",
  title: "#64748b",
};

/**
 * Builds a Map of sport name → color from a list of sports.
 * Deduplicates and assigns colors in order from SPORT_COLORS palette.
 */
export function buildSportColorMap(sports: string[]): Map<string, SportColor> {
  const map = new Map<string, SportColor>();
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of sports) {
    if (!seen.has(s)) {
      seen.add(s);
      unique.push(s);
    }
  }
  unique.forEach((sport, i) => {
    const c = SPORT_COLORS[i % SPORT_COLORS.length];
    map.set(sport, {
      bg: c.bg,
      border: c.accent,
      text: c.text,
      title: c.title,
    });
  });
  return map;
}

// ── Rank styling constants ──────────────────────────────────────────────────

export const RANK_LABELS: Record<string, string> = {
  primary: "Primary",
  backup1: "Backup 1",
  backup2: "Backup 2",
};

export const RANK_SHORT_LABELS: Record<string, string> = {
  primary: "P",
  backup1: "B1",
  backup2: "B2",
};

/** Solid background colors for rank tags. */
export const RANK_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  primary: { bg: "#009de5", text: "#ffffff" },
  backup1: { bg: "#d97706", text: "#ffffff" },
  backup2: { bg: "#ff0080", text: "#ffffff" },
};

/** Light translucent background styles for rank tags (detail modal). */
export const RANK_TAG_STYLES_LIGHT: Record<
  string,
  { bg: string; text: string }
> = {
  primary: { bg: "rgba(0, 157, 229, 0.1)", text: "#009de5" },
  backup1: { bg: "rgba(217, 119, 6, 0.1)", text: "#d97706" },
  backup2: { bg: "rgba(255, 0, 128, 0.1)", text: "#ff0080" },
};

/** Tailwind class-based rank filter styles. */
export const RANK_FILTER_STYLES: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  primary: {
    bg: "bg-[#009de5]/10",
    text: "text-[#009de5]",
    ring: "ring-[#009de5]/30",
  },
  backup1: {
    bg: "bg-[#d97706]/10",
    text: "text-[#d97706]",
    ring: "ring-[#d97706]/30",
  },
  backup2: {
    bg: "bg-[#ff0080]/10",
    text: "text-[#ff0080]",
    ring: "ring-[#ff0080]/30",
  },
};

// ── Time grid constants ─────────────────────────────────────────────────────

export const HOUR_START = 6;
export const HOUR_END = 25;
export const TOTAL_HOURS = HOUR_END - HOUR_START;
export const HOUR_HEIGHT = 64;

// ── Olympic dates ───────────────────────────────────────────────────────────

export const OLYMPIC_START = "2028-07-12";
export const OLYMPIC_END = "2028-07-30";
export const OLYMPIC_DAYS_COUNT = 19;

export const OLYMPIC_START_DATE = new Date(OLYMPIC_START + "T12:00:00");

export const OLYMPIC_DAYS_SET = new Set<string>();
export const OLYMPIC_DAYS_LIST: string[] = [];
for (let i = 0; i < OLYMPIC_DAYS_COUNT; i++) {
  const d = new Date(OLYMPIC_START_DATE);
  d.setDate(d.getDate() + i);
  const ds = d.toISOString().split("T")[0];
  OLYMPIC_DAYS_SET.add(ds);
  OLYMPIC_DAYS_LIST.push(ds);
}

// ── Calendar helper functions ───────────────────────────────────────────────

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;
  return total === 0 ? 24 * 60 : total;
}

export function formatHourLabel(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export function buildWeeks(): string[][] {
  const firstOlympic = OLYMPIC_START;
  const lastOlympic = OLYMPIC_END;
  const firstDate = new Date(firstOlympic + "T12:00:00");
  const dow = firstDate.getDay();
  const weekStart = addDays(firstOlympic, -dow);
  const lastDate = new Date(lastOlympic + "T12:00:00");
  const lastDow = lastDate.getDay();
  const saturdayOffset = lastDow === 6 ? 0 : 6 - lastDow;
  const weekEnd = addDays(lastOlympic, saturdayOffset);

  const weeks: string[][] = [];
  let current = weekStart;
  let currentWeek: string[] = [];
  while (current <= weekEnd) {
    currentWeek.push(current);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    current = addDays(current, 1);
  }
  return weeks;
}

export function daysInRange(start: string, end: string): Set<string> {
  const days = new Set<string>();
  let current = start;
  while (current <= end) {
    days.add(current);
    current = addDays(current, 1);
  }
  return days;
}

// ── Session search ──────────────────────────────────────────────────────────

export function matchesSearch(
  session: {
    sessionCode: string;
    sport: string;
    sessionType: string;
    sessionDescription: string | null;
    venue: string;
    zone: string;
  },
  query: string
): boolean {
  if (!query) return true;
  const haystack =
    `${session.sport} ${session.sessionCode} ${session.sessionType} ${session.sessionDescription ?? ""} ${session.venue} ${session.zone}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

// ── Overlap layout ──────────────────────────────────────────────────────────

export type LayoutInfo = { colIndex: number; totalCols: number };

export function computeOverlapLayout(
  sessions: { code: string; startTime: string; endTime: string }[]
): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (sessions.length === 0) return result;

  const sorted = [...sessions].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
  });

  const columns: { end: number; code: string }[][] = [];

  for (const s of sorted) {
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);

    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      if (lastInCol.end <= start) {
        columns[col].push({ end, code: s.code });
        result.set(s.code, { colIndex: col, totalCols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end, code: s.code }]);
      result.set(s.code, {
        colIndex: columns.length - 1,
        totalCols: 0,
      });
    }
  }

  const entries = sorted.map((s) => ({
    code: s.code,
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime),
  }));

  const groups: number[][] = [];
  let currentGroup: number[] = [];
  let groupEnd = 0;

  for (let i = 0; i < entries.length; i++) {
    if (currentGroup.length === 0 || entries[i].start < groupEnd) {
      currentGroup.push(i);
      groupEnd = Math.max(groupEnd, entries[i].end);
    } else {
      groups.push(currentGroup);
      currentGroup = [i];
      groupEnd = entries[i].end;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    const colsUsed = new Set(
      group.map((i) => result.get(entries[i].code)!.colIndex)
    );
    const totalCols = colsUsed.size;
    for (const i of group) {
      const info = result.get(entries[i].code)!;
      info.totalCols = totalCols;
    }
  }

  return result;
}

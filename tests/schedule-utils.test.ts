import { describe, it, expect } from "vitest";
import {
  buildSportColorMap,
  FALLBACK_SPORT_COLOR,
  timeToMinutes,
  formatHourLabel,
  addDays,
  buildWeeks,
  daysInRange,
  matchesSearch,
  computeOverlapLayout,
  RANK_LABELS,
  RANK_SHORT_LABELS,
  RANK_TAG_COLORS,
  HOUR_START,
  HOUR_END,
  TOTAL_HOURS,
  OLYMPIC_DAYS_SET,
  OLYMPIC_DAYS_LIST,
} from "@/lib/schedule-utils";
import { SPORT_COLORS } from "@/lib/constants";

// ── buildSportColorMap ──────────────────────────────────────────────────────

describe("buildSportColorMap", () => {
  it("returns empty map for empty array", () => {
    const map = buildSportColorMap([]);
    expect(map.size).toBe(0);
  });

  it("assigns colors in order from SPORT_COLORS palette", () => {
    const map = buildSportColorMap(["Swimming", "Athletics"]);
    expect(map.size).toBe(2);

    const swim = map.get("Swimming")!;
    expect(swim.bg).toBe(SPORT_COLORS[0].bg);
    expect(swim.border).toBe(SPORT_COLORS[0].accent);
    expect(swim.text).toBe(SPORT_COLORS[0].text);
    expect(swim.title).toBe(SPORT_COLORS[0].title);

    const ath = map.get("Athletics")!;
    expect(ath.bg).toBe(SPORT_COLORS[1].bg);
    expect(ath.border).toBe(SPORT_COLORS[1].accent);
  });

  it("deduplicates sports", () => {
    const map = buildSportColorMap(["Swimming", "Swimming", "Athletics"]);
    expect(map.size).toBe(2);
    // Athletics should get index 1 (not 2)
    expect(map.get("Athletics")!.bg).toBe(SPORT_COLORS[1].bg);
  });

  it("wraps around when more sports than palette entries", () => {
    const sports = Array.from(
      { length: SPORT_COLORS.length + 2 },
      (_, i) => `Sport${i}`
    );
    const map = buildSportColorMap(sports);
    expect(map.size).toBe(sports.length);

    // Sport at index SPORT_COLORS.length wraps to palette[0]
    expect(map.get(`Sport${SPORT_COLORS.length}`)!.bg).toBe(SPORT_COLORS[0].bg);
  });

  it("has 20 colors in the palette", () => {
    expect(SPORT_COLORS.length).toBe(20);
  });
});

// ── FALLBACK_SPORT_COLOR ────────────────────────────────────────────────────

describe("FALLBACK_SPORT_COLOR", () => {
  it("has all required fields", () => {
    expect(FALLBACK_SPORT_COLOR).toHaveProperty("bg");
    expect(FALLBACK_SPORT_COLOR).toHaveProperty("border");
    expect(FALLBACK_SPORT_COLOR).toHaveProperty("text");
    expect(FALLBACK_SPORT_COLOR).toHaveProperty("title");
  });
});

// ── Rank styling constants ──────────────────────────────────────────────────

describe("rank styling constants", () => {
  it("RANK_LABELS covers primary, backup1, backup2", () => {
    expect(RANK_LABELS.primary).toBe("Primary");
    expect(RANK_LABELS.backup1).toBe("Backup 1");
    expect(RANK_LABELS.backup2).toBe("Backup 2");
  });

  it("RANK_SHORT_LABELS covers primary, backup1, backup2", () => {
    expect(RANK_SHORT_LABELS.primary).toBe("P");
    expect(RANK_SHORT_LABELS.backup1).toBe("B1");
    expect(RANK_SHORT_LABELS.backup2).toBe("B2");
  });

  it("RANK_TAG_COLORS has bg and text for each rank", () => {
    for (const rank of ["primary", "backup1", "backup2"]) {
      expect(RANK_TAG_COLORS[rank]).toHaveProperty("bg");
      expect(RANK_TAG_COLORS[rank]).toHaveProperty("text");
    }
  });
});

// ── Time grid constants ─────────────────────────────────────────────────────

describe("time grid constants", () => {
  it("HOUR_START is 6", () => {
    expect(HOUR_START).toBe(6);
  });

  it("HOUR_END is 25", () => {
    expect(HOUR_END).toBe(25);
  });

  it("TOTAL_HOURS equals HOUR_END - HOUR_START", () => {
    expect(TOTAL_HOURS).toBe(HOUR_END - HOUR_START);
  });
});

// ── Olympic date constants ──────────────────────────────────────────────────

describe("Olympic date constants", () => {
  it("OLYMPIC_DAYS_LIST has 19 entries", () => {
    expect(OLYMPIC_DAYS_LIST).toHaveLength(19);
  });

  it("starts on 2028-07-12 and ends on 2028-07-30", () => {
    expect(OLYMPIC_DAYS_LIST[0]).toBe("2028-07-12");
    expect(OLYMPIC_DAYS_LIST[18]).toBe("2028-07-30");
  });

  it("OLYMPIC_DAYS_SET matches OLYMPIC_DAYS_LIST", () => {
    expect(OLYMPIC_DAYS_SET.size).toBe(19);
    for (const d of OLYMPIC_DAYS_LIST) {
      expect(OLYMPIC_DAYS_SET.has(d)).toBe(true);
    }
  });
});

// ── timeToMinutes ───────────────────────────────────────────────────────────

describe("timeToMinutes", () => {
  it("converts HH:MM to total minutes", () => {
    expect(timeToMinutes("09:30")).toBe(9 * 60 + 30);
    expect(timeToMinutes("14:00")).toBe(14 * 60);
    expect(timeToMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("treats midnight (00:00) as 24*60 (end of day)", () => {
    expect(timeToMinutes("00:00")).toBe(24 * 60);
  });

  it("handles 6 AM start time", () => {
    expect(timeToMinutes("06:00")).toBe(360);
  });
});

// ── formatHourLabel ─────────────────────────────────────────────────────────

describe("formatHourLabel", () => {
  it("formats midnight (hour 0 or 24) as 12 AM", () => {
    expect(formatHourLabel(0)).toBe("12 AM");
    expect(formatHourLabel(24)).toBe("12 AM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatHourLabel(12)).toBe("12 PM");
  });

  it("formats morning hours as AM", () => {
    expect(formatHourLabel(6)).toBe("6 AM");
    expect(formatHourLabel(11)).toBe("11 AM");
  });

  it("formats afternoon hours as PM", () => {
    expect(formatHourLabel(13)).toBe("1 PM");
    expect(formatHourLabel(18)).toBe("6 PM");
    expect(formatHourLabel(23)).toBe("11 PM");
  });
});

// ── addDays ─────────────────────────────────────────────────────────────────

describe("addDays", () => {
  it("adds days to a date string", () => {
    expect(addDays("2028-07-12", 1)).toBe("2028-07-13");
    expect(addDays("2028-07-12", 7)).toBe("2028-07-19");
  });

  it("handles month boundaries", () => {
    expect(addDays("2028-07-30", 2)).toBe("2028-08-01");
  });

  it("subtracts days with negative n", () => {
    expect(addDays("2028-07-15", -3)).toBe("2028-07-12");
  });

  it("returns same date for n=0", () => {
    expect(addDays("2028-07-20", 0)).toBe("2028-07-20");
  });
});

// ── buildWeeks ──────────────────────────────────────────────────────────────

describe("buildWeeks", () => {
  it("returns an array of 7-element arrays", () => {
    const weeks = buildWeeks();
    expect(weeks.length).toBeGreaterThan(0);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it("covers all Olympic days (2028-07-12 to 2028-07-30)", () => {
    const weeks = buildWeeks();
    const allDays = weeks.flat();
    for (const d of OLYMPIC_DAYS_LIST) {
      expect(allDays).toContain(d);
    }
  });

  it("starts on a Sunday (first element of first week)", () => {
    const weeks = buildWeeks();
    const firstDay = new Date(weeks[0][0] + "T12:00:00");
    expect(firstDay.getDay()).toBe(0); // Sunday
  });

  it("ends on a Saturday (last element of last week)", () => {
    const weeks = buildWeeks();
    const lastWeek = weeks[weeks.length - 1];
    const lastDay = new Date(lastWeek[6] + "T12:00:00");
    expect(lastDay.getDay()).toBe(6); // Saturday
  });
});

// ── daysInRange ─────────────────────────────────────────────────────────────

describe("daysInRange", () => {
  it("returns a set of dates between start and end inclusive", () => {
    const days = daysInRange("2028-07-12", "2028-07-14");
    expect(days.size).toBe(3);
    expect(days.has("2028-07-12")).toBe(true);
    expect(days.has("2028-07-13")).toBe(true);
    expect(days.has("2028-07-14")).toBe(true);
  });

  it("returns single-day set when start equals end", () => {
    const days = daysInRange("2028-07-12", "2028-07-12");
    expect(days.size).toBe(1);
    expect(days.has("2028-07-12")).toBe(true);
  });

  it("returns empty set when start is after end", () => {
    const days = daysInRange("2028-07-15", "2028-07-12");
    expect(days.size).toBe(0);
  });
});

// ── matchesSearch ───────────────────────────────────────────────────────────

describe("matchesSearch", () => {
  const session = {
    sessionCode: "SWM-101",
    sport: "Swimming",
    sessionType: "Final",
    sessionDescription: "100m Freestyle",
    venue: "Aquatics Centre",
    zone: "Zone A",
  };

  it("returns true for empty query", () => {
    expect(matchesSearch(session, "")).toBe(true);
  });

  it("matches sport name", () => {
    expect(matchesSearch(session, "Swimming")).toBe(true);
  });

  it("matches session code", () => {
    expect(matchesSearch(session, "SWM-101")).toBe(true);
  });

  it("matches session type", () => {
    expect(matchesSearch(session, "Final")).toBe(true);
  });

  it("matches session description", () => {
    expect(matchesSearch(session, "Freestyle")).toBe(true);
  });

  it("matches venue", () => {
    expect(matchesSearch(session, "Aquatics")).toBe(true);
  });

  it("matches zone", () => {
    expect(matchesSearch(session, "Zone A")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(matchesSearch(session, "swimming")).toBe(true);
    expect(matchesSearch(session, "AQUATICS")).toBe(true);
  });

  it("returns false for non-matching query", () => {
    expect(matchesSearch(session, "Basketball")).toBe(false);
  });

  it("handles null sessionDescription", () => {
    const noDesc = { ...session, sessionDescription: null };
    expect(matchesSearch(noDesc, "Swimming")).toBe(true);
    expect(matchesSearch(noDesc, "Freestyle")).toBe(false);
  });
});

// ── computeOverlapLayout ────────────────────────────────────────────────────

describe("computeOverlapLayout", () => {
  it("returns empty map for empty input", () => {
    const result = computeOverlapLayout([]);
    expect(result.size).toBe(0);
  });

  it("assigns single session to column 0 with totalCols 1", () => {
    const result = computeOverlapLayout([
      { code: "A", startTime: "09:00", endTime: "11:00" },
    ]);
    expect(result.size).toBe(1);
    const info = result.get("A")!;
    expect(info.colIndex).toBe(0);
    expect(info.totalCols).toBe(1);
  });

  it("puts non-overlapping sessions in same column", () => {
    const result = computeOverlapLayout([
      { code: "A", startTime: "09:00", endTime: "11:00" },
      { code: "B", startTime: "11:00", endTime: "13:00" },
    ]);
    // B starts exactly when A ends — no overlap
    expect(result.get("A")!.colIndex).toBe(0);
    expect(result.get("B")!.colIndex).toBe(0);
    expect(result.get("A")!.totalCols).toBe(1);
    expect(result.get("B")!.totalCols).toBe(1);
  });

  it("puts overlapping sessions in different columns", () => {
    const result = computeOverlapLayout([
      { code: "A", startTime: "09:00", endTime: "11:00" },
      { code: "B", startTime: "10:00", endTime: "12:00" },
    ]);
    expect(result.get("A")!.colIndex).toBe(0);
    expect(result.get("B")!.colIndex).toBe(1);
    expect(result.get("A")!.totalCols).toBe(2);
    expect(result.get("B")!.totalCols).toBe(2);
  });

  it("handles three-way overlap", () => {
    const result = computeOverlapLayout([
      { code: "A", startTime: "09:00", endTime: "12:00" },
      { code: "B", startTime: "10:00", endTime: "13:00" },
      { code: "C", startTime: "11:00", endTime: "14:00" },
    ]);
    expect(result.size).toBe(3);
    const cols = new Set([
      result.get("A")!.colIndex,
      result.get("B")!.colIndex,
      result.get("C")!.colIndex,
    ]);
    // All should be in different columns
    expect(cols.size).toBe(3);
    // Each should report 3 totalCols
    expect(result.get("A")!.totalCols).toBe(3);
    expect(result.get("B")!.totalCols).toBe(3);
    expect(result.get("C")!.totalCols).toBe(3);
  });

  it("separates independent overlap groups", () => {
    const result = computeOverlapLayout([
      { code: "A", startTime: "09:00", endTime: "10:00" },
      { code: "B", startTime: "09:30", endTime: "10:30" },
      { code: "C", startTime: "14:00", endTime: "15:00" },
      { code: "D", startTime: "14:30", endTime: "15:30" },
    ]);
    // Group 1 (A, B) should have totalCols 2
    expect(result.get("A")!.totalCols).toBe(2);
    expect(result.get("B")!.totalCols).toBe(2);
    // Group 2 (C, D) should also have totalCols 2
    expect(result.get("C")!.totalCols).toBe(2);
    expect(result.get("D")!.totalCols).toBe(2);
  });
});

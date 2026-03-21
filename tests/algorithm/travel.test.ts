import { describe, it, expect } from "vitest";
import {
  buildTravelMatrix,
  getRequiredGap,
  timeToMinutes,
  isTravelFeasible,
} from "@/lib/algorithm/travel";
import type { CandidateSession, TravelEntry } from "@/lib/algorithm/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  overrides: Partial<CandidateSession> = {}
): CandidateSession {
  return {
    sessionCode: "S01",
    sport: "Swimming",
    zone: "SoFi Stadium Zone",
    sessionDate: "2028-07-22",
    startTime: "10:00",
    endTime: "12:00",
    interest: "high",
    ...overrides,
  };
}

const LA_TRAVEL_ENTRIES: TravelEntry[] = [
  {
    originZone: "SoFi Stadium Zone",
    destinationZone: "Downtown LA Zone",
    drivingMinutes: 20,
    transitMinutes: 35,
  },
  {
    originZone: "SoFi Stadium Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 25,
    transitMinutes: 50,
  },
  {
    originZone: "SoFi Stadium Zone",
    destinationZone: "Rose Bowl Zone",
    drivingMinutes: 35,
    transitMinutes: 60,
  },
  {
    originZone: "Downtown LA Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 28,
    transitMinutes: 45,
  },
  {
    originZone: "Downtown LA Zone",
    destinationZone: "Rose Bowl Zone",
    drivingMinutes: 12,
    transitMinutes: 25,
  },
  {
    originZone: "Long Beach Zone",
    destinationZone: "Rose Bowl Zone",
    drivingMinutes: 42,
    transitMinutes: 70,
  },
  {
    originZone: "SoFi Stadium Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 75,
    transitMinutes: null,
  },
  {
    originZone: "Downtown LA Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 80,
    transitMinutes: null,
  },
];

// ---------------------------------------------------------------------------
// buildTravelMatrix
// ---------------------------------------------------------------------------

describe("buildTravelMatrix", () => {
  it("creates bidirectional keys for each entry", () => {
    const entries: TravelEntry[] = [
      {
        originZone: "SoFi Stadium Zone",
        destinationZone: "Downtown LA Zone",
        drivingMinutes: 20,
        transitMinutes: 35,
      },
    ];

    const matrix = buildTravelMatrix(entries);

    expect(matrix.get("SoFi Stadium Zone|Downtown LA Zone")).toBe(20);
    expect(matrix.get("Downtown LA Zone|SoFi Stadium Zone")).toBe(20);
    expect(matrix.size).toBe(2);
  });

  it("returns empty map for no entries", () => {
    const matrix = buildTravelMatrix([]);
    expect(matrix.size).toBe(0);
  });

  it("handles multiple entries", () => {
    const matrix = buildTravelMatrix(LA_TRAVEL_ENTRIES);

    // Each entry produces 2 keys
    expect(matrix.size).toBe(LA_TRAVEL_ENTRIES.length * 2);

    // Verify a few specific lookups
    expect(matrix.get("Long Beach Zone|Rose Bowl Zone")).toBe(42);
    expect(matrix.get("Rose Bowl Zone|Long Beach Zone")).toBe(42);
    expect(matrix.get("Downtown LA Zone|Rose Bowl Zone")).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// getRequiredGap
// ---------------------------------------------------------------------------

describe("getRequiredGap", () => {
  const matrix = buildTravelMatrix(LA_TRAVEL_ENTRIES);

  it("returns 90 minutes for same zone", () => {
    expect(
      getRequiredGap("SoFi Stadium Zone", "SoFi Stadium Zone", matrix)
    ).toBe(90);
    expect(getRequiredGap("Downtown LA Zone", "Downtown LA Zone", matrix)).toBe(
      90
    );
  });

  it("returns 240 when either zone is Trestles Beach Zone", () => {
    expect(
      getRequiredGap("Trestles Beach Zone", "SoFi Stadium Zone", matrix)
    ).toBe(240);
    expect(
      getRequiredGap("Downtown LA Zone", "Trestles Beach Zone", matrix)
    ).toBe(240);
    expect(
      getRequiredGap("Trestles Beach Zone", "Trestles Beach Zone", matrix)
    ).toBe(90); // same zone takes priority
  });

  it("returns 90 for driving < 15 minutes", () => {
    expect(getRequiredGap("Downtown LA Zone", "Rose Bowl Zone", matrix)).toBe(
      90
    ); // 12 min driving
  });

  it("returns 120 for driving 15-29 minutes", () => {
    expect(
      getRequiredGap("SoFi Stadium Zone", "Downtown LA Zone", matrix)
    ).toBe(120); // 20 min driving
    expect(getRequiredGap("SoFi Stadium Zone", "Long Beach Zone", matrix)).toBe(
      120
    ); // 25 min driving
    expect(getRequiredGap("Downtown LA Zone", "Long Beach Zone", matrix)).toBe(
      120
    ); // 28 min driving
  });

  it("returns 150 for driving 30-44 minutes", () => {
    expect(getRequiredGap("SoFi Stadium Zone", "Rose Bowl Zone", matrix)).toBe(
      150
    ); // 35 min driving
    expect(getRequiredGap("Long Beach Zone", "Rose Bowl Zone", matrix)).toBe(
      150
    ); // 42 min driving
  });

  it("returns 210 for driving 60+ minutes", () => {
    // SoFi to Trestles is 75 min driving, but Trestles rule returns 240.
    // We need a pair with 60+ driving that isn't Trestles to test this bracket.
    // Create a custom matrix with a 65 min entry.
    const customEntries: TravelEntry[] = [
      {
        originZone: "Zone A",
        destinationZone: "Zone B",
        drivingMinutes: 65,
        transitMinutes: null,
      },
    ];
    const customMatrix = buildTravelMatrix(customEntries);
    expect(getRequiredGap("Zone A", "Zone B", customMatrix)).toBe(210);
  });

  it("returns 180 for driving 45-59 minutes", () => {
    const customEntries: TravelEntry[] = [
      {
        originZone: "Zone X",
        destinationZone: "Zone Y",
        drivingMinutes: 50,
        transitMinutes: null,
      },
    ];
    const customMatrix = buildTravelMatrix(customEntries);
    expect(getRequiredGap("Zone X", "Zone Y", customMatrix)).toBe(180);
  });

  it("returns 210 (max gap) for unknown zone pair not in matrix", () => {
    expect(getRequiredGap("Unknown Zone A", "Unknown Zone B", matrix)).toBe(
      210
    );
  });
});

// ---------------------------------------------------------------------------
// timeToMinutes
// ---------------------------------------------------------------------------

describe("timeToMinutes", () => {
  it("converts standard time strings correctly", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("10:00")).toBe(600);
    expect(timeToMinutes("14:30")).toBe(870);
    expect(timeToMinutes("01:00")).toBe(60);
  });

  it("treats 00:00 as 1440 (end of day midnight)", () => {
    expect(timeToMinutes("00:00")).toBe(1440);
  });

  it("handles 23:59", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("handles 12:00 noon", () => {
    expect(timeToMinutes("12:00")).toBe(720);
  });
});

// ---------------------------------------------------------------------------
// isTravelFeasible
// ---------------------------------------------------------------------------

describe("isTravelFeasible", () => {
  const matrix = buildTravelMatrix(LA_TRAVEL_ENTRIES);

  it("returns true for a single session", () => {
    expect(isTravelFeasible([makeSession()], matrix)).toBe(true);
  });

  it("returns true for empty session list", () => {
    expect(isTravelFeasible([], matrix)).toBe(true);
  });

  it("returns true for same zone with sufficient gap", () => {
    // same zone requires 90 min gap
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "11:30",
      endTime: "13:00",
    });
    // gap = 11:30 - 10:00 = 90 min, required = 90
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });

  it("returns false for same zone with insufficient gap", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "10:30",
      endTime: "12:00",
    });
    // gap = 10:30 - 10:00 = 30 min, required = 90
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("evaluates travel between different zones correctly", () => {
    // SoFi → Downtown LA: 20 min driving → 120 min required gap
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Downtown LA Zone",
      startTime: "12:00",
      endTime: "14:00",
    });
    // gap = 12:00 - 10:00 = 120 min, required = 120
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });

  it("returns false when different-zone gap is insufficient", () => {
    // SoFi → Downtown LA: 20 min driving → 120 min required gap
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Downtown LA Zone",
      startTime: "11:30",
      endTime: "13:00",
    });
    // gap = 11:30 - 10:00 = 90 min, required = 120
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("handles a chain of 3 sessions, all feasible", () => {
    // Downtown LA → Rose Bowl: 12 min → 90 min gap
    // Rose Bowl → Long Beach: 42 min → 150 min gap
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "Downtown LA Zone",
      startTime: "08:00",
      endTime: "09:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Rose Bowl Zone",
      startTime: "10:30",
      endTime: "12:00",
    });
    const s3 = makeSession({
      sessionCode: "S03",
      zone: "Long Beach Zone",
      startTime: "14:30",
      endTime: "16:00",
    });
    // gap1 = 10:30 - 09:00 = 90 min >= 90 required ✓
    // gap2 = 14:30 - 12:00 = 150 min >= 150 required ✓
    expect(isTravelFeasible([s1, s2, s3], matrix)).toBe(true);
  });

  it("returns false when one link in a 3-session chain fails", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "Downtown LA Zone",
      startTime: "08:00",
      endTime: "09:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Rose Bowl Zone",
      startTime: "10:30",
      endTime: "12:00",
    });
    const s3 = makeSession({
      sessionCode: "S03",
      zone: "Long Beach Zone",
      startTime: "13:00",
      endTime: "15:00",
    });
    // gap1 = 10:30 - 09:00 = 90 >= 90 ✓
    // gap2 = 13:00 - 12:00 = 60 < 150 required ✗
    expect(isTravelFeasible([s1, s2, s3], matrix)).toBe(false);
  });

  it("sorts sessions by start time before checking feasibility", () => {
    // Provide sessions out of order
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "14:00",
      endTime: "16:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    // sorted: s2 (09:00-10:00) → s1 (14:00-16:00)
    // gap = 14:00 - 10:00 = 240 min >> 90 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });

  it("enforces 240-minute gap for Trestles Beach Zone", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "Trestles Beach Zone",
      startTime: "08:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "13:00",
      endTime: "15:00",
    });
    // gap = 13:00 - 10:00 = 180 min < 240 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("allows Trestles Beach Zone travel with 240+ minute gap", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "Trestles Beach Zone",
      startTime: "08:00",
      endTime: "10:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "14:00",
      endTime: "16:00",
    });
    // gap = 14:00 - 10:00 = 240 min = 240 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });

  it("handles Trestles as second session (destination)", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "06:00",
      endTime: "08:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Trestles Beach Zone",
      startTime: "12:00",
      endTime: "14:00",
    });
    // gap = 12:00 - 08:00 = 240 min = 240 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });

  it("Trestles as destination with insufficient gap fails", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "06:00",
      endTime: "08:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Trestles Beach Zone",
      startTime: "11:59",
      endTime: "14:00",
    });
    // gap = 11:59 - 08:00 = 239 min < 240 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("boundary: exact gap at each distance bracket", () => {
    // Same zone: exactly 90 min
    const sameZone1 = makeSession({
      sessionCode: "A",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const sameZone2 = makeSession({
      sessionCode: "B",
      zone: "SoFi Stadium Zone",
      startTime: "11:30",
      endTime: "13:00",
    });
    expect(isTravelFeasible([sameZone1, sameZone2], matrix)).toBe(true);

    // Same zone: 89 min
    const sameZone3 = makeSession({
      sessionCode: "C",
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:01",
    });
    expect(isTravelFeasible([sameZone3, sameZone2], matrix)).toBe(false);
  });

  it("3-session chain with Trestles in the middle requires 240 on both sides", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "06:00",
      endTime: "07:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Trestles Beach Zone",
      startTime: "11:00",
      endTime: "12:00",
    });
    const s3 = makeSession({
      sessionCode: "S03",
      zone: "Downtown LA Zone",
      startTime: "16:00",
      endTime: "18:00",
    });
    // gap1: 11:00 - 07:00 = 240 = 240 (Trestles) ✓
    // gap2: 16:00 - 12:00 = 240 = 240 (Trestles) ✓
    expect(isTravelFeasible([s1, s2, s3], matrix)).toBe(true);
  });

  it("3-session chain with Trestles in middle, second hop too short", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "06:00",
      endTime: "07:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Trestles Beach Zone",
      startTime: "11:00",
      endTime: "12:00",
    });
    const s3 = makeSession({
      sessionCode: "S03",
      zone: "Downtown LA Zone",
      startTime: "15:59",
      endTime: "18:00",
    });
    // gap1: 11:00 - 07:00 = 240 ✓
    // gap2: 15:59 - 12:00 = 239 < 240 ✗
    expect(isTravelFeasible([s1, s2, s3], matrix)).toBe(false);
  });

  it("empty travel matrix treats all cross-zone pairs as 210 min gap", () => {
    const emptyMatrix = buildTravelMatrix([]);
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "Zone Alpha",
      startTime: "08:00",
      endTime: "09:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "Zone Beta",
      startTime: "12:30",
      endTime: "14:00",
    });
    // gap = 12:30 - 09:00 = 210 = 210 required (unknown zones)
    expect(isTravelFeasible([s1, s2], emptyMatrix)).toBe(true);

    const s3 = makeSession({
      sessionCode: "S03",
      zone: "Zone Beta",
      startTime: "12:29",
      endTime: "14:00",
    });
    // gap = 12:29 - 09:00 = 209 < 210
    expect(isTravelFeasible([s1, s3], emptyMatrix)).toBe(false);
  });

  it("rejects fully overlapping sessions (same start/end time)", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "10:00",
      endTime: "12:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "10:00",
      endTime: "12:00",
    });
    // gap = 10:00 - 12:00 = -120 min < 90 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("rejects partially overlapping sessions", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "10:00",
      endTime: "12:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "11:00",
      endTime: "13:00",
    });
    // sorted: s1 (10:00) then s2 (11:00), gap = 11:00 - 12:00 = -60 < 90
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("rejects sessions ending and starting at exact same time (zero gap)", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "10:00",
      endTime: "12:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "12:00",
      endTime: "14:00",
    });
    // gap = 12:00 - 12:00 = 0 < 90 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(false);
  });

  it("session ending at midnight (00:00) works with gap calculation", () => {
    const s1 = makeSession({
      sessionCode: "S01",
      zone: "SoFi Stadium Zone",
      startTime: "22:00",
      endTime: "00:00",
    });
    const s2 = makeSession({
      sessionCode: "S02",
      zone: "SoFi Stadium Zone",
      startTime: "08:00",
      endTime: "10:00",
    });
    // sorted by start: s2 (08:00=480) then s1 (22:00=1320)
    // gap = 1320 - 600 = 720 >> 90 required
    expect(isTravelFeasible([s1, s2], matrix)).toBe(true);
  });
});

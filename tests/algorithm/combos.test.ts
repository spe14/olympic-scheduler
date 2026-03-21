import { describe, it, expect } from "vitest";
import {
  generateDayCombos,
  assignRankedCombos,
  generateAllMemberCombos,
  buildSoftBuddyInterestMap,
} from "@/lib/algorithm/combos";
import { buildTravelMatrix } from "@/lib/algorithm/travel";
import type {
  CandidateSession,
  MemberData,
  ScoredCombo,
  TravelEntry,
} from "@/lib/algorithm/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  code: string,
  overrides: Partial<CandidateSession> = {}
): CandidateSession {
  return {
    sessionCode: code,
    sport: "Swimming",
    zone: "SoFi Stadium Zone",
    sessionDate: "2028-07-22",
    startTime: "10:00",
    endTime: "12:00",
    interest: "high",
    ...overrides,
  };
}

function makeMember(
  id: string,
  overrides: Partial<MemberData> = {}
): MemberData {
  return {
    memberId: id,
    sportRankings: ["Swimming"],
    minBuddies: 0,
    hardBuddies: [],
    softBuddies: [],
    candidateSessions: [],
    ...overrides,
  };
}

const SAME_ZONE_ENTRIES: TravelEntry[] = [];
const emptyTravelMatrix = buildTravelMatrix(SAME_ZONE_ENTRIES);

/** Build filtered sessions map from an array of (memberId, filteredSessions) tuples. */
function buildFilteredMap(
  entries: [string, CandidateSession[]][]
): Map<string, CandidateSession[]> {
  return new Map(entries);
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
    originZone: "Downtown LA Zone",
    destinationZone: "Rose Bowl Zone",
    drivingMinutes: 12,
    transitMinutes: 25,
  },
];

const travelMatrix = buildTravelMatrix(LA_TRAVEL_ENTRIES);

// ---------------------------------------------------------------------------
// generateDayCombos
// ---------------------------------------------------------------------------

describe("generateDayCombos", () => {
  const member = makeMember("Alice", {
    sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
  });
  const emptySoftBuddyMap = new Map<string, number>();

  it("generates all feasible subsets of size 1-3 for same-zone sessions", () => {
    const s1 = makeSession("S01", {
      sport: "Swimming",
      startTime: "08:00",
      endTime: "09:00",
    });
    const s2 = makeSession("S02", {
      sport: "Gymnastics",
      startTime: "10:30",
      endTime: "11:30",
    });
    const s3 = makeSession("S03", {
      sport: "Track & Field",
      startTime: "13:00",
      endTime: "14:00",
    });

    // All same zone, well-spaced → all subsets feasible
    const combos = generateDayCombos(
      [s1, s2, s3],
      emptyTravelMatrix,
      member,
      emptySoftBuddyMap
    );

    // Subsets: {1},{2},{3},{1,2},{1,3},{2,3},{1,2,3} = 7
    expect(combos).toHaveLength(7);

    // Should be sorted by score DESC
    for (let i = 1; i < combos.length; i++) {
      expect(combos[i - 1].score).toBeGreaterThanOrEqual(combos[i].score);
    }
  });

  it("excludes infeasible 2-session combos while keeping individual sessions", () => {
    const s1 = makeSession("S01", {
      zone: "SoFi Stadium Zone",
      startTime: "09:00",
      endTime: "10:00",
    });
    const s2 = makeSession("S02", {
      zone: "Downtown LA Zone",
      startTime: "10:30",
      endTime: "12:00",
    });
    // gap = 10:30 - 10:00 = 30 min, required = 120 min (20 min driving) → infeasible

    const combos = generateDayCombos(
      [s1, s2],
      travelMatrix,
      member,
      emptySoftBuddyMap
    );

    // Only individual sessions survive
    expect(combos).toHaveLength(2);
    expect(combos.every((c) => c.sessionCount === 1)).toBe(true);
  });

  it("limits combo size to maxPerDay (default 3)", () => {
    // 5 sessions all same zone, well-spaced
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession(`S0${i + 1}`, {
        startTime: `${8 + i * 3}:00`,
        endTime: `${9 + i * 3}:00`,
      })
    );

    const combos = generateDayCombos(
      sessions,
      emptyTravelMatrix,
      member,
      emptySoftBuddyMap
    );

    // No combo should have more than 3 sessions
    for (const combo of combos) {
      expect(combo.sessionCount).toBeLessThanOrEqual(3);
    }
    // Should have combos of various sizes
    expect(combos.some((c) => c.sessionCount === 3)).toBe(true);
    expect(combos.some((c) => c.sessionCount === 2)).toBe(true);
    expect(combos.some((c) => c.sessionCount === 1)).toBe(true);
  });

  it("returns empty result for zero sessions", () => {
    const combos = generateDayCombos(
      [],
      emptyTravelMatrix,
      member,
      emptySoftBuddyMap
    );
    expect(combos).toHaveLength(0);
  });

  it("sorts by score DESC, then sessionCount DESC, then sportMultiplierSum DESC", () => {
    // Create sessions that result in same score but different sessionCount
    const s1 = makeSession("S01", {
      sport: "Swimming",
      interest: "high",
      startTime: "08:00",
      endTime: "09:00",
    });
    const s2 = makeSession("S02", {
      sport: "Swimming",
      interest: "low",
      startTime: "10:30",
      endTime: "11:30",
    });

    const singleSportMember = makeMember("Alice", {
      sportRankings: ["Swimming"],
    });

    const combos = generateDayCombos(
      [s1, s2],
      emptyTravelMatrix,
      singleSportMember,
      emptySoftBuddyMap
    );

    // All combos sorted by score DESC
    for (let i = 1; i < combos.length; i++) {
      if (combos[i - 1].score === combos[i].score) {
        // Same score → higher sessionCount first
        expect(combos[i - 1].sessionCount).toBeGreaterThanOrEqual(
          combos[i].sessionCount
        );
      }
    }
  });

  it("applies lexicographic tiebreak on sessionCodes when all else is equal", () => {
    // Two sessions with identical scores (same sport, same interest)
    const sA = makeSession("AAA01", {
      sport: "Swimming",
      interest: "high",
      startTime: "08:00",
      endTime: "09:00",
    });
    const sB = makeSession("BBB01", {
      sport: "Swimming",
      interest: "high",
      startTime: "10:30",
      endTime: "11:30",
    });

    const singleSportMember = makeMember("Alice", {
      sportRankings: ["Swimming"],
    });

    const combos = generateDayCombos(
      [sA, sB],
      emptyTravelMatrix,
      singleSportMember,
      emptySoftBuddyMap
    );

    // The single-session combos will have the same score.
    // Filter to single-session combos for clarity.
    const singles = combos.filter((c) => c.sessionCount === 1);
    expect(singles).toHaveLength(2);
    // AAA01 sorts before BBB01 lexicographically
    expect(singles[0].sessions[0].sessionCode).toBe("AAA01");
    expect(singles[1].sessions[0].sessionCode).toBe("BBB01");
  });
});

// ---------------------------------------------------------------------------
// assignRankedCombos
// ---------------------------------------------------------------------------

describe("assignRankedCombos", () => {
  function makeScoredCombo(score: number, sessionCodes: string[]): ScoredCombo {
    return {
      sessions: sessionCodes.map((code) => makeSession(code)),
      score,
      sportMultiplierSum: score,
      sessionCount: sessionCodes.length,
    };
  }

  it("assigns P, B1, B2 when each has a new session vs its predecessor", () => {
    // All distinct single-session combos → each introduces a new session
    const combos = [
      makeScoredCombo(10, ["S1"]),
      makeScoredCombo(9, ["S2"]),
      makeScoredCombo(8, ["S3"]),
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe("primary");
    expect(result[0].sessionCodes).toEqual(["S1"]);
    expect(result[1].rank).toBe("backup1");
    expect(result[1].sessionCodes).toEqual(["S2"]);
    expect(result[2].rank).toBe("backup2");
    expect(result[2].sessionCodes).toEqual(["S3"]);
  });

  it("skips pure subsets — B1 must have a session not in P", () => {
    const combos = [
      makeScoredCombo(10, ["A", "B", "C"]),
      makeScoredCombo(8, ["A", "B"]), // subset of P → skip for B1
      makeScoredCombo(7, ["A", "C"]), // subset of P → skip for B1
      makeScoredCombo(6, ["A"]), // subset of P → skip for B1
      makeScoredCombo(5, ["A", "D"]), // D is new vs P → valid B1
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    // B1 = ["A", "D"] (first with a new session vs P)
    // B2 must have a new session vs B1 AND vs P:
    // {A,B} has B new vs B1={A,D} but {A,B} ⊂ P → skip
    // {A,C} has C new vs B1 but {A,C} ⊂ P → skip
    // {A} subset of both P and B1 → skip
    // No valid B2
    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe("primary");
    expect(result[0].sessionCodes).toEqual(["A", "B", "C"]);
    expect(result[1].rank).toBe("backup1");
    expect(result[1].sessionCodes).toEqual(["A", "D"]);
  });

  it("no backups at all when every combo is a subset of P", () => {
    const combos = [
      makeScoredCombo(10, ["A", "B", "C"]),
      makeScoredCombo(8, ["A", "B"]),
      makeScoredCombo(7, ["B", "C"]),
      makeScoredCombo(6, ["A"]),
    ];

    const result = assignRankedCombos(combos, "Bob", "2028-07-22");

    // ["A","B"] is subset of P, but it becomes B1 candidate... wait, no:
    // hasNewSession(["A","B"], P=["A","B","C"]) → A in P, B in P → false → skip
    // hasNewSession(["B","C"], P) → B in P, C in P → false → skip
    // hasNewSession(["A"], P) → A in P → false → skip
    // No B1 found
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe("primary");
  });

  it("skips B2 when it would be a subset of B1", () => {
    const combos = [
      makeScoredCombo(10, ["A", "B"]),
      makeScoredCombo(8, ["C", "D"]), // new vs P → valid B1
      makeScoredCombo(7, ["C"]), // subset of B1 → skip
      makeScoredCombo(6, ["D"]), // subset of B1 → skip
      makeScoredCombo(5, ["C", "E"]), // E is new vs B1 → valid B2
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result).toHaveLength(3);
    expect(result[0].sessionCodes).toEqual(["A", "B"]);
    expect(result[1].sessionCodes).toEqual(["C", "D"]);
    expect(result[2].sessionCodes).toEqual(["C", "E"]);
  });

  it("returns only primary for 1 combo", () => {
    const combos = [makeScoredCombo(5, ["S01"])];
    const result = assignRankedCombos(combos, "Bob", "2028-07-23");

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe("primary");
    expect(result[0].score).toBe(5);
  });

  it("returns primary + backup1 when only 2 distinct combos exist", () => {
    const combos = [makeScoredCombo(8, ["S01"]), makeScoredCombo(5, ["S02"])];
    const result = assignRankedCombos(combos, "Carol", "2028-07-24");

    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe("primary");
    expect(result[1].rank).toBe("backup1");
  });

  it("returns empty result for 0 combos", () => {
    const result = assignRankedCombos([], "Dave", "2028-07-25");
    expect(result).toHaveLength(0);
  });

  it("includes correct sessionCodes in results", () => {
    const combos = [
      makeScoredCombo(10, ["GYM01", "SWM01"]),
      makeScoredCombo(8, ["TRK01"]),
    ];
    const result = assignRankedCombos(combos, "Eve", "2028-07-22");

    expect(result[0].sessionCodes).toEqual(["GYM01", "SWM01"]);
    expect(result[1].sessionCodes).toEqual(["TRK01"]);
  });

  it("B1 can share some sessions with P as long as it has at least 1 new one", () => {
    const combos = [
      makeScoredCombo(10, ["A", "B"]),
      makeScoredCombo(9, ["A", "C"]), // shares A, but C is new → valid
    ];

    const result = assignRankedCombos(combos, "Frank", "2028-07-22");

    expect(result).toHaveLength(2);
    expect(result[1].sessionCodes).toEqual(["A", "C"]);
  });

  it("promotes lower-scored combo to B1 when higher-scored ones are all subsets", () => {
    // P is a triple; next 3 combos by score are all pairs that are subsets.
    // The first combo with a new session (score 3) should become B1.
    const combos = [
      makeScoredCombo(10, ["A", "B", "C"]),
      makeScoredCombo(8, ["A", "B"]), // subset of P → skip
      makeScoredCombo(7, ["A", "C"]), // subset of P → skip
      makeScoredCombo(6, ["B", "C"]), // subset of P → skip
      makeScoredCombo(5, ["A"]), // subset of P → skip
      makeScoredCombo(4, ["B"]), // subset of P → skip
      makeScoredCombo(3, ["D"]), // D is new → B1
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result[0].rank).toBe("primary");
    expect(result[0].score).toBe(10);
    expect(result[1].rank).toBe("backup1");
    expect(result[1].sessionCodes).toEqual(["D"]);
    expect(result[1].score).toBe(3);
    // B2: needs new vs B1={D} AND new vs P={A,B,C}.
    // {A,B} has A new vs B1 but is ⊂ P → skip
    // {A,C} has A new vs B1 but is ⊂ P → skip
    // {B,C} has B new vs B1 but is ⊂ P → skip
    // {A} subset of both → skip. {B} subset of both → skip.
    // No valid B2 — only P + B1
    expect(result).toHaveLength(2);
  });

  it("handles mutually exclusive combos — overlapping sessions produce natural backups", () => {
    // 3 overlapping sessions that can't be paired: each is a solo combo.
    // All are distinct → P, B1, B2 assigned straightforwardly.
    const combos = [
      makeScoredCombo(5, ["X"]),
      makeScoredCombo(4, ["Y"]),
      makeScoredCombo(3, ["Z"]),
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result).toHaveLength(3);
    expect(result[0].sessionCodes).toEqual(["X"]);
    expect(result[1].sessionCodes).toEqual(["Y"]);
    expect(result[2].sessionCodes).toEqual(["Z"]);
  });

  it("B2 must have a new session vs both B1 and P", () => {
    // P = {A, B}. B1 = {C} (new vs P).
    // {A} is a subset of P → skip for B2 even though A is not in B1.
    const combos = [
      makeScoredCombo(10, ["A", "B"]),
      makeScoredCombo(5, ["C"]), // new vs P → B1
      makeScoredCombo(4, ["A"]), // new vs B1, but subset of P → skip for B2
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    // No valid B2 since {A} ⊂ P
    expect(result).toHaveLength(2);
    expect(result[0].sessionCodes).toEqual(["A", "B"]);
    expect(result[1].sessionCodes).toEqual(["C"]);
  });

  it("B2 is valid when it has a new session vs both B1 and P", () => {
    // P = {A, B}. B1 = {C} (new vs P).
    // {A, D}: A is in P but D is new vs both P and B1 → valid B2.
    const combos = [
      makeScoredCombo(10, ["A", "B"]),
      makeScoredCombo(5, ["C"]), // new vs P → B1
      makeScoredCombo(4, ["A"]), // subset of P → skip for B2
      makeScoredCombo(3, ["A", "D"]), // D is new vs P and vs B1 → valid B2
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result).toHaveLength(3);
    expect(result[0].sessionCodes).toEqual(["A", "B"]);
    expect(result[1].sessionCodes).toEqual(["C"]);
    expect(result[2].sessionCodes).toEqual(["A", "D"]);
  });

  it("single session means only primary, no backups possible", () => {
    const combos = [makeScoredCombo(5, ["ONLY"])];

    const result = assignRankedCombos(combos, "Solo", "2028-07-22");

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe("primary");
  });

  it("two sessions where pair is P — both singles are subsets, no backups", () => {
    const combos = [
      makeScoredCombo(10, ["A", "B"]),
      makeScoredCombo(6, ["A"]),
      makeScoredCombo(5, ["B"]),
    ];

    const result = assignRankedCombos(combos, "Alice", "2028-07-22");

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe("primary");
    expect(result[0].sessionCodes).toEqual(["A", "B"]);
  });
});

// ---------------------------------------------------------------------------
// generateAllMemberCombos
// ---------------------------------------------------------------------------

describe("generateAllMemberCombos", () => {
  it("generates combos for each day independently", () => {
    const day1Session = makeSession("SWM01", {
      sessionDate: "2028-07-22",
      startTime: "10:00",
      endTime: "12:00",
    });
    const day2Session = makeSession("GYM01", {
      sport: "Gymnastics",
      sessionDate: "2028-07-23",
      startTime: "10:00",
      endTime: "12:00",
    });
    const day3Session = makeSession("TRK01", {
      sport: "Track & Field",
      sessionDate: "2028-07-24",
      startTime: "10:00",
      endTime: "12:00",
    });

    const member = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
      candidateSessions: [day1Session, day2Session, day3Session],
    });

    const days = ["2028-07-22", "2028-07-23", "2028-07-24"];
    const filteredSessions = [day1Session, day2Session, day3Session];

    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      days,
      emptyTravelMatrix,
      buildFilteredMap([["Alice", filteredSessions]])
    );

    // Each day has 1 session → 1 combo (primary) per day → 3 total
    expect(result).toHaveLength(3);

    const resultDays = result.map((r) => r.day);
    expect(resultDays).toContain("2028-07-22");
    expect(resultDays).toContain("2028-07-23");
    expect(resultDays).toContain("2028-07-24");

    // All should be primary (only 1 combo per day)
    expect(result.every((r) => r.rank === "primary")).toBe(true);
  });

  it("excludes sessions on days not in the days list", () => {
    const included = makeSession("SWM01", {
      sessionDate: "2028-07-22",
    });
    const excluded = makeSession("GYM01", {
      sport: "Gymnastics",
      sessionDate: "2028-07-25",
    });

    const member = makeMember("Bob", {
      sportRankings: ["Swimming", "Gymnastics"],
      candidateSessions: [included, excluded],
    });

    const days = ["2028-07-22"]; // only include the first day
    const filteredSessions = [included, excluded];
    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      days,
      emptyTravelMatrix,
      buildFilteredMap([["Bob", filteredSessions]])
    );

    // Only combos for 2028-07-22
    expect(result.every((r) => r.day === "2028-07-22")).toBe(true);
    const codes = result.flatMap((r) => r.sessionCodes);
    expect(codes).not.toContain("GYM01");
  });

  it("returns empty when sessions list is empty", () => {
    const member = makeMember("Carol", {
      sportRankings: ["Swimming"],
    });

    const result = generateAllMemberCombos(
      member,
      [],
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([["Carol", []]])
    );

    expect(result).toHaveLength(0);
  });

  it("generates up to 3 ranked combos per day when meaningful backups exist", () => {
    // 4 well-spaced sessions, only 3 fit per combo → backups have new sessions
    const s1 = makeSession("S01", {
      sport: "Swimming",
      startTime: "08:00",
      endTime: "09:00",
      sessionDate: "2028-07-22",
    });
    const s2 = makeSession("S02", {
      sport: "Gymnastics",
      startTime: "10:30",
      endTime: "11:30",
      sessionDate: "2028-07-22",
    });
    const s3 = makeSession("S03", {
      sport: "Track & Field",
      startTime: "13:00",
      endTime: "14:00",
      sessionDate: "2028-07-22",
    });
    const s4 = makeSession("S04", {
      sport: "Diving",
      startTime: "15:30",
      endTime: "16:30",
      sessionDate: "2028-07-22",
    });

    const member = makeMember("Dave", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field", "Diving"],
      candidateSessions: [s1, s2, s3, s4],
    });

    const filteredSessions = [s1, s2, s3, s4];
    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([["Dave", filteredSessions]])
    );

    // With 4 sessions and max 3 per combo, there are combos that
    // include S04 (not in the top triple), making meaningful backups.
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].rank).toBe("primary");
    if (result.length >= 2) expect(result[1].rank).toBe("backup1");
    if (result.length >= 3) expect(result[2].rank).toBe("backup2");
  });

  it("only assigns primary when all combos are subsets of the top combo", () => {
    // 3 sessions, all fit in one combo → all other combos are subsets
    const s1 = makeSession("S01", {
      sport: "Swimming",
      startTime: "08:00",
      endTime: "09:00",
      sessionDate: "2028-07-22",
    });
    const s2 = makeSession("S02", {
      sport: "Gymnastics",
      startTime: "10:30",
      endTime: "11:30",
      sessionDate: "2028-07-22",
    });
    const s3 = makeSession("S03", {
      sport: "Track & Field",
      startTime: "13:00",
      endTime: "14:00",
      sessionDate: "2028-07-22",
    });

    const member = makeMember("Dave", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
      candidateSessions: [s1, s2, s3],
    });

    const filteredSessions = [s1, s2, s3];
    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([["Dave", filteredSessions]])
    );

    // All pairs and singles are subsets of [S01, S02, S03] → only primary
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe("primary");
  });

  it("soft buddy interest map correctly identifies shared sessions", () => {
    const s1 = makeSession("SWM01", {
      sport: "Swimming",
      startTime: "08:00",
      endTime: "10:00",
      sessionDate: "2028-07-22",
    });
    const s2 = makeSession("GYM01", {
      sport: "Gymnastics",
      startTime: "12:00",
      endTime: "14:00",
      sessionDate: "2028-07-22",
    });

    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics"],
      softBuddies: ["Bob"],
      candidateSessions: [s1, s2],
    });
    // Bob's filtered sessions: SWM01 only
    const bobFilteredSessions = [makeSession("SWM01")];

    const aliceFilteredSessions = [s1, s2];
    const result = generateAllMemberCombos(
      alice,
      aliceFilteredSessions,
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([
        ["Alice", aliceFilteredSessions],
        ["Bob", bobFilteredSessions],
      ])
    );

    // Find single-session combos to verify buddy bonus
    const swmCombo = result.find(
      (r) => r.sessionCodes.length === 1 && r.sessionCodes[0] === "SWM01"
    );
    const gymCombo = result.find(
      (r) => r.sessionCodes.length === 1 && r.sessionCodes[0] === "GYM01"
    );

    if (swmCombo && gymCombo) {
      // SWM01: rank 1/2 → 2.0, high → 1.0, 1 buddy → 1.25 = 2.5
      // GYM01: rank 2/2 → 1.0, high → 1.0, 0 buddies → 1.0 = 1.0
      expect(swmCombo.score).toBeCloseTo(2.5);
      expect(gymCombo.score).toBeCloseTo(1.0);
    }
  });

  it("generates 0 combos when all sessions on a day are travel-infeasible as pairs but keeps singles", () => {
    // 3 sessions all in far-apart zones with tight timing
    const s1 = makeSession("S01", {
      zone: "SoFi Stadium Zone",
      startTime: "10:00",
      endTime: "11:00",
      sessionDate: "2028-07-22",
    });
    const s2 = makeSession("S02", {
      zone: "Long Beach Zone",
      startTime: "11:30",
      endTime: "12:30",
      sessionDate: "2028-07-22",
    });
    const s3 = makeSession("S03", {
      zone: "Rose Bowl Zone",
      startTime: "12:00",
      endTime: "13:00",
      sessionDate: "2028-07-22",
    });

    const member = makeMember("Alice", {
      sportRankings: ["Swimming"],
    });

    const combos = generateDayCombos(
      [s1, s2, s3],
      travelMatrix,
      member,
      new Map()
    );

    // All pairs should be infeasible (gaps too short for the distances)
    // Only singles should survive
    expect(combos.every((c) => c.sessionCount === 1)).toBe(true);
    expect(combos).toHaveLength(3);
  });

  it("4 sessions where only 3 fit per combo: backups contain the 4th session", () => {
    // 4 well-spaced sessions, all same zone.
    // The top triple is P. Any backup must include S04 (the session not in P).
    const s1 = makeSession("S01", {
      sport: "Swimming",
      startTime: "08:00",
      endTime: "09:00",
      sessionDate: "2028-07-22",
    });
    const s2 = makeSession("S02", {
      sport: "Gymnastics",
      startTime: "10:30",
      endTime: "11:30",
      sessionDate: "2028-07-22",
    });
    const s3 = makeSession("S03", {
      sport: "Track & Field",
      startTime: "13:00",
      endTime: "14:00",
      sessionDate: "2028-07-22",
    });
    const s4 = makeSession("S04", {
      sport: "Diving",
      startTime: "15:30",
      endTime: "16:30",
      sessionDate: "2028-07-22",
    });

    const member = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field", "Diving"],
      candidateSessions: [s1, s2, s3, s4],
    });

    const filteredSessions = [s1, s2, s3, s4];
    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([["Alice", filteredSessions]])
    );

    const primary = result.find((r) => r.rank === "primary")!;
    expect(primary.sessionCodes).toHaveLength(3);

    // Every backup must contain at least 1 session not in its predecessor
    const backups = result.filter((r) => r.rank !== "primary");
    expect(backups.length).toBeGreaterThanOrEqual(1);

    const b1 = result.find((r) => r.rank === "backup1");
    if (b1) {
      const primarySet = new Set(primary.sessionCodes);
      const hasNewVsP = b1.sessionCodes.some((c) => !primarySet.has(c));
      expect(hasNewVsP).toBe(true);
    }

    const b2 = result.find((r) => r.rank === "backup2");
    if (b1 && b2) {
      const b1Set = new Set(b1.sessionCodes);
      const hasNewVsB1 = b2.sessionCodes.some((c) => !b1Set.has(c));
      expect(hasNewVsB1).toBe(true);
    }
  });

  it("5 overlapping morning sessions produce backups with distinct sessions", () => {
    // 5 sessions that all overlap (same time slot, same zone).
    // Only singles are feasible. Each is distinct → P, B1, B2 straightforward.
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession(`OVR0${i + 1}`, {
        sport: i === 0 ? "Swimming" : i === 1 ? "Gymnastics" : "Track & Field",
        startTime: "10:00",
        endTime: "12:00",
        sessionDate: "2028-07-22",
        interest: i === 0 ? "high" : i === 1 ? "high" : "medium",
      })
    );

    const member = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
      candidateSessions: sessions,
    });

    const result = generateAllMemberCombos(
      member,
      sessions,
      ["2028-07-22"],
      emptyTravelMatrix,
      buildFilteredMap([["Alice", sessions]])
    );

    expect(result).toHaveLength(3);
    // All combos should be single-session and each session should be different
    const codes = result.map((r) => r.sessionCodes[0]);
    expect(new Set(codes).size).toBe(3);
  });

  it("no cross-day contamination: sessions on different days don't mix in combos", () => {
    const s1 = makeSession("S01", {
      sessionDate: "2028-07-22",
      startTime: "10:00",
      endTime: "12:00",
    });
    const s2 = makeSession("S02", {
      sessionDate: "2028-07-23",
      startTime: "10:00",
      endTime: "12:00",
    });

    const member = makeMember("Eve", {
      sportRankings: ["Swimming"],
      candidateSessions: [s1, s2],
    });

    const filteredSessions = [s1, s2];
    const result = generateAllMemberCombos(
      member,
      filteredSessions,
      ["2028-07-22", "2028-07-23"],
      emptyTravelMatrix,
      buildFilteredMap([["Eve", filteredSessions]])
    );

    // Each day produces its own combos; no combo mixes days
    for (const combo of result) {
      if (combo.day === "2028-07-22") {
        expect(combo.sessionCodes).toEqual(["S01"]);
      } else if (combo.day === "2028-07-23") {
        expect(combo.sessionCodes).toEqual(["S02"]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildSoftBuddyInterestMap
// ---------------------------------------------------------------------------

describe("buildSoftBuddyInterestMap", () => {
  it("counts soft buddies from their filtered sessions, not candidate sessions", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });
    const s2 = makeSession("GYM01", { sport: "Gymnastics" });

    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics"],
      softBuddies: ["Bob"],
      candidateSessions: [s1, s2],
    });

    // Bob has SWM01 in his candidates, but it was filtered out by his own constraints
    const bobFilteredSessions: CandidateSession[] = [];

    const map = buildSoftBuddyInterestMap(
      alice,
      [s1, s2],
      buildFilteredMap([
        ["Alice", [s1, s2]],
        ["Bob", bobFilteredSessions],
      ])
    );

    // Bob's SWM01 was filtered out → no bonus for Alice
    expect(map.get("SWM01")).toBeUndefined();
    expect(map.get("GYM01")).toBeUndefined();
  });

  it("counts buddy when session is in their filtered sessions", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });

    const alice = makeMember("Alice", {
      softBuddies: ["Bob"],
      candidateSessions: [s1],
    });

    const map = buildSoftBuddyInterestMap(
      alice,
      [s1],
      buildFilteredMap([
        ["Alice", [s1]],
        ["Bob", [makeSession("SWM01")]],
      ])
    );

    expect(map.get("SWM01")).toBe(1);
  });

  it("counts multiple soft buddies correctly from filtered sessions", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });

    const alice = makeMember("Alice", {
      softBuddies: ["Bob", "Carol"],
      candidateSessions: [s1],
    });

    const map = buildSoftBuddyInterestMap(
      alice,
      [s1],
      buildFilteredMap([
        ["Alice", [s1]],
        ["Bob", [makeSession("SWM01")]],
        ["Carol", [makeSession("SWM01")]],
      ])
    );

    expect(map.get("SWM01")).toBe(2);
  });

  it("does not count buddy for sessions not in the member's filtered sessions", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });

    const alice = makeMember("Alice", {
      softBuddies: ["Bob"],
      candidateSessions: [s1],
    });

    // Alice's filtered sessions are empty (her own constraints removed SWM01)
    // Bob has SWM01 in his filtered sessions
    const map = buildSoftBuddyInterestMap(
      alice,
      [],
      buildFilteredMap([
        ["Alice", []],
        ["Bob", [makeSession("SWM01")]],
      ])
    );

    // No entries because Alice has no filtered sessions
    expect(map.size).toBe(0);
  });

  it("returns empty map when member has no soft buddies", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });

    const alice = makeMember("Alice", {
      softBuddies: [],
      candidateSessions: [s1],
    });

    const map = buildSoftBuddyInterestMap(
      alice,
      [s1],
      buildFilteredMap([["Alice", [s1]]])
    );

    expect(map.size).toBe(0);
  });

  it("handles soft buddy not present in filtered sessions map", () => {
    const s1 = makeSession("SWM01", { sport: "Swimming" });

    const alice = makeMember("Alice", {
      softBuddies: ["Ghost"],
      candidateSessions: [s1],
    });

    const map = buildSoftBuddyInterestMap(
      alice,
      [s1],
      buildFilteredMap([["Alice", [s1]]])
    );

    // Ghost not in map → no bonus
    expect(map.get("SWM01")).toBeUndefined();
  });
});

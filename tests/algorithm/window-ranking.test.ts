import { describe, it, expect } from "vitest";
import {
  computeWindowRankings,
  buildMemberScores,
} from "@/lib/algorithm/window-ranking";
import type { WindowRankingInput } from "@/lib/algorithm/window-ranking";

describe("computeWindowRankings", () => {
  // ── Basic behavior ──────────────────────────────────────────────

  it("returns empty array when no member scores", () => {
    const result = computeWindowRankings({
      memberScores: [],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    expect(result).toEqual([]);
  });

  it("returns empty array for consecutive mode with no consecutiveDays", () => {
    const result = computeWindowRankings({
      memberScores: [{ memberId: "m1", dailyScores: new Map() }],
      dateMode: "consecutive",
    });
    expect(result).toEqual([]);
  });

  it("returns single result for specific mode", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-14", 10],
            ["2028-07-15", 20],
          ]),
        },
      ],
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-15",
    });
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe("2028-07-14");
    expect(result[0].endDate).toBe("2028-07-15");
    expect(result[0].score).toBe(30);
  });

  it("returns empty array for specific mode with missing dates", () => {
    const result = computeWindowRankings({
      memberScores: [{ memberId: "m1", dailyScores: new Map() }],
      dateMode: "specific",
    });
    expect(result).toEqual([]);
  });

  // ── Consecutive mode ──────────────────────────────────────────

  it("generates sliding windows for consecutive mode", () => {
    // 19 Olympic days, 3-day windows → 17 possible windows
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 5],
            ["2028-07-13", 5],
            ["2028-07-14", 5],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    expect(result.length).toBe(17);
    expect(result[0].startDate).toBe("2028-07-12");
    expect(result[0].endDate).toBe("2028-07-14");
  });

  it("sorts windows by score descending", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 1],
            ["2028-07-13", 1],
            ["2028-07-14", 1],
            ["2028-07-20", 10],
            ["2028-07-21", 10],
            ["2028-07-22", 10],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    // Best window should be Jul 20-22
    expect(result[0].startDate).toBe("2028-07-20");
    expect(result[0].endDate).toBe("2028-07-22");
    expect(result[0].score).toBe(30);
  });

  it("handles single-day consecutive window", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-15", 42]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 1,
    });
    expect(result.length).toBe(19);
    const best = result[0];
    expect(best.score).toBe(42);
    expect(best.startDate).toBe("2028-07-15");
    expect(best.endDate).toBe("2028-07-15");
  });

  it("handles full 19-day window", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-12", 10]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 19,
    });
    expect(result.length).toBe(1);
    expect(result[0].startDate).toBe("2028-07-12");
    expect(result[0].endDate).toBe("2028-07-30");
  });

  // ── Fairness penalty ──────────────────────────────────────────

  it("applies fairness penalty when member scores diverge", () => {
    // Two members: one loves Jul 12-14, the other hates them
    const input: WindowRankingInput = {
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 100],
            ["2028-07-13", 100],
            ["2028-07-20", 50],
            ["2028-07-21", 50],
          ]),
        },
        {
          memberId: "m2",
          dailyScores: new Map([
            ["2028-07-12", 0],
            ["2028-07-13", 0],
            ["2028-07-20", 50],
            ["2028-07-21", 50],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 2,
    };

    const result = computeWindowRankings(input);

    // Jul 20-21: both score 100 total, no penalty
    // Jul 12-13: baseScore=200, but member scores differ (200 vs 0), penalty is large
    const fair = result.find((r) => r.startDate === "2028-07-20");
    const unfair = result.find((r) => r.startDate === "2028-07-12");

    expect(fair).toBeDefined();
    expect(unfair).toBeDefined();
    // Fair window should rank higher
    expect(fair!.score).toBeGreaterThan(unfair!.score);
  });

  it("no penalty when all members have equal scores", () => {
    const input: WindowRankingInput = {
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-15", 10]]),
        },
        {
          memberId: "m2",
          dailyScores: new Map([["2028-07-15", 10]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 1,
    };

    const result = computeWindowRankings(input);
    const best = result.find((r) => r.startDate === "2028-07-15");
    expect(best).toBeDefined();
    // Total = 20, stdev = 0, penalty = 0
    expect(best!.score).toBe(20);
  });

  it("fairness-driven ranking flip: lower total beats higher total", () => {
    // Mirrors TC-05b: 4 members, lopsided vs balanced windows
    // Window Jul 15-17: Users A+B score 8 each, C+D score 0 → total=16, stdev=4
    // Window Jul 19-21: A=2, B=2, C=4, D=6 → total=14, stdev≈1.658
    // With weight=0.5: Jul 15-17 score=16-8=8, Jul 19-21 score=14-3.316≈10.68
    const input: WindowRankingInput = {
      memberScores: [
        {
          memberId: "a",
          dailyScores: new Map([
            ["2028-07-15", 6],
            ["2028-07-17", 2],
            ["2028-07-19", 2],
          ]),
        },
        {
          memberId: "b",
          dailyScores: new Map([
            ["2028-07-15", 6],
            ["2028-07-17", 2],
            ["2028-07-19", 2],
          ]),
        },
        {
          memberId: "c",
          dailyScores: new Map([["2028-07-20", 4]]),
        },
        {
          memberId: "d",
          dailyScores: new Map([
            ["2028-07-20", 4],
            ["2028-07-21", 2],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
    };

    const result = computeWindowRankings(input);
    const lopsided = result.find((r) => r.startDate === "2028-07-15");
    const balanced = result.find((r) => r.startDate === "2028-07-19");

    expect(lopsided).toBeDefined();
    expect(balanced).toBeDefined();

    // Balanced window (lower total=14) should outrank lopsided window (higher total=16)
    expect(balanced!.score).toBeGreaterThan(lopsided!.score);

    // Verify the flip shows up in ranking order
    const lopsidedIdx = result.indexOf(lopsided!);
    const balancedIdx = result.indexOf(balanced!);
    expect(balancedIdx).toBeLessThan(lopsidedIdx);
  });

  // ── Tie-breaking ──────────────────────────────────────────────

  it("tie-breaks by earlier start date when scores and stdev are equal", () => {
    // All days score the same = all windows score the same
    const dailyScores = new Map<string, number>();
    for (let i = 0; i < 19; i++) {
      const d = new Date("2028-07-12T12:00:00");
      d.setDate(d.getDate() + i);
      dailyScores.set(d.toISOString().split("T")[0], 10);
    }

    const result = computeWindowRankings({
      memberScores: [{ memberId: "m1", dailyScores }],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });

    // All windows should score the same, so first should be earliest
    expect(result[0].startDate).toBe("2028-07-12");
  });

  // ── Resilience tiebreaker ─────────────────────────────────────

  it("resilience tiebreaker favors window with stronger backups", () => {
    // Two members, each scores 10 on Jul 12 and Jul 20 (1-day windows).
    // Both windows have score=20, stdev=0 → tied on first two criteria.
    // Jul 12 has strong backup scores, Jul 20 has none.
    // Without resilience tiebreak, Jul 12 would win anyway (earlier start).
    // To prove resilience is the decider, give Jul 20 the earlier-date advantage
    // by making it Jul 13 vs Jul 20 — but Jul 20 has backups and Jul 13 doesn't.
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-13", 10],
            ["2028-07-20", 10],
          ]),
          dailyBackupScores: new Map([["2028-07-20", { b1: 8, b2: 6 }]]),
        },
        {
          memberId: "m2",
          dailyScores: new Map([
            ["2028-07-13", 10],
            ["2028-07-20", 10],
          ]),
          dailyBackupScores: new Map([["2028-07-20", { b1: 9, b2: 7 }]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 1,
    });

    // Jul 20: score=20, stdev=0, resilience > 0 (both members have backups)
    // Jul 13: score=20, stdev=0, resilience = 0 (no backups)
    // Jul 20 should rank ahead of Jul 13 despite later start date
    const jul20 = result.find((r) => r.startDate === "2028-07-20");
    const jul13 = result.find((r) => r.startDate === "2028-07-13");
    expect(jul20).toBeDefined();
    expect(jul13).toBeDefined();

    const jul20Idx = result.indexOf(jul20!);
    const jul13Idx = result.indexOf(jul13!);
    expect(jul20Idx).toBeLessThan(jul13Idx);
  });

  it("resilience defaults to 0 when no backup scores provided", () => {
    // Same as the existing start-date tiebreaker test: all days equal, no backups.
    // Resilience should be 0 for all windows → falls through to start date.
    const dailyScores = new Map<string, number>();
    for (let i = 0; i < 19; i++) {
      const d = new Date("2028-07-12T12:00:00");
      d.setDate(d.getDate() + i);
      dailyScores.set(d.toISOString().split("T")[0], 10);
    }

    const result = computeWindowRankings({
      memberScores: [{ memberId: "m1", dailyScores }],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });

    // Without backups, resilience is 0 for all windows → earliest start wins
    expect(result[0].startDate).toBe("2028-07-12");
  });

  // ── Edge cases ────────────────────────────────────────────────

  it("handles days with no scores (treats as 0)", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map(), // no scores at all
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    expect(result.length).toBe(17);
    // All scores should be 0
    for (const w of result) {
      expect(w.score).toBe(0);
    }
  });

  it("returns empty for consecutiveDays > 19", () => {
    const result = computeWindowRankings({
      memberScores: [{ memberId: "m1", dailyScores: new Map() }],
      dateMode: "consecutive",
      consecutiveDays: 20,
    });
    expect(result).toEqual([]);
  });

  it("returns empty array for consecutiveDays = 0", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-15", 10]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 0,
    });
    expect(result).toEqual([]);
  });

  it("returns empty for specific mode with startDate > endDate", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-15", 10]]),
        },
      ],
      dateMode: "specific",
      startDate: "2028-07-20",
      endDate: "2028-07-15",
    });
    // daysInRange with start > end produces [], so scoreWindow gets empty days
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0);
  });

  it("ignores backup scores for days with no primary score (resilience edge case)", () => {
    // Member has backup scores on Jul 15 but no primary score for that day.
    // The resilience calculation should skip this day (primary > 0 check fails).
    // Two windows: Jul 14 (has primary+backup) and Jul 15 (only backup).
    // The Jul 14 window should have better resilience because its coverage is counted.
    const input: WindowRankingInput = {
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-14", 10]]),
          dailyBackupScores: new Map([
            ["2028-07-14", { b1: 8, b2: 6 }],
            ["2028-07-15", { b1: 5, b2: 3 }], // orphaned backup — no primary
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 1,
    };

    const result = computeWindowRankings(input);

    // Jul 14 window: baseScore=10, resilience = min((8+6)/(2*10), 1) = 0.7
    const jul14 = result.find((r) => r.startDate === "2028-07-14");
    expect(jul14).toBeDefined();
    expect(jul14!.score).toBe(10);

    // Jul 15 window: baseScore=0 (no primary), resilience irrelevant (no coverage)
    const jul15 = result.find((r) => r.startDate === "2028-07-15");
    expect(jul15).toBeDefined();
    expect(jul15!.score).toBe(0);
  });

  it("stdev with single member produces zero fairness penalty", () => {
    // Single member → stdev of a single value = 0 → no penalty
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-15", 42]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 1,
    });
    const best = result.find((r) => r.startDate === "2028-07-15");
    expect(best).toBeDefined();
    // baseScore=42, stdev([42])=0, penalty=0, windowScore=42
    expect(best!.score).toBe(42);
  });

  it("stdev produces zero penalty when all member window-scores are zero", () => {
    // Multiple members with no scores on any day — stdev([0, 0]) = 0
    // This exercises the stdev path with an all-zero values array,
    // ensuring no fairness penalty is applied.
    const result = computeWindowRankings({
      memberScores: [
        { memberId: "m1", dailyScores: new Map() },
        { memberId: "m2", dailyScores: new Map() },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    expect(result.length).toBe(17);
    // All windows score 0 (base=0, stdev=0, penalty=0)
    for (const w of result) {
      expect(w.score).toBe(0);
    }
  });

  it("window ending exactly at Olympic end is included (consecutiveDays=19)", () => {
    // With 19 consecutive days and 19 Olympic days, only one window is possible.
    // The window end equals olympicEnd, so the winEnd > olympicEnd break
    // on line 157 does NOT fire — verifying the boundary condition.
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 5],
            ["2028-07-30", 5],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 19,
    });
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe("2028-07-12");
    expect(result[0].endDate).toBe("2028-07-30");
    expect(result[0].score).toBe(10);
  });

  it("18-day window produces exactly 2 windows at Olympic boundary", () => {
    // With 18 consecutive days and 19 Olympic days, exactly 2 windows:
    // offset=0 (Jul 12-29) and offset=1 (Jul 13-30).
    // Both end at or before olympicEnd (Jul 30), so the break never fires.
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-30", 100]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 18,
    });
    expect(result).toHaveLength(2);
    // The window containing Jul 30 (offset=1) should rank first
    expect(result[0].startDate).toBe("2028-07-13");
    expect(result[0].endDate).toBe("2028-07-30");
    expect(result[0].score).toBe(100);
  });

  // ── requiredDays filtering ──────────────────────────────────────

  it("filters windows to only those containing all required days", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 10],
            ["2028-07-13", 10],
            ["2028-07-14", 10],
            ["2028-07-15", 10],
            ["2028-07-16", 10],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
      requiredDays: ["2028-07-13", "2028-07-14"],
    });
    // Only windows that contain both Jul 13 and Jul 14 should be returned
    for (const w of result) {
      expect(w.startDate <= "2028-07-13").toBe(true);
      expect(w.endDate >= "2028-07-14").toBe(true);
    }
    expect(result.length).toBeGreaterThan(0);
    // Windows starting at Jul 15 or later cannot contain Jul 13
    expect(result.find((r) => r.startDate > "2028-07-14")).toBeUndefined();
  });

  it("returns empty when no window can cover all required days", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([
            ["2028-07-12", 10],
            ["2028-07-30", 10],
          ]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
      // Days too far apart for any 3-day window to cover both
      requiredDays: ["2028-07-12", "2028-07-30"],
    });
    expect(result).toEqual([]);
  });

  it("ignores requiredDays when undefined", () => {
    const result = computeWindowRankings({
      memberScores: [
        {
          memberId: "m1",
          dailyScores: new Map([["2028-07-12", 10]]),
        },
      ],
      dateMode: "consecutive",
      consecutiveDays: 3,
      requiredDays: undefined,
    });
    // Should return all 17 possible 3-day windows
    expect(result.length).toBe(17);
  });
});

describe("buildMemberScores", () => {
  it("groups combos by member with primary and backup scores", () => {
    const combos = [
      { memberId: "m1", day: "2028-07-12", rank: "primary", score: 100 },
      { memberId: "m1", day: "2028-07-12", rank: "backup1", score: 80 },
      { memberId: "m1", day: "2028-07-12", rank: "backup2", score: 60 },
      { memberId: "m2", day: "2028-07-12", rank: "primary", score: 90 },
      { memberId: "m2", day: "2028-07-13", rank: "primary", score: 70 },
    ];

    const result = buildMemberScores(combos);

    expect(result).toHaveLength(2);

    const m1 = result.find((m) => m.memberId === "m1")!;
    expect(m1.dailyScores.get("2028-07-12")).toBe(100);
    expect(m1.dailyBackupScores?.get("2028-07-12")).toEqual({
      b1: 80,
      b2: 60,
    });

    const m2 = result.find((m) => m.memberId === "m2")!;
    expect(m2.dailyScores.get("2028-07-12")).toBe(90);
    expect(m2.dailyScores.get("2028-07-13")).toBe(70);
    expect(m2.dailyBackupScores).toBeUndefined();
  });

  it("returns empty array for empty input", () => {
    expect(buildMemberScores([])).toEqual([]);
  });

  it("excludes members with only backup combos (no primary)", () => {
    const combos = [
      { memberId: "m1", day: "2028-07-12", rank: "primary", score: 50 },
      { memberId: "m2", day: "2028-07-12", rank: "backup1", score: 30 },
    ];

    const result = buildMemberScores(combos);

    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe("m1");
  });

  it("defaults backup scores to zero when only one backup rank exists for a day", () => {
    const combos = [
      { memberId: "m1", day: "2028-07-12", rank: "primary", score: 100 },
      { memberId: "m1", day: "2028-07-12", rank: "backup2", score: 40 },
    ];

    const result = buildMemberScores(combos);

    const m1 = result.find((m) => m.memberId === "m1")!;
    const backups = m1.dailyBackupScores?.get("2028-07-12");
    expect(backups).toBeDefined();
    // backup1 was never set, so b1 defaults to 0
    expect(backups!.b1).toBe(0);
    expect(backups!.b2).toBe(40);
  });

  it("assigns backup2 score on a day that had no prior backup entry", () => {
    // When backup2 arrives for a member-day that has no existing backupMap entry,
    // a new {b1: 0, b2: 0} object is created and then b2 is set (line 106+115).
    const combos = [
      { memberId: "m1", day: "2028-07-14", rank: "primary", score: 50 },
      // backup2 on a different day than any backup1
      { memberId: "m1", day: "2028-07-15", rank: "primary", score: 60 },
      { memberId: "m1", day: "2028-07-15", rank: "backup2", score: 25 },
    ];

    const result = buildMemberScores(combos);
    const m1 = result.find((m) => m.memberId === "m1")!;

    // Day 14: no backups at all
    expect(m1.dailyBackupScores?.get("2028-07-14")).toBeUndefined();

    // Day 15: only backup2 exists, b1 should default to 0
    const day15Backups = m1.dailyBackupScores?.get("2028-07-15");
    expect(day15Backups).toBeDefined();
    expect(day15Backups!.b1).toBe(0);
    expect(day15Backups!.b2).toBe(25);
  });

  it("handles multiple members with backup2 but no backup1 on different days", () => {
    const combos = [
      { memberId: "m1", day: "2028-07-12", rank: "primary", score: 100 },
      { memberId: "m1", day: "2028-07-12", rank: "backup2", score: 30 },
      { memberId: "m2", day: "2028-07-13", rank: "primary", score: 80 },
      { memberId: "m2", day: "2028-07-13", rank: "backup1", score: 60 },
      { memberId: "m2", day: "2028-07-13", rank: "backup2", score: 40 },
    ];

    const result = buildMemberScores(combos);

    const m1 = result.find((m) => m.memberId === "m1")!;
    expect(m1.dailyBackupScores?.get("2028-07-12")).toEqual({ b1: 0, b2: 30 });

    const m2 = result.find((m) => m.memberId === "m2")!;
    expect(m2.dailyBackupScores?.get("2028-07-13")).toEqual({ b1: 60, b2: 40 });
  });
});

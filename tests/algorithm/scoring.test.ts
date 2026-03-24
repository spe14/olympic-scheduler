import { describe, it, expect } from "vitest";
import {
  getSportMultiplier,
  getSessionAdjustment,
  getSoftBuddyBonus,
  calculateSessionScore,
  scoreCombo,
} from "@/lib/algorithm/scoring";
import type { CandidateSession, MemberData } from "@/lib/algorithm/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  overrides: Partial<CandidateSession> = {}
): CandidateSession {
  return {
    sessionCode: "SWM01",
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
    sportRankings: [],
    minBuddies: 0,
    hardBuddies: [],
    softBuddies: [],
    candidateSessions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSportMultiplier
// ---------------------------------------------------------------------------

describe("getSportMultiplier", () => {
  it("returns 2.0 for a single sport (totalSports = 1)", () => {
    expect(getSportMultiplier(1, 1)).toBe(2.0);
  });

  it("returns 2.0 for rank 1 regardless of totalSports", () => {
    expect(getSportMultiplier(1, 3)).toBe(2.0);
    expect(getSportMultiplier(1, 5)).toBe(2.0);
    expect(getSportMultiplier(1, 10)).toBe(2.0);
  });

  it("returns correct multipliers for 3 ranked sports", () => {
    // rank 1: 2.0 - (0/2)*1.0 = 2.0
    // rank 2: 2.0 - (1/2)*1.0 = 1.5
    // rank 3: 2.0 - (2/2)*1.0 = 1.0
    expect(getSportMultiplier(1, 3)).toBe(2.0);
    expect(getSportMultiplier(2, 3)).toBe(1.5);
    expect(getSportMultiplier(3, 3)).toBe(1.0);
  });

  it("returns linear scale for 5 ranked sports", () => {
    // rank 1: 2.0
    // rank 2: 2.0 - (1/4)*1.0 = 1.75
    // rank 3: 2.0 - (2/4)*1.0 = 1.5
    // rank 4: 2.0 - (3/4)*1.0 = 1.25
    // rank 5: 2.0 - (4/4)*1.0 = 1.0
    expect(getSportMultiplier(1, 5)).toBe(2.0);
    expect(getSportMultiplier(2, 5)).toBe(1.75);
    expect(getSportMultiplier(3, 5)).toBe(1.5);
    expect(getSportMultiplier(4, 5)).toBe(1.25);
    expect(getSportMultiplier(5, 5)).toBe(1.0);
  });

  it("returns 2.0 when totalSports is 0 (edge case, treated like 1)", () => {
    // totalSports <= 1 returns 2.0
    expect(getSportMultiplier(1, 0)).toBe(2.0);
  });

  it("returns correct multipliers for 10 ranked sports (max allowed)", () => {
    // rank 1: 2.0, rank 10: 1.0, linear in between
    expect(getSportMultiplier(1, 10)).toBe(2.0);
    expect(getSportMultiplier(10, 10)).toBeCloseTo(1.0);
    // rank 5: 2.0 - (4/9)*1.0 ≈ 1.5556
    expect(getSportMultiplier(5, 10)).toBeCloseTo(2.0 - 4 / 9);
    // rank 6: 2.0 - (5/9)*1.0 ≈ 1.4444
    expect(getSportMultiplier(6, 10)).toBeCloseTo(2.0 - 5 / 9);
  });

  it("returns 1.0 for the last ranked sport regardless of total", () => {
    expect(getSportMultiplier(2, 2)).toBe(1.0);
    expect(getSportMultiplier(3, 3)).toBe(1.0);
    expect(getSportMultiplier(5, 5)).toBe(1.0);
    expect(getSportMultiplier(10, 10)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// getSessionAdjustment
// ---------------------------------------------------------------------------

describe("getSessionAdjustment", () => {
  it("returns 1.0 for high interest", () => {
    expect(getSessionAdjustment("high")).toBe(1.0);
  });

  it("returns 0.7 for medium interest", () => {
    expect(getSessionAdjustment("medium")).toBe(0.7);
  });

  it("returns 0.4 for low interest", () => {
    expect(getSessionAdjustment("low")).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// getSoftBuddyBonus
// ---------------------------------------------------------------------------

describe("getSoftBuddyBonus", () => {
  it("returns 1.0 for 0 buddies", () => {
    expect(getSoftBuddyBonus(0)).toBe(1.0);
  });

  it("returns 1.25 for 1 buddy", () => {
    // 1.0 + 0.25 + 0.1*(1-1) = 1.25
    expect(getSoftBuddyBonus(1)).toBe(1.25);
  });

  it("returns 1.35 for 2 buddies", () => {
    // 1.0 + 0.25 + 0.1*(2-1) = 1.35
    expect(getSoftBuddyBonus(2)).toBe(1.35);
  });

  it("returns 1.45 for 3 buddies", () => {
    // 1.0 + 0.25 + 0.1*(3-1) = 1.45
    expect(getSoftBuddyBonus(3)).toBe(1.45);
  });

  it("returns 2.15 for 10 buddies", () => {
    // 1.0 + 0.25 + 0.1*(10-1) = 1.0 + 0.25 + 0.9 = 2.15
    expect(getSoftBuddyBonus(10)).toBeCloseTo(2.15);
  });

  it("returns 1.0 for negative count", () => {
    // count < 1 → 1.0
    expect(getSoftBuddyBonus(-1)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// calculateSessionScore
// ---------------------------------------------------------------------------

describe("calculateSessionScore", () => {
  it("computes correct score: rank 1 of 3, high interest, 2 soft buddies", () => {
    const session = makeSession({
      sessionCode: "GYM01",
      sport: "Gymnastics",
      interest: "high",
    });
    const member = makeMember("Alice", {
      sportRankings: ["Gymnastics", "Swimming", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>([["GYM01", 2]]);

    const score = calculateSessionScore(session, member, softBuddyMap);

    // sportMultiplier: rank 1, 3 sports → 2.0
    // sessionAdjustment: high → 1.0
    // softBuddyBonus: 2 → 1.35
    // score = 2.0 * 1.0 * 1.35 = 2.7
    expect(score).toBeCloseTo(2.7);
  });

  it("computes correct score: rank 2 of 3, medium interest, 0 soft buddies", () => {
    const session = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "medium",
    });
    const member = makeMember("Bob", {
      sportRankings: ["Gymnastics", "Swimming", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>();

    const score = calculateSessionScore(session, member, softBuddyMap);

    // sportMultiplier: rank 2, 3 sports → 1.5
    // sessionAdjustment: medium → 0.7
    // softBuddyBonus: 0 → 1.0
    // score = 1.5 * 0.7 * 1.0 = 1.05
    expect(score).toBeCloseTo(1.05);
  });

  it("treats unranked sport as last rank", () => {
    const session = makeSession({
      sessionCode: "DIV01",
      sport: "Diving",
      interest: "high",
    });
    const member = makeMember("Carol", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>();

    const score = calculateSessionScore(session, member, softBuddyMap);

    // Diving not in rankings → rankIndex = -1 → rank = sportRankings.length = 3
    // sportMultiplier: rank 3, 3 sports → 1.0
    // sessionAdjustment: high → 1.0
    // softBuddyBonus: 0 → 1.0
    // score = 1.0 * 1.0 * 1.0 = 1.0
    expect(score).toBeCloseTo(1.0);
  });

  it("computes correct score with low interest and 1 soft buddy", () => {
    const session = makeSession({
      sessionCode: "TRK01",
      sport: "Track & Field",
      interest: "low",
    });
    const member = makeMember("Dave", {
      sportRankings: ["Track & Field", "Swimming"],
    });
    const softBuddyMap = new Map<string, number>([["TRK01", 1]]);

    const score = calculateSessionScore(session, member, softBuddyMap);

    // sportMultiplier: rank 1, 2 sports → 2.0
    // sessionAdjustment: low → 0.4
    // softBuddyBonus: 1 → 1.25
    // score = 2.0 * 0.4 * 1.25 = 1.0
    expect(score).toBeCloseTo(1.0);
  });

  it("handles member with empty sport rankings (single sport behaviour)", () => {
    const session = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "high",
    });
    const member = makeMember("Eve", {
      sportRankings: [],
    });
    const softBuddyMap = new Map<string, number>();

    const score = calculateSessionScore(session, member, softBuddyMap);

    // rankIndex = -1 → rank = sportRankings.length = 0
    // getSportMultiplier(0, 0): totalSports <= 1 → 2.0
    // sessionAdjustment: high → 1.0
    // softBuddyBonus: 0 → 1.0
    // score = 2.0 * 1.0 * 1.0 = 2.0
    expect(score).toBeCloseTo(2.0);
  });

  it("applies PRUNED_SESSION_PENALTY (0.1x) to pruned sessions", () => {
    const session = makeSession({
      sport: "Swimming",
      interest: "high",
      pruned: true,
    });
    const member = makeMember("Alice", {
      sportRankings: ["Swimming"],
    });
    const softBuddyMap = new Map<string, number>();

    const prunedScore = calculateSessionScore(session, member, softBuddyMap);
    const normalScore = calculateSessionScore(
      { ...session, pruned: undefined },
      member,
      softBuddyMap
    );

    expect(prunedScore).toBeCloseTo(normalScore * 0.1);
  });

  it("does not apply penalty when pruned is undefined", () => {
    const session = makeSession({ sport: "Swimming", interest: "high" });
    const member = makeMember("Alice", { sportRankings: ["Swimming"] });
    const softBuddyMap = new Map<string, number>();

    const score = calculateSessionScore(session, member, softBuddyMap);
    // rank 1 of 1 → sportMult 2.0, high → 1.0, no buddies → 1.0
    expect(score).toBeCloseTo(2.0);
  });
});

// ---------------------------------------------------------------------------
// scoreCombo
// ---------------------------------------------------------------------------

describe("scoreCombo", () => {
  it("computes total score as sum of individual session scores", () => {
    const s1 = makeSession({
      sessionCode: "GYM01",
      sport: "Gymnastics",
      interest: "high",
    });
    const s2 = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "medium",
    });
    const member = makeMember("Alice", {
      sportRankings: ["Gymnastics", "Swimming", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>();

    const result = scoreCombo([s1, s2], member, softBuddyMap);

    // s1: rank 1/3 → 2.0, high → 1.0, 0 buddies → 1.0 => 2.0
    // s2: rank 2/3 → 1.5, medium → 0.7, 0 buddies → 1.0 => 1.05
    // total = 3.05
    expect(result.score).toBeCloseTo(3.05);
    expect(result.sessionCount).toBe(2);
    // sportMultiplierSum = 2.0 + 1.5 = 3.5
    expect(result.sportMultiplierSum).toBeCloseTo(3.5);
    expect(result.sessions).toEqual([s1, s2]);
  });

  it("returns same score as calculateSessionScore for a single session", () => {
    const session = makeSession({
      sessionCode: "TRK01",
      sport: "Track & Field",
      interest: "high",
    });
    const member = makeMember("Bob", {
      sportRankings: ["Swimming", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>([["TRK01", 1]]);

    const comboResult = scoreCombo([session], member, softBuddyMap);
    const singleScore = calculateSessionScore(session, member, softBuddyMap);

    expect(comboResult.score).toBeCloseTo(singleScore);
    expect(comboResult.sessionCount).toBe(1);
  });

  it("accumulates sportMultiplierSum correctly for 3 sessions", () => {
    const s1 = makeSession({
      sessionCode: "GYM01",
      sport: "Gymnastics",
      interest: "high",
    });
    const s2 = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "high",
    });
    const s3 = makeSession({
      sessionCode: "TRK01",
      sport: "Track & Field",
      interest: "high",
    });
    const member = makeMember("Carol", {
      sportRankings: ["Gymnastics", "Swimming", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>();

    const result = scoreCombo([s1, s2, s3], member, softBuddyMap);

    // rank 1 → 2.0, rank 2 → 1.5, rank 3 → 1.0
    expect(result.sportMultiplierSum).toBeCloseTo(4.5);
    expect(result.sessionCount).toBe(3);
    // scores: 2.0 * 1.0 * 1.0 + 1.5 * 1.0 * 1.0 + 1.0 * 1.0 * 1.0 = 4.5
    expect(result.score).toBeCloseTo(4.5);
  });

  it("handles 3-session combo with all different sports correctly", () => {
    const s1 = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "high",
    });
    const s2 = makeSession({
      sessionCode: "GYM01",
      sport: "Gymnastics",
      interest: "medium",
    });
    const s3 = makeSession({
      sessionCode: "TRK01",
      sport: "Track & Field",
      interest: "low",
    });
    const member = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
    });
    const softBuddyMap = new Map<string, number>();

    const result = scoreCombo([s1, s2, s3], member, softBuddyMap);

    // s1: 2.0 * 1.0 * 1.0 = 2.0
    // s2: 1.5 * 0.7 * 1.0 = 1.05
    // s3: 1.0 * 0.4 * 1.0 = 0.4
    expect(result.score).toBeCloseTo(3.45);
    expect(result.sessionCount).toBe(3);
    expect(result.sportMultiplierSum).toBeCloseTo(4.5);
  });

  it("handles combo with duplicate sport (two swimming sessions)", () => {
    const s1 = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "high",
    });
    const s2 = makeSession({
      sessionCode: "SWM02",
      sport: "Swimming",
      interest: "medium",
    });
    const member = makeMember("Alice", {
      sportRankings: ["Swimming", "Gymnastics"],
    });
    const softBuddyMap = new Map<string, number>();

    const result = scoreCombo([s1, s2], member, softBuddyMap);

    // Both Swimming → rank 1/2 → multiplier 2.0
    // s1: 2.0 * 1.0 = 2.0
    // s2: 2.0 * 0.7 = 1.4
    expect(result.score).toBeCloseTo(3.4);
    expect(result.sportMultiplierSum).toBeCloseTo(4.0);
  });

  it("includes soft buddy bonuses in combo score", () => {
    const s1 = makeSession({
      sessionCode: "GYM01",
      sport: "Gymnastics",
      interest: "high",
    });
    const s2 = makeSession({
      sessionCode: "SWM01",
      sport: "Swimming",
      interest: "high",
    });
    const member = makeMember("Dave", {
      sportRankings: ["Gymnastics", "Swimming"],
    });
    const softBuddyMap = new Map<string, number>([
      ["GYM01", 1],
      ["SWM01", 2],
    ]);

    const result = scoreCombo([s1, s2], member, softBuddyMap);

    // s1: rank 1/2 → 2.0, high → 1.0, 1 buddy → 1.25 => 2.5
    // s2: rank 2/2 → 1.0, high → 1.0, 2 buddies → 1.35 => 1.35
    // total = 3.85
    expect(result.score).toBeCloseTo(3.85);
  });
});

import { describe, it, expect } from "vitest";
import {
  applyHardBuddyFilter,
  applyMinBuddiesFilter,
  filterCandidateSessions,
} from "@/lib/algorithm/filter";
import type { CandidateSession, MemberData } from "@/lib/algorithm/types";

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
    sportRankings: [],
    minBuddies: 0,
    hardBuddies: [],
    softBuddies: [],
    candidateSessions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyHardBuddyFilter
// ---------------------------------------------------------------------------

describe("applyHardBuddyFilter", () => {
  const s1 = makeSession("SWM01");
  const s2 = makeSession("GYM01", { sport: "Gymnastics" });
  const s3 = makeSession("TRK01", { sport: "Track & Field" });

  it("returns all sessions when hard buddy map is empty", () => {
    const result = applyHardBuddyFilter([s1, s2, s3], new Map());
    expect(result).toEqual([s1, s2, s3]);
  });

  it("filters to only sessions the single hard buddy is interested in", () => {
    const buddySessions = new Map<string, Set<string>>([
      ["Bob", new Set(["SWM01", "TRK01"])],
    ]);
    const result = applyHardBuddyFilter([s1, s2, s3], buddySessions);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.sessionCode)).toEqual(["SWM01", "TRK01"]);
  });

  it("intersects sessions from multiple hard buddies", () => {
    const buddySessions = new Map<string, Set<string>>([
      ["Bob", new Set(["SWM01", "GYM01", "TRK01"])],
      ["Carol", new Set(["SWM01", "TRK01"])],
    ]);
    const result = applyHardBuddyFilter([s1, s2, s3], buddySessions);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.sessionCode)).toEqual(["SWM01", "TRK01"]);
  });

  it("returns empty when no sessions overlap across hard buddies", () => {
    const buddySessions = new Map<string, Set<string>>([
      ["Bob", new Set(["SWM01"])],
      ["Carol", new Set(["GYM01"])],
    ]);
    const result = applyHardBuddyFilter([s1, s2, s3], buddySessions);
    expect(result).toHaveLength(0);
  });

  it("returns empty when hard buddy has no matching sessions", () => {
    const buddySessions = new Map<string, Set<string>>([
      ["Bob", new Set(["DIV01", "BOX01"])],
    ]);
    const result = applyHardBuddyFilter([s1, s2, s3], buddySessions);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyMinBuddiesFilter
// ---------------------------------------------------------------------------

describe("applyMinBuddiesFilter", () => {
  const s1 = makeSession("SWM01");
  const s2 = makeSession("GYM01", { sport: "Gymnastics" });
  const s3 = makeSession("TRK01", { sport: "Track & Field" });

  it("returns all sessions when minBuddies is 0", () => {
    const counts = new Map<string, number>();
    const result = applyMinBuddiesFilter([s1, s2, s3], 0, counts);
    expect(result).toEqual([s1, s2, s3]);
  });

  it("keeps sessions with enough other interested members", () => {
    // count includes self, so count of 3 means 2 others
    const counts = new Map<string, number>([
      ["SWM01", 3],
      ["GYM01", 2],
      ["TRK01", 1],
    ]);
    const result = applyMinBuddiesFilter([s1, s2, s3], 2, counts);
    // SWM01: 3 - 1 = 2 >= 2 ✓
    // GYM01: 2 - 1 = 1 < 2 ✗
    // TRK01: 1 - 1 = 0 < 2 ✗
    expect(result).toHaveLength(1);
    expect(result[0].sessionCode).toBe("SWM01");
  });

  it("excludes sessions where only the member is interested (count = 1)", () => {
    const counts = new Map<string, number>([
      ["SWM01", 1],
      ["GYM01", 3],
    ]);
    const result = applyMinBuddiesFilter([s1, s2], 1, counts);
    // SWM01: 1 - 1 = 0 < 1 ✗
    // GYM01: 3 - 1 = 2 >= 1 ✓
    expect(result).toHaveLength(1);
    expect(result[0].sessionCode).toBe("GYM01");
  });

  it("excludes sessions not found in interest counts", () => {
    const counts = new Map<string, number>();
    const result = applyMinBuddiesFilter([s1], 1, counts);
    // count defaults to 0, 0 - 1 = -1 < 1
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterCandidateSessions (integration of both filters)
// ---------------------------------------------------------------------------

describe("filterCandidateSessions", () => {
  it("applies hard buddy filter then min buddies filter", () => {
    const s1 = makeSession("SWM01");
    const s2 = makeSession("GYM01", { sport: "Gymnastics" });
    const s3 = makeSession("TRK01", { sport: "Track & Field" });

    const alice = makeMember("Alice", {
      hardBuddies: ["Bob"],
      minBuddies: 1,
      candidateSessions: [s1, s2, s3],
    });

    const bob = makeMember("Bob", {
      candidateSessions: [
        makeSession("SWM01"),
        makeSession("GYM01", { sport: "Gymnastics" }),
      ],
    });

    const allMembers = [alice, bob];

    // Interest counts: SWM01 → 2, GYM01 → 2, TRK01 → 1
    const sessionInterestCounts = new Map<string, number>([
      ["SWM01", 2],
      ["GYM01", 2],
      ["TRK01", 1],
    ]);

    const result = filterCandidateSessions(
      alice,
      allMembers,
      sessionInterestCounts
    );

    // Hard buddy filter: Bob has SWM01, GYM01 → keeps SWM01, GYM01
    // Min buddies filter (minBuddies=1):
    //   SWM01: 2 - 1 = 1 >= 1 ✓
    //   GYM01: 2 - 1 = 1 >= 1 ✓
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.sessionCode)).toEqual(["SWM01", "GYM01"]);
  });

  it("skips hard buddy filter when buddy not found in members list", () => {
    const s1 = makeSession("SWM01");
    const s2 = makeSession("GYM01", { sport: "Gymnastics" });

    const alice = makeMember("Alice", {
      hardBuddies: ["NonExistent"],
      minBuddies: 0,
      candidateSessions: [s1, s2],
    });

    const sessionInterestCounts = new Map<string, number>([
      ["SWM01", 2],
      ["GYM01", 1],
    ]);

    const result = filterCandidateSessions(
      alice,
      [alice],
      sessionInterestCounts
    );

    // NonExistent buddy not found → hard buddy filter skipped (no set added)
    // minBuddies = 0 → all pass
    expect(result).toHaveLength(2);
  });

  it("returns empty when hard buddy filter eliminates everything", () => {
    const s1 = makeSession("SWM01");

    const alice = makeMember("Alice", {
      hardBuddies: ["Bob"],
      candidateSessions: [s1],
    });

    const bob = makeMember("Bob", {
      candidateSessions: [makeSession("GYM01", { sport: "Gymnastics" })],
    });

    const sessionInterestCounts = new Map<string, number>([
      ["SWM01", 1],
      ["GYM01", 1],
    ]);

    const result = filterCandidateSessions(
      alice,
      [alice, bob],
      sessionInterestCounts
    );

    // Bob only has GYM01, Alice only has SWM01 → no overlap
    expect(result).toHaveLength(0);
  });

  it("returns all sessions when no constraints are set", () => {
    const s1 = makeSession("SWM01");
    const s2 = makeSession("GYM01", { sport: "Gymnastics" });

    const alice = makeMember("Alice", {
      candidateSessions: [s1, s2],
    });

    const sessionInterestCounts = new Map<string, number>([
      ["SWM01", 1],
      ["GYM01", 1],
    ]);

    const result = filterCandidateSessions(
      alice,
      [alice],
      sessionInterestCounts
    );

    expect(result).toHaveLength(2);
  });

  it("hard buddy filter runs before minBuddies — session passing hard buddy but failing minBuddies is excluded", () => {
    // Alice has hardBuddy Bob and minBuddies=2
    // SWM01: Bob interested, total interest count = 2 (Alice + Bob) → 2-1 = 1 < 2
    const s1 = makeSession("SWM01");

    const alice = makeMember("Alice", {
      hardBuddies: ["Bob"],
      minBuddies: 2,
      candidateSessions: [s1],
    });
    const bob = makeMember("Bob", {
      candidateSessions: [makeSession("SWM01")],
    });

    const sessionInterestCounts = new Map<string, number>([["SWM01", 2]]);

    const result = filterCandidateSessions(
      alice,
      [alice, bob],
      sessionInterestCounts
    );

    // Passes hard buddy (Bob has SWM01), fails minBuddies (2-1=1 < 2)
    expect(result).toHaveLength(0);
  });

  it("member with multiple hard buddies and only partial overlap gets intersection", () => {
    const s1 = makeSession("S01");
    const s2 = makeSession("S02", { sport: "Gymnastics" });
    const s3 = makeSession("S03", { sport: "Track & Field" });
    const s4 = makeSession("S04", { sport: "Diving" });

    const alice = makeMember("Alice", {
      hardBuddies: ["Bob", "Carol", "Dave"],
      candidateSessions: [s1, s2, s3, s4],
    });
    // Bob has {S01, S02, S03}
    const bob = makeMember("Bob", {
      candidateSessions: [
        makeSession("S01"),
        makeSession("S02"),
        makeSession("S03"),
      ],
    });
    // Carol has {S01, S03, S04}
    const carol = makeMember("Carol", {
      candidateSessions: [
        makeSession("S01"),
        makeSession("S03"),
        makeSession("S04"),
      ],
    });
    // Dave has {S01, S02, S04}
    const dave = makeMember("Dave", {
      candidateSessions: [
        makeSession("S01"),
        makeSession("S02"),
        makeSession("S04"),
      ],
    });

    const sessionInterestCounts = new Map<string, number>([
      ["S01", 4],
      ["S02", 3],
      ["S03", 3],
      ["S04", 3],
    ]);

    const result = filterCandidateSessions(
      alice,
      [alice, bob, carol, dave],
      sessionInterestCounts
    );

    // Intersection: Bob ∩ Carol ∩ Dave = {S01}
    expect(result).toHaveLength(1);
    expect(result[0].sessionCode).toBe("S01");
  });

  it("minBuddies=0 with interest count of 0 still passes (no constraint)", () => {
    const s1 = makeSession("SOLO01");

    const alice = makeMember("Alice", {
      minBuddies: 0,
      candidateSessions: [s1],
    });

    // Session not even in counts map → defaults to 0
    const sessionInterestCounts = new Map<string, number>();

    const result = filterCandidateSessions(
      alice,
      [alice],
      sessionInterestCounts
    );

    // minBuddies=0 → filter is no-op
    expect(result).toHaveLength(1);
  });
});

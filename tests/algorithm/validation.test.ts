import { describe, it, expect } from "vitest";
import { validatePostGeneration } from "@/lib/algorithm/validation";
import type { DayComboResult, MemberData } from "@/lib/algorithm/types";

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

function makeCombo(
  memberId: string,
  day: string,
  rank: "primary" | "backup1" | "backup2",
  sessionCodes: string[],
  score = 10
): DayComboResult {
  return { memberId, day, rank, sessionCodes, score };
}

describe("validatePostGeneration", () => {
  it("returns no violations when constraints are satisfied across P+B1+B2", () => {
    const members = [makeMember("Alice", { minBuddies: 1 }), makeMember("Bob")];

    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "backup1", ["SWM01"]), // Bob has it in B1
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(0);
  });

  it("detects minBuddies violation", () => {
    const members = [makeMember("Alice", { minBuddies: 2 }), makeMember("Bob")];

    // Alice's primary has SWM01, but only Bob has it (1 other) — Alice needs 2
    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("minBuddies");
    expect(violations[0].memberId).toBe("Alice");
    expect(violations[0].sessionCode).toBe("SWM01");
  });

  it("detects hardBuddies violation", () => {
    const members = [
      makeMember("Alice", { hardBuddies: ["Bob"] }),
      makeMember("Bob"),
    ];

    // Alice's primary has SWM01, but Bob does NOT have SWM01 in any combo
    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("hardBuddies");
    expect(violations[0].memberId).toBe("Alice");
    expect(violations[0].sessionCode).toBe("SWM01");
  });

  it("no violations for members with no primary combos", () => {
    const members = [
      makeMember("Alice", { minBuddies: 5, hardBuddies: ["Bob"] }),
      makeMember("Bob"),
    ];

    // Alice only has backup combos — no primary to validate
    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "backup1", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(0);
  });

  it("hard buddy satisfied via backup combo on same day", () => {
    const members = [
      makeMember("Alice", { hardBuddies: ["Bob"] }),
      makeMember("Bob"),
    ];

    // Alice's primary has SWM01, Bob has SWM01 in B2 — satisfied
    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "backup2", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(0);
  });

  it("hard buddy on wrong day still counts as violation", () => {
    const members = [
      makeMember("Alice", { hardBuddies: ["Bob"] }),
      makeMember("Bob"),
    ];

    // Alice has SWM01 on day 22, Bob has SWM01 on day 23 — different days
    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-23", "primary", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("hardBuddies");
  });

  it("skips validation for locked sessions", () => {
    // Alice needs minBuddies=2 and hard buddy Bob.
    // SWM01 is locked — even though Bob doesn't have it,
    // it shouldn't be flagged as a violation.
    const members = [
      makeMember("Alice", {
        minBuddies: 2,
        hardBuddies: ["Bob"],
        lockedSessionCodes: ["SWM01"],
      }),
      makeMember("Bob"),
    ];

    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01", "GYM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    // SWM01 violation should be skipped (locked), GYM01 has Bob → no violation
    expect(violations.filter((v) => v.sessionCode === "SWM01")).toHaveLength(0);
  });
});

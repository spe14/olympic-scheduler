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

  it("skips combo whose member is not in the members array", () => {
    // A primary combo references "Ghost" who isn't in the members list.
    // Validation should silently skip it, not crash or produce violations.
    const members = [makeMember("Alice")];

    const combos: DayComboResult[] = [
      makeCombo("Ghost", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(0);
  });

  it("detects minBuddies violation when member is the only attendee of a session", () => {
    // Alice has SWM01 in her primary but no other member has it in any combo.
    // With minBuddies=1, othersCount should be 0 → violation.
    const members = [makeMember("Alice", { minBuddies: 1 }), makeMember("Bob")];

    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("minBuddies");
    expect(violations[0].memberId).toBe("Alice");
    expect(violations[0].sessionCode).toBe("SWM01");
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

  it("skips both minBuddies and hardBuddies checks on locked sessions while flagging unlocked ones", () => {
    // Alice has a locked session (SWM01) that would violate both minBuddies and
    // hardBuddies, plus an unlocked session (TRK01) that also violates both.
    // Only the unlocked session should produce violations — the locked session's
    // continue statement (line 50) must skip all constraint checks.
    const members = [
      makeMember("Alice", {
        minBuddies: 1,
        hardBuddies: ["Bob"],
        lockedSessionCodes: ["SWM01"],
      }),
      makeMember("Bob"),
    ];

    const combos: DayComboResult[] = [
      // Alice's primary has locked SWM01 and unlocked TRK01.
      // Neither session has Bob attending, and Alice is the only attendee.
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01", "TRK01"]),
      // Bob is on a completely different session
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);

    // SWM01 is locked → continue skips all checks → 0 violations for SWM01
    expect(violations.filter((v) => v.sessionCode === "SWM01")).toHaveLength(0);

    // TRK01 is NOT locked → should produce both minBuddies and hardBuddies violations
    const trkViolations = violations.filter((v) => v.sessionCode === "TRK01");
    expect(trkViolations).toHaveLength(2);
    expect(trkViolations.map((v) => v.type).sort()).toEqual([
      "hardBuddies",
      "minBuddies",
    ]);
  });

  it("skips validation entirely for member with no primary combos (e.g. in membersWithNoCombos)", () => {
    // Alice has hardBuddies and minBuddies constraints but zero combos
    // (she would be in membersWithNoCombos in the runner).
    // Validation should produce zero violations because there are no
    // primary combos to check.
    const members: MemberData[] = [
      makeMember("Alice", {
        hardBuddies: ["Bob"],
        minBuddies: 1,
      }),
      makeMember("Bob"),
    ];

    // Alice has NO combos at all (empty sessions → no combos generated)
    // Bob has a primary combo
    const combos: DayComboResult[] = [
      makeCombo("Bob", "2028-07-22", "primary", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);

    // No violations because Alice has no primary combos to validate
    expect(violations).toHaveLength(0);
    // Specifically, no violations for Alice
    expect(violations.filter((v) => v.memberId === "Alice")).toHaveLength(0);
  });

  it("does not validate backup combos, only primary combos", () => {
    // Alice has minBuddies=1 and a session SWM01 only in her backup1.
    // Bob does NOT have SWM01. But since SWM01 is in a backup (not primary),
    // validation should not flag it.
    const members: MemberData[] = [
      makeMember("Alice", { minBuddies: 1 }),
      makeMember("Bob"),
    ];

    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["GYM01"]),
      makeCombo("Alice", "2028-07-22", "backup1", ["SWM01"]),
      makeCombo("Bob", "2028-07-22", "primary", ["GYM01"]),
    ];

    const violations = validatePostGeneration(combos, members);

    // GYM01 in primary: Bob also has GYM01 → 1 other ≥ 1 → passes minBuddies
    // SWM01 in backup1: not checked (only primaries are validated)
    expect(violations).toHaveLength(0);
  });

  it("member not in members array is silently skipped", () => {
    // A combo references a memberId that doesn't exist in the members array.
    // The memberMap lookup returns undefined, so the combo is skipped.
    const members: MemberData[] = [makeMember("Alice")];

    const combos: DayComboResult[] = [
      makeCombo("Alice", "2028-07-22", "primary", ["SWM01"]),
      makeCombo("Ghost", "2028-07-22", "primary", ["SWM01"]),
    ];

    const violations = validatePostGeneration(combos, members);

    // Alice: no constraints → no violations
    // Ghost: memberMap.get("Ghost") = undefined → skipped (line 45 `if (!memberData) continue`)
    expect(violations).toHaveLength(0);
  });
});

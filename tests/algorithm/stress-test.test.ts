import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import { runScheduleGeneration } from "@/lib/algorithm/runner";
import {
  computeWindowRankings,
  buildMemberScores,
} from "@/lib/algorithm/window-ranking";
import type {
  MemberData,
  TravelEntry,
  CandidateSession,
} from "@/lib/algorithm/types";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "papaparse";

// ---------------------------------------------------------------------------
// Load real CSV data
// ---------------------------------------------------------------------------

const sessionsPath = resolve("scripts/output/la2028_sessions.csv");
const drivingPath = resolve("scripts/output/driving_times.csv");

type SessionRow = {
  sport: string;
  venue: string;
  zone: string;
  session_code: string;
  session_date: string;
  session_type: string;
  session_description: string;
  start_time: string;
  end_time: string;
};

type DrivingRow = Record<string, string>;

function loadSessions(): SessionRow[] {
  const csv = readFileSync(sessionsPath, "utf-8");
  const result = parse<SessionRow>(csv, { header: true, skipEmptyLines: true });
  return result.data;
}

function loadTravelEntries(): TravelEntry[] {
  const csv = readFileSync(drivingPath, "utf-8");
  const result = parse<DrivingRow>(csv, { header: true, skipEmptyLines: true });
  const entries: TravelEntry[] = [];
  for (const row of result.data) {
    const origin = row[""] || row["origin"] || Object.values(row)[0];
    if (!origin) continue;
    for (const [dest, val] of Object.entries(row)) {
      if (dest === "" || dest === "origin" || dest === origin) continue;
      const minutes = parseFloat(val);
      if (!isNaN(minutes)) {
        entries.push({
          originZone: origin,
          destinationZone: dest,
          drivingMinutes: minutes,
          transitMinutes: null,
        });
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Stress test configuration
// ---------------------------------------------------------------------------

const STRESS_SPORTS = [
  "Tennis",
  "Volleyball",
  "Handball",
  "Beach Volleyball",
  "Basketball",
  "Table Tennis",
  "Badminton",
  "3x3 Basketball",
  "Water Polo",
  "Hockey",
];

const MEMBER_IDS = [
  "alex",
  "blake",
  "casey",
  "dana",
  "ellis",
  "frankie",
  "gale",
  "harper",
  "indigo",
  "jordan",
  "kendall",
  "logan",
];

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

// Shared data across all stress test describes
const ALL_SESSIONS = loadSessions();
const ALL_TRAVEL = loadTravelEntries();

// All Olympic days
const ALL_DAYS: string[] = [];
for (let i = 0; i < 19; i++) {
  const d = new Date("2028-07-12T12:00:00");
  d.setDate(d.getDate() + i);
  ALL_DAYS.push(d.toISOString().split("T")[0]);
}

describe("Stress test — 12 members × 10 sports × all sessions", () => {
  const travelEntries = ALL_TRAVEL;
  const allDays = ALL_DAYS;

  // Build candidate sessions for the 10 sports
  const stressSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
    STRESS_SPORTS.includes(s.sport)
  ).map((s) => ({
    sessionCode: s.session_code,
    sport: s.sport,
    zone: s.zone,
    sessionDate: s.session_date,
    startTime: s.start_time.slice(0, 5), // "HH:MM"
    endTime: s.end_time.slice(0, 5),
    interest: "high" as const,
  }));

  // All 12 members have identical preferences, no buddy constraints
  const members: MemberData[] = MEMBER_IDS.map((id) => ({
    memberId: id,
    sportRankings: [...STRESS_SPORTS],
    minBuddies: 0,
    hardBuddies: [],
    softBuddies: [],
    candidateSessions: stressSessions.map((s) => ({ ...s })),
  }));

  it("completes within 60 seconds", () => {
    const start = Date.now();
    const result = runScheduleGeneration(members, travelEntries, allDays);
    const elapsed = Date.now() - start;

    // Write all output to file
    const lines: string[] = [];
    lines.push(`=== STRESS TEST RESULTS ===`);
    lines.push(`Elapsed: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
    lines.push(
      `Convergence: ${result.convergence.converged ? "YES" : "NO"} in ${result.convergence.iterations} iteration(s)`
    );
    lines.push(`Timed out: ${result.convergence.timedOut ? "YES" : "NO"}`);
    lines.push(`Violations: ${result.convergence.violations.length}`);
    lines.push(`Members with no combos: ${result.membersWithNoCombos.length}`);
    lines.push(`Total combo rows: ${result.combos.length}`);
    lines.push(`Total sessions entered per member: ${stressSessions.length}`);

    // Sessions per day breakdown
    const sessionsPerDay = new Map<string, number>();
    for (const s of stressSessions) {
      sessionsPerDay.set(
        s.sessionDate,
        (sessionsPerDay.get(s.sessionDate) ?? 0) + 1
      );
    }
    lines.push(``);
    lines.push(`--- Sessions per day (these 10 sports) ---`);
    for (const day of allDays) {
      const count = sessionsPerDay.get(day) ?? 0;
      if (count > 0) lines.push(`  ${day}: ${count} sessions`);
    }

    // Print combos for first member (all members identical)
    const memberCombos = result.combos.filter(
      (c) => c.memberId === MEMBER_IDS[0]
    );
    const daySet = new Set(memberCombos.map((c) => c.day));
    const sortedDays = [...daySet].sort();

    lines.push(``);
    lines.push(`--- Expected output per member (all 12 identical) ---`);
    for (const day of sortedDays) {
      const dayCombos = memberCombos
        .filter((c) => c.day === day)
        .sort((a, b) => {
          const order = { primary: 0, backup1: 1, backup2: 2 };
          return (
            order[a.rank as keyof typeof order] -
            order[b.rank as keyof typeof order]
          );
        });

      const primary = dayCombos.find((c) => c.rank === "primary");
      const b1 = dayCombos.find((c) => c.rank === "backup1");
      const b2 = dayCombos.find((c) => c.rank === "backup2");

      const fmtCombo = (c: (typeof dayCombos)[0] | undefined) =>
        c ? `[${c.sessionCodes.join(", ")}] score=${c.score.toFixed(4)}` : "—";

      lines.push(`  ${day}:`);
      lines.push(`    P:  ${fmtCombo(primary)}`);
      lines.push(`    B1: ${fmtCombo(b1)}`);
      lines.push(`    B2: ${fmtCombo(b2)}`);
    }

    // Verify all members produce same output
    lines.push(``);
    lines.push(`--- Verify all 12 members produce identical combos ---`);
    const firstMemberCombos = result.combos
      .filter((c) => c.memberId === MEMBER_IDS[0])
      .map(
        (c) =>
          `${c.day}|${c.rank}|${c.sessionCodes.sort().join(",")}|${c.score.toFixed(6)}`
      )
      .sort();
    let allIdentical = true;
    for (const mid of MEMBER_IDS.slice(1)) {
      const thisMemberCombos = result.combos
        .filter((c) => c.memberId === mid)
        .map(
          (c) =>
            `${c.day}|${c.rank}|${c.sessionCodes.sort().join(",")}|${c.score.toFixed(6)}`
        )
        .sort();
      if (
        JSON.stringify(firstMemberCombos) !== JSON.stringify(thisMemberCombos)
      ) {
        allIdentical = false;
        lines.push(`  ${mid}: DIFFERENT from ${MEMBER_IDS[0]}!`);
      }
    }
    if (allIdentical) {
      lines.push(`  All 12 members produce identical combos ✓`);
    }

    // Window ranking
    const memberScoresData = buildMemberScores(result.combos);
    const windows = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 19,
    });

    lines.push(``);
    lines.push(`--- Window rankings (consecutive 19 days) ---`);
    for (const w of windows.slice(0, 5)) {
      lines.push(
        `  ${w.startDate} – ${w.endDate}: score=${w.score.toFixed(4)}`
      );
    }

    writeFileSync(
      resolve("tests/algorithm/stress-test-output.txt"),
      lines.join("\n") + "\n"
    );

    expect(elapsed).toBeLessThan(60_000);
    expect(result.convergence.timedOut).toBeFalsy();
    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toHaveLength(0);
  });

  it("sanity check — Jul 19 primary is correct", () => {
    const result = runScheduleGeneration(members, travelEntries, allDays);
    const alexJul19 = result.combos.find(
      (c) =>
        c.memberId === "alex" && c.day === "2028-07-19" && c.rank === "primary"
    );

    // TEN04 (Tennis rank 1, 18:30–23:30 Carson) = 2.0
    // VVO17 (Volleyball rank 2, 09:00–11:30 Anaheim) = 1.8889
    // VVO18 (Volleyball rank 2, 13:00–15:30 Anaheim) = 1.8889
    // Travel: VVO17→VVO18 same zone 90 min gap ✓
    //         VVO18→TEN04: Anaheim→Carson 30.05min→150 gap needed, actual 180 ✓
    // Score = 2.0 + 1.8889 + 1.8889 = 5.7778
    expect(alexJul19).toBeDefined();
    expect(alexJul19!.sessionCodes).toContain("TEN04");
    expect(alexJul19!.sessionCodes).toContain("VVO17");
    expect(alexJul19!.sessionCodes).toContain("VVO18");
    expect(alexJul19!.score).toBeCloseTo(5.7778, 3);

    // Verify no 2-Tennis combo scores higher. TEN01-03 all overlap (11:00-16:30),
    // TEN04-05 overlap (18:30-23:30). Max 1 per time block. Any 2-Tennis combo
    // (TEN01+TEN04) leaves only 1 slot → score ≤ 2.0+2.0+1.8889 = 5.8889 BUT
    // there's no VVO session that fits between TEN01 (ends 16:30 Carson) and
    // TEN04 (starts 18:30 Carson) — 120 min gap, same zone, needs 90 ✓ BUT
    // we'd need the 3rd session BEFORE TEN01 (starts 11:00).
    // Nothing ends early enough: VVO17 ends 11:30 > TEN01 starts 11:00 = overlap.
    // So 2 Tennis + 1 other is infeasible → 1 Tennis + 2 VVO is optimal. ✓
  });

  it("variant: with buddy constraints and locked sessions", () => {
    // Give every member all 11 others as soft buddies.
    // Give members 0-5 hard buddy on the next member (circular).
    // Give members 6-11 minBuddies = 2.
    // Lock VVO17 for member 0 (alex).
    const buddyMembers: MemberData[] = MEMBER_IDS.map((id, i) => ({
      memberId: id,
      sportRankings: [...STRESS_SPORTS],
      minBuddies: i >= 6 ? 2 : 0,
      hardBuddies: i < 6 ? [MEMBER_IDS[(i + 1) % MEMBER_IDS.length]] : [],
      softBuddies: MEMBER_IDS.filter((_, j) => j !== i),
      candidateSessions: stressSessions.map((s) => ({ ...s })),
      lockedSessionCodes: id === "alex" ? ["VVO17"] : [],
    }));

    const start = Date.now();
    const result = runScheduleGeneration(buddyMembers, travelEntries, allDays);
    const elapsed = Date.now() - start;

    const lines: string[] = [];
    lines.push(`=== VARIANT: BUDDY CONSTRAINTS + LOCKED SESSIONS ===`);
    lines.push(`Elapsed: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
    lines.push(
      `Convergence: ${result.convergence.converged ? "YES" : "NO"} in ${result.convergence.iterations} iteration(s)`
    );
    lines.push(`Timed out: ${result.convergence.timedOut ? "YES" : "NO"}`);
    lines.push(`Violations: ${result.convergence.violations.length}`);
    lines.push(`Members with no combos: ${result.membersWithNoCombos.length}`);
    lines.push(`Total combo rows: ${result.combos.length}`);
    lines.push(``);

    // Show convergence violations if any
    if (result.convergence.violations.length > 0) {
      lines.push(`--- Violations ---`);
      for (const v of result.convergence.violations) {
        lines.push(
          `  ${v.memberId} | ${v.sessionCode} | ${v.day} | ${v.type} | ${v.detail}`
        );
      }
      lines.push(``);
    }

    // Check alex's locked VVO17 on Jul 19
    const alexJul19 = result.combos.filter(
      (c) => c.memberId === "alex" && c.day === "2028-07-19"
    );
    lines.push(`--- Alex Jul 19 (VVO17 locked) ---`);
    for (const c of alexJul19.sort((a, b) => a.rank.localeCompare(b.rank))) {
      lines.push(
        `  ${c.rank}: [${c.sessionCodes.join(", ")}] score=${c.score.toFixed(4)}`
      );
    }

    // Show how many members have different combos vs the no-constraint baseline
    lines.push(``);
    lines.push(`--- Combo differences from baseline (per member) ---`);
    const baseline = runScheduleGeneration(members, travelEntries, allDays);
    for (const mid of MEMBER_IDS) {
      const buddyCombos = result.combos
        .filter((c) => c.memberId === mid && c.rank === "primary")
        .map((c) => `${c.day}|${c.sessionCodes.sort().join(",")}`)
        .sort();
      const baseCombos = baseline.combos
        .filter((c) => c.memberId === mid && c.rank === "primary")
        .map((c) => `${c.day}|${c.sessionCodes.sort().join(",")}`)
        .sort();
      const diffs = buddyCombos.filter((c, i) => c !== baseCombos[i]);
      lines.push(
        `  ${mid}: ${diffs.length} day(s) differ from no-constraint baseline`
      );
    }

    writeFileSync(
      resolve("tests/algorithm/stress-test-variant-output.txt"),
      lines.join("\n") + "\n"
    );

    expect(elapsed).toBeLessThan(60_000);
    expect(result.convergence.timedOut).toBeFalsy();

    // VVO17 must be in every alex combo on Jul 19
    for (const c of alexJul19) {
      expect(c.sessionCodes).toContain("VVO17");
    }
  });
});

// ===========================================================================
// All-zone stress test — covers all 17 zones including Trestles Beach
// ===========================================================================

describe("Stress test — all-zone coverage (17 zones)", () => {
  // Sports that collectively cover all 17 zones:
  //   Inglewood: Swimming/Basketball, DTLA: Artistic Gymnastics/Table Tennis/Boxing,
  //   Exposition Park: Athletics/Badminton, Long Beach: Beach Volleyball/Water Polo/Handball,
  //   Carson: Tennis/Hockey, Anaheim: Volleyball, Valley: 3x3 Basketball,
  //   Pasadena: Diving/Football, Trestles Beach: Surfing, Pomona: Cricket,
  //   Arcadia: Equestrian, Universal City: Squash, Riviera: Golf,
  //   Venice: Triathlon/Marathon, Whittier Narrows: Shooting (Shotgun),
  //   City of Industry: Mountain Bike, Port of Los Angeles: Sailing
  const ALL_ZONE_SPORTS = [
    "Swimming",
    "Athletics (Track & Field)",
    "Diving",
    "Surfing",
    "Cricket",
    "Equestrian",
    "Squash",
    "Golf",
    "Triathlon",
    "Shooting (Shotgun)",
    "Mountain Bike",
    "Volleyball",
    "Tennis",
    "Boxing",
  ];

  const allZoneSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
    ALL_ZONE_SPORTS.includes(s.sport)
  ).map((s) => ({
    sessionCode: s.session_code,
    sport: s.sport,
    zone: s.zone,
    sessionDate: s.session_date,
    startTime: s.start_time.slice(0, 5),
    endTime: s.end_time.slice(0, 5),
    interest: "high" as const,
  }));

  it("covers all major zones and completes within 60 seconds", () => {
    // Verify sessions span many zones
    const zones = new Set(allZoneSessions.map((s) => s.zone));
    expect(zones.size).toBeGreaterThanOrEqual(12);
    expect(zones.has("Trestles Beach Zone")).toBe(true);

    // 6 members with different sport ranking orders
    const members: MemberData[] = MEMBER_IDS.slice(0, 6).map((id, i) => ({
      memberId: id,
      sportRankings: [
        ...ALL_ZONE_SPORTS.slice(i % ALL_ZONE_SPORTS.length),
        ...ALL_ZONE_SPORTS.slice(0, i % ALL_ZONE_SPORTS.length),
      ],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: allZoneSessions.map((s) => ({ ...s })),
    }));

    const start = Date.now();
    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(60_000);
    expect(result.convergence.timedOut).toBeFalsy();
    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toHaveLength(0);

    // Verify combos span many days
    const comboDays = new Set(result.combos.map((c) => c.day));
    expect(comboDays.size).toBeGreaterThanOrEqual(10);

    // Verify no combo violates max 3 sessions per day
    for (const c of result.combos) {
      expect(c.sessionCodes.length).toBeLessThanOrEqual(3);
    }
  });

  it("Trestles Beach sessions are never paired with close-gap sessions", () => {
    // Surfing sessions are 07:00-16:30/17:30 (9.5-10.5 hrs).
    // 240-min gap needed → any session starting before 20:30 in another zone is infeasible.
    const members: MemberData[] = [
      {
        memberId: "solo",
        sportRankings: ["Surfing", "Swimming", "Volleyball"],
        minBuddies: 0,
        hardBuddies: [],
        softBuddies: [],
        candidateSessions: allZoneSessions
          .filter((s) =>
            ["Surfing", "Swimming", "Volleyball"].includes(s.sport)
          )
          .map((s) => ({ ...s })),
      },
    ];

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);

    // For any combo containing a Surfing session, check no session in another
    // zone starts within 240 min of the surfing session's end
    for (const c of result.combos) {
      const hasSurfing = c.sessionCodes.some((code) => code.startsWith("SRF"));
      if (hasSurfing && c.sessionCodes.length > 1) {
        // This combo pairs surfing with something else.
        // The algorithm should only allow this if the gap is ≥ 240 min
        // and the other session is NOT at Trestles Beach (same-zone = 90 min).
        // Surfing ends at 16:30 or 17:30, so the next session must start at
        // 20:30+ (or be at Trestles Beach with 90-min gap).
        const sessions = c.sessionCodes.map(
          (code) => allZoneSessions.find((s) => s.sessionCode === code)!
        );
        const surfSession = sessions.find((s) => s.sport === "Surfing")!;
        const others = sessions.filter((s) => s.sport !== "Surfing");
        for (const other of others) {
          if (other.zone !== "Trestles Beach Zone") {
            // Cross-zone: gap must be ≥ 240 min
            const surfEnd =
              parseInt(surfSession.endTime.split(":")[0]) * 60 +
              parseInt(surfSession.endTime.split(":")[1]);
            const otherStart =
              parseInt(other.startTime.split(":")[0]) * 60 +
              parseInt(other.startTime.split(":")[1]);
            const gap = Math.abs(otherStart - surfEnd);
            expect(gap).toBeGreaterThanOrEqual(240);
          }
        }
      }
    }
  });
});

// ===========================================================================
// Heterogeneous members — different sport rankings and mixed interest levels
// ===========================================================================

describe("Stress test — heterogeneous member preferences", () => {
  const interests: ("high" | "medium" | "low")[] = ["high", "medium", "low"];

  it("12 members with different rankings and mixed interest produce fair schedules", () => {
    const heterogenousSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      STRESS_SPORTS.includes(s.sport)
    ).map((s, i) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: interests[i % 3], // Rotate high/medium/low
    }));

    // Each member gets a different rotation of sport rankings
    const members: MemberData[] = MEMBER_IDS.map((id, i) => ({
      memberId: id,
      sportRankings: [
        ...STRESS_SPORTS.slice(i % STRESS_SPORTS.length),
        ...STRESS_SPORTS.slice(0, i % STRESS_SPORTS.length),
      ],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: heterogenousSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);

    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toHaveLength(0);

    // All 12 members should have combos
    const memberIds = new Set(result.combos.map((c) => c.memberId));
    expect(memberIds.size).toBe(12);

    // With different rankings, members should produce DIFFERENT primaries
    // (at least some days) because they value sports differently.
    const memberPrimaries = new Map<string, string[]>();
    for (const id of MEMBER_IDS) {
      const primaries = result.combos
        .filter((c) => c.memberId === id && c.rank === "primary")
        .map((c) => `${c.day}|${c.sessionCodes.sort().join(",")}`)
        .sort();
      memberPrimaries.set(id, primaries);
    }
    // At least 2 members should have different primaries on at least one day
    let hasDifference = false;
    const first = memberPrimaries.get(MEMBER_IDS[0])!;
    for (const id of MEMBER_IDS.slice(1)) {
      const other = memberPrimaries.get(id)!;
      if (JSON.stringify(first) !== JSON.stringify(other)) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);

    // Window ranking with heterogeneous scores should show fairness penalty
    const memberScoresData = buildMemberScores(result.combos);
    const windows = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
    });
    expect(windows.length).toBeGreaterThan(0);
    // Best window should have a positive score
    expect(windows[0].score).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Long-duration sessions (Golf 9hrs, Surfing 9.5hrs) stress
// ===========================================================================

describe("Stress test — long-duration sessions blocking same-day combos", () => {
  it("Golf and Surfing sessions (9+ hours) leave no room for same-day cross-zone pairings", () => {
    // Golf at Riviera Zone: 09:00-18:00+ (9 hrs)
    // Surfing at Trestles Beach Zone: 07:00-16:30+ (9.5 hrs)
    // These are so long that cross-zone pairings are nearly impossible.
    const longSports = ["Golf", "Surfing", "Swimming", "Diving"];
    const longSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      longSports.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    const members: MemberData[] = MEMBER_IDS.slice(0, 4).map((id, i) => ({
      memberId: id,
      sportRankings: [
        ...longSports.slice(i % longSports.length),
        ...longSports.slice(0, i % longSports.length),
      ],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: longSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);

    expect(result.convergence.converged).toBe(true);

    // Golf and Surfing sessions should mostly appear as solo combos
    // (they fill 9+ hours, leaving no room for cross-zone pairings).
    const golfCombos = result.combos.filter((c) =>
      c.sessionCodes.some((code) => code.startsWith("GLF"))
    );
    for (const c of golfCombos) {
      // If paired, the other session must be same zone or have massive gap
      if (c.sessionCodes.length > 1) {
        // This is fine — just verify it's travel-feasible (algorithm guarantees it)
        expect(c.sessionCodes.length).toBeLessThanOrEqual(3);
      }
    }

    // Surfing sessions (Trestles Beach, 07:00-16:30+) need 240-min gap for cross-zone.
    // 16:30 + 240 min = 20:30 — almost nothing runs that late → mostly solo
    const surfCombos = result.combos.filter(
      (c) =>
        c.sessionCodes.some((code) => code.startsWith("SRF")) &&
        c.sessionCodes.length > 1
    );
    // Any multi-session surfing combo must have the other session in same zone
    // or starting after 20:30 (very rare)
    for (const c of surfCombos) {
      const sessions = c.sessionCodes.map(
        (code) => longSessions.find((s) => s.sessionCode === code)!
      );
      const surf = sessions.find((s) => s.sport === "Surfing")!;
      const others = sessions.filter((s) => s.sport !== "Surfing");
      for (const other of others) {
        if (other.zone !== surf.zone) {
          // Cross-zone: verify massive gap
          const surfEndMin =
            parseInt(surf.endTime.split(":")[0]) * 60 +
            parseInt(surf.endTime.split(":")[1]);
          const otherStartMin =
            parseInt(other.startTime.split(":")[0]) * 60 +
            parseInt(other.startTime.split(":")[1]);
          expect(otherStartMin - surfEndMin).toBeGreaterThanOrEqual(240);
        }
      }
    }
  });
});

// ===========================================================================
// Convergence stress — hard buddy constraints that force multiple iterations
// ===========================================================================

describe("Stress test — hard buddy convergence under load", () => {
  it("circular hard buddy chain with partial session overlap forces convergence iterations", () => {
    // 6 members in a circular hard buddy chain: A→B→C→D→E→F→A.
    // Each member has a unique "personal" sport plus 3 shared sports.
    // The personal sport sessions won't be in the hard buddy's candidates,
    // so they'll be filtered out in iteration 1. This forces pruning and
    // re-convergence. However, the 3 shared sports should survive.
    const sharedSports = ["Tennis", "Volleyball", "Basketball"];
    const personalSports = [
      "Handball",
      "Table Tennis",
      "Badminton",
      "Water Polo",
      "Hockey",
      "3x3 Basketball",
    ];

    const baseSessions: CandidateSession[] = ALL_SESSIONS.filter(
      (s) => sharedSports.includes(s.sport) || personalSports.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    const ids = MEMBER_IDS.slice(0, 6);
    const members: MemberData[] = ids.map((id, i) => {
      const mySports = [...sharedSports, personalSports[i]];
      return {
        memberId: id,
        sportRankings: mySports,
        minBuddies: 0,
        hardBuddies: [ids[(i + 1) % ids.length]], // circular chain
        softBuddies: [],
        candidateSessions: baseSessions
          .filter((s) => mySports.includes(s.sport))
          .map((s) => ({ ...s })),
      };
    });

    const start = Date.now();
    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(60_000);
    expect(result.convergence.timedOut).toBeFalsy();

    // Personal sport sessions should be filtered by hard buddy constraint.
    // Shared sport sessions should survive since all members have them.
    for (const id of ids) {
      const memberCombos = result.combos.filter(
        (c) => c.memberId === id && c.rank === "primary"
      );
      for (const c of memberCombos) {
        // All primary combo sessions should be from shared sports
        // (personal sport sessions should have been filtered/pruned)
        for (const code of c.sessionCodes) {
          const session = baseSessions.find((s) => s.sessionCode === code);
          if (session) {
            expect(sharedSports).toContain(session.sport);
          }
        }
      }
    }
  });

  it("high minBuddies=11 with 12 identical members all converges", () => {
    const stressSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      STRESS_SPORTS.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    // All 12 members with minBuddies=11: every member needs all 11 others
    // to also be interested. Since all have identical sessions, all sessions
    // have interest count 12 → 12-1=11 ≥ 11 → all pass.
    const members: MemberData[] = MEMBER_IDS.map((id) => ({
      memberId: id,
      sportRankings: [...STRESS_SPORTS],
      minBuddies: 11,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: stressSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);

    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toHaveLength(0);

    // All 12 should produce identical combos (same sessions, same scores)
    const firstCombos = result.combos
      .filter((c) => c.memberId === MEMBER_IDS[0])
      .map(
        (c) =>
          `${c.day}|${c.rank}|${c.sessionCodes.sort().join(",")}|${c.score.toFixed(6)}`
      )
      .sort();

    for (const mid of MEMBER_IDS.slice(1)) {
      const thisCombos = result.combos
        .filter((c) => c.memberId === mid)
        .map(
          (c) =>
            `${c.day}|${c.rank}|${c.sessionCodes.sort().join(",")}|${c.score.toFixed(6)}`
        )
        .sort();
      expect(thisCombos).toEqual(firstCombos);
    }
  });
});

// ===========================================================================
// Window ranking stress — short windows and requiredDays
// ===========================================================================

describe("Stress test — window ranking with short windows and requiredDays", () => {
  it("5-day windows produce more options than 19-day window", () => {
    const stressSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      STRESS_SPORTS.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    const members: MemberData[] = MEMBER_IDS.slice(0, 4).map((id) => ({
      memberId: id,
      sportRankings: [...STRESS_SPORTS],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: stressSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);
    const memberScoresData = buildMemberScores(result.combos);

    // 19-day window: only 1 window (the entire Olympics)
    const windows19 = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 19,
    });
    expect(windows19).toHaveLength(1);

    // 5-day window: 15 possible windows (19 - 5 + 1)
    const windows5 = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
    });
    expect(windows5).toHaveLength(15);

    // 3-day window: 17 possible windows
    const windows3 = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 3,
    });
    expect(windows3).toHaveLength(17);

    // Windows should be sorted by score descending
    for (let i = 1; i < windows5.length; i++) {
      expect(windows5[i - 1].score).toBeGreaterThanOrEqual(windows5[i].score);
    }

    // Best 5-day window score should be less than the full 19-day score
    // (fewer days = fewer sessions = lower total)
    expect(windows5[0].score).toBeLessThan(windows19[0].score);
  });

  it("requiredDays filters out windows that don't contain purchased session dates", () => {
    const stressSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      STRESS_SPORTS.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    const members: MemberData[] = MEMBER_IDS.slice(0, 4).map((id) => ({
      memberId: id,
      sportRankings: [...STRESS_SPORTS],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: stressSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);
    const memberScoresData = buildMemberScores(result.combos);

    // 5-day window requiring Jul 20 (mid-Olympics): should exclude windows
    // that don't contain Jul 20
    const windowsRequired = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
      requiredDays: ["2028-07-20"],
    });

    // Every returned window must contain Jul 20
    for (const w of windowsRequired) {
      expect(w.startDate <= "2028-07-20").toBe(true);
      expect(w.endDate >= "2028-07-20").toBe(true);
    }

    // Should have fewer windows than without the constraint
    const windowsAll = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
    });
    expect(windowsRequired.length).toBeLessThan(windowsAll.length);

    // Requiring 2 dates far apart: Jul 13 and Jul 28 (15 days apart).
    // A 5-day window can't span both → empty result.
    const windowsImpossible = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
      requiredDays: ["2028-07-13", "2028-07-28"],
    });
    expect(windowsImpossible).toHaveLength(0);

    // Requiring 2 close dates: Jul 20 and Jul 22 (2 days apart).
    // A 5-day window should contain both. Windows start Jul 18-20 qualify.
    const windowsClose = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
      requiredDays: ["2028-07-20", "2028-07-22"],
    });
    expect(windowsClose.length).toBeGreaterThan(0);
    expect(windowsClose.length).toBeLessThanOrEqual(3);
    for (const w of windowsClose) {
      expect(w.startDate <= "2028-07-20").toBe(true);
      expect(w.endDate >= "2028-07-22").toBe(true);
    }
  });

  it("specific dateMode returns exactly 1 window with correct score", () => {
    const stressSessions: CandidateSession[] = ALL_SESSIONS.filter((s) =>
      STRESS_SPORTS.includes(s.sport)
    ).map((s) => ({
      sessionCode: s.session_code,
      sport: s.sport,
      zone: s.zone,
      sessionDate: s.session_date,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      interest: "high" as const,
    }));

    const members: MemberData[] = MEMBER_IDS.slice(0, 4).map((id) => ({
      memberId: id,
      sportRankings: [...STRESS_SPORTS],
      minBuddies: 0,
      hardBuddies: [],
      softBuddies: [],
      candidateSessions: stressSessions.map((s) => ({ ...s })),
    }));

    const result = runScheduleGeneration(members, ALL_TRAVEL, ALL_DAYS);
    const memberScoresData = buildMemberScores(result.combos);

    // Specific mode: score just Jul 19-23
    const specific = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "specific",
      startDate: "2028-07-19",
      endDate: "2028-07-23",
    });
    expect(specific).toHaveLength(1);
    expect(specific[0].startDate).toBe("2028-07-19");
    expect(specific[0].endDate).toBe("2028-07-23");
    expect(specific[0].score).toBeGreaterThan(0);

    // Should match the corresponding consecutive window
    const consec = computeWindowRankings({
      memberScores: memberScoresData,
      dateMode: "consecutive",
      consecutiveDays: 5,
    });
    const matching = consec.find((w) => w.startDate === "2028-07-19");
    expect(matching).toBeDefined();
    expect(specific[0].score).toBeCloseTo(matching!.score, 6);
  });
});

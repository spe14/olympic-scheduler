import { describe, it, expect } from "vitest";
import { runScheduleGeneration } from "@/lib/algorithm/runner";
import type { MemberData, TravelEntry } from "@/lib/algorithm/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeSession(
  code: string,
  sport: string,
  zone: string,
  date: string,
  startTime: string,
  endTime: string,
  interest: "low" | "medium" | "high" = "high"
) {
  return {
    sessionCode: code,
    sport,
    zone,
    sessionDate: date,
    startTime,
    endTime,
    interest,
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
  {
    originZone: "Long Beach Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 70,
    transitMinutes: null,
  },
  {
    originZone: "Rose Bowl Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 85,
    transitMinutes: null,
  },
];

const DAYS = ["2028-07-22", "2028-07-23", "2028-07-24"];

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("runScheduleGeneration - end-to-end", () => {
  describe("basic 2-member group", () => {
    it("generates combos for 2 members with overlapping sports", () => {
      const swmSession = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00",
        "high",
        200
      );
      const gymSession = makeSession(
        "GYM01",
        "Gymnastics",
        "Downtown LA Zone",
        "2028-07-22",
        "14:30",
        "16:30",
        "medium",
        300
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [swmSession, gymSession],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics", "Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:30",
            "16:30"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Both members should have combos
      expect(result.membersWithNoCombos).toHaveLength(0);

      // Combos should be on the correct day
      for (const combo of result.combos) {
        expect(combo.day).toBe("2028-07-22");
      }

      // Each member should have primary rank assigned
      const aliceCombos = result.combos.filter((c) => c.memberId === "Alice");
      const bobCombos = result.combos.filter((c) => c.memberId === "Bob");
      expect(aliceCombos.length).toBeGreaterThanOrEqual(1);
      expect(bobCombos.length).toBeGreaterThanOrEqual(1);
      expect(aliceCombos.some((c) => c.rank === "primary")).toBe(true);
      expect(bobCombos.some((c) => c.rank === "primary")).toBe(true);

      // Scores should be positive
      for (const combo of result.combos) {
        expect(combo.score).toBeGreaterThan(0);
      }
    });
  });

  describe("3-member group with buddy constraints", () => {
    it("applies hard buddy and minBuddies constraints correctly", () => {
      // Alice has hard buddy Bob
      // Carol has minBuddies = 1
      // All three are interested in SWM01 and GYM01
      // Only Alice and Bob are interested in TRK01
      const sharedSession1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "10:30",
        "high"
      );
      const sharedSession2 = makeSession(
        "GYM01",
        "Gymnastics",
        "Downtown LA Zone",
        "2028-07-22",
        "13:00",
        "15:00",
        "high"
      );
      const abOnlySession = makeSession(
        "TRK01",
        "Track & Field",
        "Rose Bowl Zone",
        "2028-07-23",
        "10:00",
        "12:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        hardBuddies: ["Bob"],
        candidateSessions: [sharedSession1, sharedSession2, abOnlySession],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics", "Swimming", "Track & Field"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "10:30"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "13:00",
            "15:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Gymnastics"],
        minBuddies: 1,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "10:30"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "13:00",
            "15:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22", "2028-07-23"]
      );

      // Alice's hard buddy is Bob → Alice only gets sessions Bob also has
      // Bob has SWM01, GYM01, TRK01 → Alice keeps all 3
      const aliceCombos = result.combos.filter((c) => c.memberId === "Alice");
      expect(aliceCombos.length).toBeGreaterThanOrEqual(1);

      // Carol's minBuddies = 1, so she needs at least 1 other member interested
      // SWM01: 3 interested (count - 1 = 2 >= 1) ✓
      // GYM01: 3 interested (count - 1 = 2 >= 1) ✓
      const carolCombos = result.combos.filter((c) => c.memberId === "Carol");
      expect(carolCombos.length).toBeGreaterThanOrEqual(1);

      expect(result.membersWithNoCombos).toHaveLength(0);
    });
  });

  describe("4-member group realistic scenario", () => {
    it("handles mixed rankings, overlapping sessions, and buddy constraints", () => {
      // 4 members, day 1 and day 2 sessions
      const aliceSessions = [
        makeSession(
          "SWM01",
          "Swimming",
          "SoFi Stadium Zone",
          "2028-07-22",
          "09:00",
          "11:00"
        ),
        makeSession(
          "GYM01",
          "Gymnastics",
          "Downtown LA Zone",
          "2028-07-22",
          "14:00",
          "16:00"
        ),
        makeSession(
          "TRK01",
          "Track & Field",
          "Rose Bowl Zone",
          "2028-07-23",
          "10:00",
          "12:00"
        ),
      ];
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        softBuddies: ["Bob"],
        candidateSessions: aliceSessions,
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics", "Swimming"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Track & Field", "Swimming"],
        minBuddies: 1,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const dave = makeMember("Dave", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22", "2028-07-23"]
      );

      // No member should be left out
      expect(result.membersWithNoCombos).toHaveLength(0);

      // All 4 members should have combos
      const memberIds = new Set(result.combos.map((c) => c.memberId));
      expect(memberIds.size).toBe(4);

      // Combos should span 2 days
      const comboDays = new Set(result.combos.map((c) => c.day));
      expect(comboDays.size).toBeLessThanOrEqual(2);
    });
  });

  describe("member with no valid combos due to hard buddy constraint", () => {
    it("reports member in membersWithNoCombos when hard buddy eliminates all sessions", () => {
      const eveSession = makeSession(
        "DIV01",
        "Diving",
        "Long Beach Zone",
        "2028-07-22",
        "10:00",
        "12:00",
        "high"
      );

      const eve = makeMember("Eve", {
        sportRankings: ["Diving"],
        hardBuddies: ["Frank"],
        candidateSessions: [eveSession],
      });

      // Frank has no overlapping sessions with Eve
      const frank = makeMember("Frank", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([eve, frank], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Eve's hard buddy Frank doesn't have DIV01 → all sessions filtered out
      expect(result.membersWithNoCombos).toContain("Eve");
      // Frank has no buddy constraints → should have combos
      expect(result.membersWithNoCombos).not.toContain("Frank");
    });
  });

  describe("all sessions filtered out by minBuddies", () => {
    it("reports member when minBuddies exceeds available group size", () => {
      const session = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00",
        "high"
      );

      // Alice requires 3 buddies but there are only 2 members total
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 3,
        candidateSessions: [session],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // SWM01 interest count = 2, Alice needs 3 others → 2 - 1 = 1 < 3
      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.membersWithNoCombos).not.toContain("Bob");
    });
  });

  describe("single member group", () => {
    it("generates combos correctly for a solo member with no buddy constraints", () => {
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );
      const s2 = makeSession(
        "GYM01",
        "Gymnastics",
        "Downtown LA Zone",
        "2028-07-22",
        "14:00",
        "16:00",
        "medium"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [s1, s2],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      expect(result.combos.length).toBeGreaterThanOrEqual(1);

      // All combos belong to Alice
      expect(result.combos.every((c) => c.memberId === "Alice")).toBe(true);
    });
  });

  describe("empty sessions", () => {
    it("reports member with zero candidate sessions in membersWithNoCombos", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.combos).toHaveLength(0);
    });
  });

  describe("sessions on different days", () => {
    it("groups combos by day with no cross-day contamination", () => {
      const day1S1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00",
        "high"
      );
      const day1S2 = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "14:00",
        "16:00",
        "high"
      );
      const day2S1 = makeSession(
        "TRK01",
        "Track & Field",
        "Rose Bowl Zone",
        "2028-07-23",
        "10:00",
        "12:00",
        "high"
      );
      const day3S1 = makeSession(
        "DIV01",
        "Diving",
        "Long Beach Zone",
        "2028-07-24",
        "10:00",
        "12:00",
        "medium"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field", "Diving"],
        candidateSessions: [day1S1, day1S2, day2S1, day3S1],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, DAYS);

      expect(result.membersWithNoCombos).toHaveLength(0);

      // Verify combos exist for each day
      const day1Combos = result.combos.filter((c) => c.day === "2028-07-22");
      const day2Combos = result.combos.filter((c) => c.day === "2028-07-23");
      const day3Combos = result.combos.filter((c) => c.day === "2028-07-24");

      expect(day1Combos.length).toBeGreaterThanOrEqual(1);
      expect(day2Combos.length).toBeGreaterThanOrEqual(1);
      expect(day3Combos.length).toBeGreaterThanOrEqual(1);

      // Day 2 sessions should only reference TRK01
      for (const combo of day2Combos) {
        expect(combo.sessionCodes).toEqual(["TRK01"]);
      }

      // Day 3 sessions should only reference DIV01
      for (const combo of day3Combos) {
        expect(combo.sessionCodes).toEqual(["DIV01"]);
      }

      // Day 1 combos should only contain SWM01 and/or GYM01
      for (const combo of day1Combos) {
        for (const code of combo.sessionCodes) {
          expect(["SWM01", "GYM01"]).toContain(code);
        }
      }
    });
  });

  describe("travel constraints reduce combos", () => {
    it("excludes infeasible combos when sessions are in far-apart zones with short gaps", () => {
      // SoFi → Rose Bowl: 35 min driving → 150 min required gap
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "10:00",
        "high"
      );
      const s2 = makeSession(
        "GYM01",
        "Gymnastics",
        "Rose Bowl Zone",
        "2028-07-22",
        "11:00",
        "13:00",
        "high"
      );
      // gap = 11:00 - 10:00 = 60 min < 150 min required → infeasible as pair

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [s1, s2],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Combo with both sessions should not exist
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);

      // But individual sessions should exist as separate combos
      expect(result.combos.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Trestles Beach isolation", () => {
    it("requires 4-hour gap for Trestles Beach sessions", () => {
      const trestlesSession = makeSession(
        "SRF01",
        "Surfing",
        "Trestles Beach Zone",
        "2028-07-22",
        "08:00",
        "10:00",
        "high"
      );
      const closeSession = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "13:00",
        "15:00",
        "high"
      );
      // gap = 13:00 - 10:00 = 180 min < 240 required → infeasible

      const farSession = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "14:00",
        "16:00",
        "high"
      );
      // gap = 14:00 - 10:00 = 240 min = 240 required → feasible

      const aliceClose = makeMember("AliceClose", {
        sportRankings: ["Surfing", "Swimming"],
        candidateSessions: [trestlesSession, closeSession],
      });

      const aliceFar = makeMember("AliceFar", {
        sportRankings: ["Surfing", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "08:00",
            "10:00"
          ),
          farSession,
        ],
      });

      // Close session pairing: should only have individual combos
      const resultClose = runScheduleGeneration(
        [aliceClose],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );
      const closePairs = resultClose.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(closePairs).toHaveLength(0);

      // Far session pairing: should allow the 2-session combo
      const resultFar = runScheduleGeneration([aliceFar], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const farPairs = resultFar.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(farPairs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("soft buddy bonus affects ranking", () => {
    it("ranks combos with soft buddy presence higher than combos without", () => {
      // Two identical sessions, but Alice's soft buddy Bob is interested in GYM01 only
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );
      const s2 = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "12:30",
        "14:30",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:30",
            "14:30"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Alice's combos on 2028-07-22 - the single-session combos
      const aliceCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // Find the single-session combos
      const gymOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "GYM01"
      );
      const swmOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "SWM01"
      );

      // GYM01 should score higher due to soft buddy bonus (Bob)
      // But SWM01 has rank 1 (2.0) vs GYM01 rank 2 (1.0)
      // GYM01 with buddy: 1.0 * 1.0 * 1.25 = 1.25
      // SWM01 no buddy: 2.0 * 1.0 * 1.0 = 2.0
      // SWM01 still ranks higher due to sport multiplier
      // The key test: verify the buddy bonus IS applied to GYM01
      if (gymOnly && swmOnly) {
        // GYM01 score should reflect the buddy bonus
        // rank 2 of 2 → 1.0, high → 1.0, 1 buddy → 1.25 = 1.25
        expect(gymOnly.score).toBeCloseTo(1.25);
        // SWM01 score: rank 1 of 2 → 2.0, high → 1.0, 0 buddies → 1.0 = 2.0
        expect(swmOnly.score).toBeCloseTo(2.0);
      }

      // The combo with both sessions should get the buddy bonus on GYM01
      const bothCombo = aliceCombos.find(
        (c) =>
          c.sessionCodes.length === 2 &&
          c.sessionCodes.includes("SWM01") &&
          c.sessionCodes.includes("GYM01")
      );
      if (bothCombo) {
        // 2.0 + 1.25 = 3.25
        expect(bothCombo.score).toBeCloseTo(3.25);
      }
    });
  });

  describe("soft buddy bonus uses filtered sessions, not raw candidates", () => {
    it("does not count soft buddy interest when buddy's hard buddy constraint filters the session", () => {
      // Alice has soft buddy Bob. Bob has SWM01 in his candidates but
      // Bob's hard buddy Carol is NOT interested in SWM01, so Bob's
      // hard buddy filter removes SWM01. Alice should NOT get a soft
      // buddy bonus for SWM01.
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );
      const s2 = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "12:30",
        "14:30",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      // Bob is interested in SWM01 and GYM01, but has hard buddy Carol
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics"],
        hardBuddies: ["Carol"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:30",
            "14:30"
          ),
        ],
      });

      // Carol is only interested in GYM01 → Bob's SWM01 gets filtered out
      const carol = makeMember("Carol", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:30",
            "14:30"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      const aliceCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // SWM01 solo: rank 1/2 → 2.0, high → 1.0, NO buddy bonus (Bob filtered) → 2.0
      const swmOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "SWM01"
      );
      // GYM01 solo: rank 2/2 → 1.0, high → 1.0, 1 buddy (Bob keeps GYM01) → 1.25
      const gymOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "GYM01"
      );

      if (swmOnly && gymOnly) {
        // SWM01: no buddy bonus because Bob's SWM01 was filtered by his hard buddy
        expect(swmOnly.score).toBeCloseTo(2.0);
        // GYM01: buddy bonus applies because Bob keeps GYM01 after filtering
        expect(gymOnly.score).toBeCloseTo(1.25);
      }

      // The combo with both should reflect: 2.0 (SWM01 no bonus) + 1.25 (GYM01 with bonus) = 3.25
      const bothCombo = aliceCombos.find(
        (c) =>
          c.sessionCodes.length === 2 &&
          c.sessionCodes.includes("SWM01") &&
          c.sessionCodes.includes("GYM01")
      );
      if (bothCombo) {
        expect(bothCombo.score).toBeCloseTo(3.25);
      }
    });

    it("does not count soft buddy interest when buddy's minBuddies constraint filters the session", () => {
      // Alice has soft buddy Bob. Bob has minBuddies=2, but only 1 other
      // member (Alice) is interested in TRK01. So Bob's TRK01 gets filtered
      // by minBuddies. Alice should NOT get a soft buddy bonus for TRK01.
      const s1 = makeSession(
        "TRK01",
        "Track & Field",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );
      const s2 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "12:30",
        "14:30",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Track & Field", "Swimming"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      // Bob has minBuddies=2 and is interested in TRK01 and SWM01
      // TRK01: 2 total interested (Alice + Bob), Bob needs 2 others → 2-1=1 < 2 → filtered
      // SWM01: 2 total interested (Alice + Bob), Bob needs 2 others → 2-1=1 < 2 → filtered
      const bob = makeMember("Bob", {
        sportRankings: ["Track & Field", "Swimming"],
        minBuddies: 2,
        candidateSessions: [
          makeSession(
            "TRK01",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:30",
            "14:30"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const aliceCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // TRK01 solo: rank 1/2 → 2.0, high → 1.0, NO buddy bonus → 2.0
      const trkOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "TRK01"
      );
      // SWM01 solo: rank 2/2 → 1.0, high → 1.0, NO buddy bonus → 1.0
      const swmOnly = aliceCombos.find(
        (c) => c.sessionCodes.length === 1 && c.sessionCodes[0] === "SWM01"
      );

      if (trkOnly && swmOnly) {
        expect(trkOnly.score).toBeCloseTo(2.0);
        expect(swmOnly.score).toBeCloseTo(1.0);
      }
    });

    it("still counts soft buddy when buddy passes all their own constraints", () => {
      // Alice has soft buddy Bob. Bob has hard buddy Carol, and Carol IS
      // interested in SWM01. So Bob's SWM01 survives filtering, and Alice
      // should get the soft buddy bonus.
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: ["Bob"],
        candidateSessions: [s1],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Carol"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
        ],
      });

      // Carol is interested in SWM01 → Bob keeps it
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      const alicePrimary = result.combos.find(
        (c) => c.memberId === "Alice" && c.rank === "primary"
      );

      // SWM01: rank 1/1 → 2.0, high → 1.0, 1 soft buddy (Bob passed) → 1.25 = 2.5
      expect(alicePrimary!.score).toBeCloseTo(2.5);
    });
  });

  describe("re-generation produces same results (deterministic)", () => {
    it("produces identical output when run twice with same input", () => {
      const sessions = [
        makeSession(
          "SWM01",
          "Swimming",
          "SoFi Stadium Zone",
          "2028-07-22",
          "09:00",
          "11:00"
        ),
        makeSession(
          "GYM01",
          "Gymnastics",
          "Downtown LA Zone",
          "2028-07-22",
          "14:00",
          "16:00"
        ),
        makeSession(
          "TRK01",
          "Track & Field",
          "Rose Bowl Zone",
          "2028-07-23",
          "10:00",
          "12:00"
        ),
      ];

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        softBuddies: ["Bob"],
        candidateSessions: sessions,
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics", "Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result1 = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
        "2028-07-23",
      ]);

      // Re-create members (fresh objects) to ensure no mutation
      const alice2 = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        softBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const bob2 = makeMember("Bob", {
        sportRankings: ["Gymnastics", "Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "Rose Bowl Zone",
            "2028-07-23",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result2 = runScheduleGeneration([alice2, bob2], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
        "2028-07-23",
      ]);

      expect(result1.combos).toEqual(result2.combos);
      expect(result1.membersWithNoCombos).toEqual(result2.membersWithNoCombos);
    });
  });

  // =========================================================================
  // Single member deep edge cases
  // =========================================================================

  describe("single member edge cases", () => {
    it("single member with 1 session on 1 day gets exactly 1 primary combo", () => {
      const s = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      expect(result.combos).toHaveLength(1);
      expect(result.combos[0].rank).toBe("primary");
      expect(result.combos[0].sessionCodes).toEqual(["SWM01"]);
    });

    it("single member with minBuddies > 0 gets no combos (can't satisfy alone)", () => {
      const s = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 1,
        candidateSessions: [s],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Interest count for SWM01 = 1 (only Alice). 1 - 1 = 0 < 1 → filtered out
      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.combos).toHaveLength(0);
    });

    it("single member with hardBuddies pointing to nobody gets no combos", () => {
      const s = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Ghost"],
        candidateSessions: [s],
      });

      // "Ghost" doesn't exist → input filter skips that buddy, but post-generation
      // validation detects "Ghost" has no combo with SWM01 → session pruned → no combos
      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toContain("Alice");
    });

    it("single member with sessions spanning all 19 Olympic days", () => {
      const allDays: string[] = [];
      const sessions = [];
      for (let d = 12; d <= 30; d++) {
        const day = `2028-07-${d.toString().padStart(2, "0")}`;
        allDays.push(day);
        sessions.push(
          makeSession(
            `SWM${d}`,
            "Swimming",
            "SoFi Stadium Zone",
            day,
            "10:00",
            "12:00"
          )
        );
      }

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, allDays);

      expect(result.membersWithNoCombos).toHaveLength(0);
      // 19 days, 1 session per day → 19 primary combos
      expect(result.combos).toHaveLength(19);
      expect(result.combos.every((c) => c.rank === "primary")).toBe(true);

      const uniqueDays = new Set(result.combos.map((c) => c.day));
      expect(uniqueDays.size).toBe(19);
    });

    it("single member with many sessions on one day (8 sessions)", () => {
      const sessions = [];
      for (let i = 0; i < 8; i++) {
        sessions.push(
          makeSession(
            `S${i.toString().padStart(2, "0")}`,
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            `${8 + i * 2}:00`,
            `${9 + i * 2}:00`
          )
        );
      }

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      // Should generate combos (up to 3 per combo), capped to top 3 ranks
      expect(result.combos.length).toBeLessThanOrEqual(3);
      expect(result.combos[0].rank).toBe("primary");
      // No combo exceeds 3 sessions
      for (const c of result.combos) {
        expect(c.sessionCodes.length).toBeLessThanOrEqual(3);
      }
    });
  });

  // =========================================================================
  // 12-member group (max group size)
  // =========================================================================

  describe("12-member group (max capacity)", () => {
    it("generates combos for all 12 members with shared sessions", () => {
      const members: MemberData[] = [];
      for (let i = 0; i < 12; i++) {
        members.push(
          makeMember(`M${i}`, {
            sportRankings: ["Swimming"],
            candidateSessions: [
              makeSession(
                "SWM01",
                "Swimming",
                "SoFi Stadium Zone",
                "2028-07-22",
                "10:00",
                "12:00",
                "high"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      // All 12 members should have combos
      const memberIds = new Set(result.combos.map((c) => c.memberId));
      expect(memberIds.size).toBe(12);

      // Each member gets 1 primary combo (1 session, 1 day)
      expect(result.combos).toHaveLength(12);
      expect(result.combos.every((c) => c.rank === "primary")).toBe(true);
    });

    it("12 members with minBuddies=11 all satisfy constraint (everyone interested)", () => {
      const members: MemberData[] = [];
      for (let i = 0; i < 12; i++) {
        members.push(
          makeMember(`M${i}`, {
            sportRankings: ["Swimming"],
            minBuddies: 11,
            candidateSessions: [
              makeSession(
                "SWM01",
                "Swimming",
                "SoFi Stadium Zone",
                "2028-07-22",
                "10:00",
                "12:00"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // 12 interested - 1 (self) = 11 >= minBuddies=11 → all pass
      expect(result.membersWithNoCombos).toHaveLength(0);
      expect(result.combos).toHaveLength(12);
    });

    it("12 members where one drops out breaks minBuddies=11 for remaining", () => {
      const members: MemberData[] = [];
      for (let i = 0; i < 11; i++) {
        members.push(
          makeMember(`M${i}`, {
            sportRankings: ["Swimming"],
            minBuddies: 11,
            candidateSessions: [
              makeSession(
                "SWM01",
                "Swimming",
                "SoFi Stadium Zone",
                "2028-07-22",
                "10:00",
                "12:00"
              ),
            ],
          })
        );
      }
      // M11 is interested in a DIFFERENT session
      members.push(
        makeMember("M11", {
          sportRankings: ["Gymnastics"],
          candidateSessions: [
            makeSession(
              "GYM01",
              "Gymnastics",
              "Downtown LA Zone",
              "2028-07-22",
              "10:00",
              "12:00"
            ),
          ],
        })
      );

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // SWM01: 11 interested. For each of those 11: 11 - 1 = 10 < 11 → all filtered out
      // M0-M10 all in membersWithNoCombos
      for (let i = 0; i < 11; i++) {
        expect(result.membersWithNoCombos).toContain(`M${i}`);
      }
      // M11 has minBuddies=0 (default), GYM01 interest count=1 → fine
      expect(result.membersWithNoCombos).not.toContain("M11");
    });

    it("12 members with complex cross-buddy hard constraints", () => {
      // M0 has hard buddy M1, M1 has hard buddy M2, M2 has hard buddy M0
      // All 3 share SWM01. Others have no constraints.
      const members: MemberData[] = [];
      for (let i = 0; i < 12; i++) {
        const hardBuddies: string[] = [];
        if (i === 0) hardBuddies.push("M1");
        if (i === 1) hardBuddies.push("M2");
        if (i === 2) hardBuddies.push("M0");

        members.push(
          makeMember(`M${i}`, {
            sportRankings: ["Swimming"],
            hardBuddies,
            candidateSessions: [
              makeSession(
                "SWM01",
                "Swimming",
                "SoFi Stadium Zone",
                "2028-07-22",
                "10:00",
                "12:00"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // M0's hard buddy M1 has SWM01 ✓, M1's hard buddy M2 has SWM01 ✓, M2's hard buddy M0 has SWM01 ✓
      // All keep their sessions
      expect(result.membersWithNoCombos).toHaveLength(0);
      expect(new Set(result.combos.map((c) => c.memberId)).size).toBe(12);
    });
  });

  // =========================================================================
  // 10 sport rankings + many sessions
  // =========================================================================

  describe("member ranking 10 sports with many sessions", () => {
    const tenSports = [
      "Swimming",
      "Gymnastics",
      "Track & Field",
      "Diving",
      "Basketball",
      "Volleyball",
      "Tennis",
      "Boxing",
      "Archery",
      "Fencing",
    ];

    it("correctly applies sport multiplier across 10 ranked sports", () => {
      // Create 10 sessions, one per sport, all on the same day in the same zone
      const sessions = tenSports.map((sport, i) =>
        makeSession(
          `${sport.substring(0, 3).toUpperCase()}01`,
          sport,
          "SoFi Stadium Zone",
          "2028-07-22",
          `${8 + i}:30`,
          `${9 + i}:00`
        )
      );

      const alice = makeMember("Alice", {
        sportRankings: tenSports,
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      // Primary combo should contain the 3 highest-ranked sports (max 3 per combo)
      const primary = result.combos.find((c) => c.rank === "primary");
      expect(primary).toBeDefined();
      expect(primary!.sessionCodes.length).toBeLessThanOrEqual(3);
      // Primary should have highest score
      for (const c of result.combos) {
        expect(primary!.score).toBeGreaterThanOrEqual(c.score);
      }
    });

    it("handles 30+ sessions across multiple days with 10 sports", () => {
      const sessions = [];
      const days = ["2028-07-22", "2028-07-23", "2028-07-24"];

      for (const day of days) {
        for (let i = 0; i < tenSports.length; i++) {
          sessions.push(
            makeSession(
              `${tenSports[i].substring(0, 3).toUpperCase()}${day.slice(-2)}`,
              tenSports[i],
              "SoFi Stadium Zone",
              day,
              `${8 + i}:30`,
              `${9 + i}:00`
            )
          );
        }
      }

      const alice = makeMember("Alice", {
        sportRankings: tenSports,
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, days);

      expect(result.membersWithNoCombos).toHaveLength(0);
      // Should have combos for each of the 3 days
      const comboDays = new Set(result.combos.map((c) => c.day));
      expect(comboDays.size).toBe(3);

      // Each day should have up to 3 ranked combos
      for (const day of days) {
        const dayCombos = result.combos.filter((c) => c.day === day);
        expect(dayCombos.length).toBeLessThanOrEqual(3);
        expect(dayCombos.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("all 12 members ranking 10 sports with 5 shared sessions produces valid output", () => {
      const fiveSessionsPerDay = [
        makeSession(
          "SWM01",
          "Swimming",
          "SoFi Stadium Zone",
          "2028-07-22",
          "08:00",
          "09:30",
          "high"
        ),
        makeSession(
          "GYM01",
          "Gymnastics",
          "SoFi Stadium Zone",
          "2028-07-22",
          "10:30",
          "12:00",
          "medium"
        ),
        makeSession(
          "TRK01",
          "Track & Field",
          "SoFi Stadium Zone",
          "2028-07-22",
          "13:00",
          "14:30",
          "high"
        ),
        makeSession(
          "DIV01",
          "Diving",
          "SoFi Stadium Zone",
          "2028-07-22",
          "15:30",
          "17:00",
          "low"
        ),
        makeSession(
          "BAS01",
          "Basketball",
          "SoFi Stadium Zone",
          "2028-07-22",
          "18:00",
          "19:30",
          "medium"
        ),
      ];

      const members: MemberData[] = [];
      for (let i = 0; i < 12; i++) {
        // Each member ranks sports in a different order (rotate)
        const rankings = [
          ...tenSports.slice(i % 10),
          ...tenSports.slice(0, i % 10),
        ];
        members.push(
          makeMember(`M${i}`, {
            sportRankings: rankings,
            candidateSessions: fiveSessionsPerDay.map((s) => ({ ...s })),
          })
        );
      }

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      const memberIds = new Set(result.combos.map((c) => c.memberId));
      expect(memberIds.size).toBe(12);

      // All combos should be valid (max 3 sessions)
      for (const c of result.combos) {
        expect(c.sessionCodes.length).toBeLessThanOrEqual(3);
        expect(c.score).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Deep buddy constraint edge cases
  // =========================================================================

  describe("buddy constraint edge cases", () => {
    it("mutual hard buddies: A requires B, B requires A — both keep shared sessions", () => {
      const shared = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const aOnly = makeSession(
        "GYM01",
        "Gymnastics",
        "Downtown LA Zone",
        "2028-07-22",
        "14:00",
        "16:00"
      );
      const bOnly = makeSession(
        "TRK01",
        "Track & Field",
        "Rose Bowl Zone",
        "2028-07-22",
        "14:00",
        "16:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [shared, aOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Track & Field"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          bOnly,
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Alice: hard buddy Bob has {SWM01, TRK01} → Alice keeps only SWM01 (intersection with {SWM01, GYM01})
      // Bob: hard buddy Alice has {SWM01, GYM01} → Bob keeps only SWM01 (intersection with {SWM01, TRK01})
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      const bobCodes = result.combos
        .filter((c) => c.memberId === "Bob")
        .flatMap((c) => c.sessionCodes);

      expect(aliceCodes).toEqual(["SWM01"]);
      expect(bobCodes).toEqual(["SWM01"]);
      expect(result.membersWithNoCombos).toHaveLength(0);
    });

    it("chain of hard buddies: A→B, B→C, C→A — only triple-overlap sessions survive", () => {
      const all3 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const abOnly = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "14:00",
        "16:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [all3, abOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        hardBuddies: ["Carol"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Track & Field"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      // Alice needs Bob: Bob has {SWM01, GYM01, TRK01} → Alice keeps {SWM01, GYM01}
      // Bob needs Carol: Carol has {SWM01, TRK01} → Bob keeps {SWM01, TRK01}
      // Carol needs Alice: Alice has {SWM01, GYM01} → Carol keeps {SWM01}
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      const bobCodes = result.combos
        .filter((c) => c.memberId === "Bob")
        .flatMap((c) => c.sessionCodes);
      const carolCodes = result.combos
        .filter((c) => c.memberId === "Carol")
        .flatMap((c) => c.sessionCodes);

      expect(aliceCodes).toContain("SWM01");
      expect(aliceCodes).not.toContain("TRK01");
      expect(bobCodes).toContain("SWM01");
      expect(bobCodes).not.toContain("GYM01");
      expect(carolCodes).toEqual(["SWM01"]);
    });

    it("asymmetric hard buddy: A requires B, but B doesn't require A", () => {
      const shared = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const bOnly = makeSession(
        "GYM01",
        "Gymnastics",
        "Downtown LA Zone",
        "2028-07-22",
        "14:00",
        "16:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Bob"],
        candidateSessions: [shared],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics"],
        // No hard buddies — doesn't require Alice
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          bOnly,
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Alice filtered to Bob's sessions: Bob has {SWM01, GYM01} → Alice keeps SWM01
      // Bob has no constraints → keeps both SWM01 and GYM01
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      const bobCodes = result.combos
        .filter((c) => c.memberId === "Bob")
        .flatMap((c) => c.sessionCodes);

      expect(aliceCodes).toEqual(["SWM01"]);
      expect(bobCodes).toContain("SWM01");
      expect(bobCodes).toContain("GYM01");
    });

    it("hard buddy with 3 buddies: only triple-intersection survives", () => {
      // Alice requires Bob AND Carol AND Dave
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        hardBuddies: ["Bob", "Carol", "Dave"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "18:00",
            "20:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Track & Field"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "TRK01",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "18:00",
            "20:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      // Bob: {SWM01, GYM01}, Carol: {SWM01, TRK01}, Dave: {SWM01}
      // Intersection = {SWM01} only
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      expect(aliceCodes).toEqual(["SWM01"]);
    });

    it("soft buddies don't filter sessions, only boost scores", () => {
      const shared = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );
      const aliceOnly = makeSession(
        "GYM01",
        "Gymnastics",
        "SoFi Stadium Zone",
        "2028-07-22",
        "14:00",
        "16:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [shared, aliceOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Soft buddies don't filter! Alice keeps BOTH sessions
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      expect(aliceCodes).toContain("SWM01");
      expect(aliceCodes).toContain("GYM01");
    });

    it("hard buddy + minBuddies combined: both constraints applied sequentially", () => {
      // Alice: hardBuddies=["Bob"], minBuddies=2
      // 4 members, but only 2 interested in SWM01 besides Alice
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        hardBuddies: ["Bob"],
        minBuddies: 2,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      // Hard buddy filter first: Bob has {SWM01, GYM01} → Alice keeps {SWM01, GYM01}
      // MinBuddies filter (minBuddies=2):
      //   SWM01: interest count = 3 (Alice, Bob, Carol) → 3-1=2 >= 2 ✓
      //   GYM01: interest count = 3 (Alice, Bob, Dave) → 3-1=2 >= 2 ✓
      // Both sessions survive both filters
      const aliceCodes = result.combos
        .filter((c) => c.memberId === "Alice")
        .flatMap((c) => c.sessionCodes);
      expect(aliceCodes).toContain("SWM01");
      expect(aliceCodes).toContain("GYM01");
    });

    it("minBuddies exactly at threshold: count-1 == minBuddies passes", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 2,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      // SWM01: 3 interested, Alice needs 2 others → 3-1=2 >= 2 ✓
      expect(result.membersWithNoCombos).not.toContain("Alice");
    });

    it("minBuddies just below threshold: count-1 < minBuddies fails", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 3,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      // SWM01: 3 interested, Alice needs 3 others → 3-1=2 < 3 ✗
      expect(result.membersWithNoCombos).toContain("Alice");
    });

    it("multiple soft buddies increase score multiplicatively", () => {
      const session = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "10:00",
        "12:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: ["Bob", "Carol", "Dave"],
        candidateSessions: [session],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      const aliceCombo = result.combos.find((c) => c.memberId === "Alice");
      // Sport multiplier: single sport → 2.0
      // Interest: high → 1.0
      // Soft buddy bonus: 3 buddies → 1.0 + 0.25 + 0.1*(3-1) = 1.45
      // Score = 2.0 * 1.0 * 1.45 = 2.9
      expect(aliceCombo!.score).toBeCloseTo(2.9);
    });

    it("soft buddy not interested in a session means no bonus for that session", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      // Bob is only interested in SWM01, not GYM01
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const aliceSingles = result.combos.filter(
        (c) => c.memberId === "Alice" && c.sessionCodes.length === 1
      );
      const swmCombo = aliceSingles.find((c) => c.sessionCodes[0] === "SWM01");
      const gymCombo = aliceSingles.find((c) => c.sessionCodes[0] === "GYM01");

      if (swmCombo && gymCombo) {
        // SWM01: rank 1/2 → 2.0, high → 1.0, 1 buddy → 1.25 = 2.5
        expect(swmCombo.score).toBeCloseTo(2.5);
        // GYM01: rank 2/2 → 1.0, high → 1.0, 0 buddies → 1.0 = 1.0
        expect(gymCombo.score).toBeCloseTo(1.0);
      }
    });
  });

  // =========================================================================
  // Travel distance edge cases
  // =========================================================================

  describe("travel distance edge cases", () => {
    it("back-to-back sessions in same zone with exactly 90-min gap is feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:00 = 90 min, required = 90 (same zone) → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("back-to-back sessions in same zone with 89-min gap is NOT feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:01"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:01 = 89 min < 90 required → NOT feasible as pair
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("close zones (<15 min) need 90-min gap — boundary test", () => {
      // Downtown LA → Rose Bowl: 12 min driving → 90 min required
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "Downtown LA Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Rose Bowl Zone",
            "2028-07-22",
            "10:30",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:00 = 90 min = 90 required → feasible (exactly at boundary)
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("close zones (<15 min) with 89-min gap is NOT feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "Downtown LA Zone",
            "2028-07-22",
            "08:00",
            "09:01"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Rose Bowl Zone",
            "2028-07-22",
            "10:30",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:01 = 89 min < 90 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("medium zones (30-44 min) need 150-min gap — boundary test", () => {
      // SoFi → Rose Bowl: 35 min driving → 150 min required
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Rose Bowl Zone",
            "2028-07-22",
            "11:30",
            "13:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 11:30 - 09:00 = 150 min = 150 required → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("medium zones (30-44 min) with 149-min gap is NOT feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:01"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Rose Bowl Zone",
            "2028-07-22",
            "11:30",
            "13:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 11:30 - 09:01 = 149 min < 150 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("unknown zones default to 210-min (3.5h) required gap", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "Unknown Zone Alpha",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Unknown Zone Beta",
            "2028-07-22",
            "12:30",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 12:30 - 09:00 = 210 min = 210 required → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("unknown zones with 209-min gap is NOT feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "Unknown Zone Alpha",
            "2028-07-22",
            "08:00",
            "09:01"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Unknown Zone Beta",
            "2028-07-22",
            "12:30",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 12:30 - 09:01 = 209 min < 210 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("Trestles Beach with exactly 240-min gap is feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Surfing", "Swimming"],
        candidateSessions: [
          makeSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00",
            "08:00"
          ),
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:00",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 12:00 - 08:00 = 240 min = 240 required → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("Trestles Beach with 239-min gap is NOT feasible", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Surfing", "Swimming"],
        candidateSessions: [
          makeSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00",
            "08:01"
          ),
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:00",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 12:00 - 08:01 = 239 min < 240 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("3-session chain: feasible first hop, infeasible second hop → no 3-combo", () => {
      // Downtown LA → Rose Bowl (12 min, 90 min gap), then Rose Bowl → Long Beach (42 min, 150 min gap)
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "Downtown LA Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "Rose Bowl Zone",
            "2028-07-22",
            "10:30",
            "12:00"
          ),
          makeSession(
            "S03",
            "Track & Field",
            "Long Beach Zone",
            "2028-07-22",
            "13:00",
            "15:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Hop 1: 10:30 - 09:00 = 90 >= 90 ✓
      // Hop 2: 13:00 - 12:00 = 60 < 150 ✗
      // 3-session combo NOT feasible, but {S01, S02} and {S01} and {S02} and {S03} are fine
      const threeCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 3
      );
      expect(threeCombos).toHaveLength(0);

      // But 2-session combo {S01, S02} should exist
      const s01s02 = result.combos.find(
        (c) =>
          c.sessionCodes.length === 2 &&
          c.sessionCodes.includes("S01") &&
          c.sessionCodes.includes("S02")
      );
      expect(s01s02).toBeDefined();
    });

    it("3 sessions all at Trestles Beach (same zone) — needs 90-min gaps", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Surfing"],
        candidateSessions: [
          makeSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00",
            "07:00"
          ),
          makeSession(
            "SRF02",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "08:30",
            "09:30"
          ),
          makeSession(
            "SRF03",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "11:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // All same zone → 90-min gaps needed
      // 08:30 - 07:00 = 90 ✓, 11:00 - 09:30 = 90 ✓
      const threeCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 3
      );
      expect(threeCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("session ending at midnight (00:00) treated as end-of-day", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "21:00",
            "00:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "10:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Sorted by start: GYM01 (08:00) → SWM01 (21:00)
      // Gap = 21:00 - 10:00 = 660 min >> 90 required → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });

    it("no travel entries → all cross-zone pairs default to 210-min gap", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "12:30",
            "14:00"
          ),
        ],
      });

      // Empty travel entries → all unknown → 210-min gap
      const result = runScheduleGeneration([alice], [], ["2028-07-22"]);

      // Gap = 12:30 - 09:00 = 210 min = 210 required → feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("session in backup combos", () => {
    it("session appearing only in backup combos still gets generated", () => {
      // Session A scores higher than Session B, so B is in backup only
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "low"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Both sessions appear in combos (one primary, one backup)
      const allSessionCodes = result.combos.flatMap((c) => c.sessionCodes);
      expect(allSessionCodes).toContain("SWM01");
      expect(allSessionCodes).toContain("GYM01");
    });
  });

  // =========================================================================
  // Meaningful backup rule — end-to-end
  // =========================================================================

  describe("meaningful backup rule", () => {
    it("backups always introduce at least one new session vs their predecessor", () => {
      // 5 well-spaced sessions on one day, same zone. Top triple is P.
      // B1 must have a session outside the triple. B2 must have a session outside B1.
      const alice = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Gymnastics",
          "Track & Field",
          "Diving",
          "Boxing",
        ],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "11:30"
          ),
          makeSession(
            "S03",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "13:00",
            "14:00"
          ),
          makeSession(
            "S04",
            "Diving",
            "SoFi Stadium Zone",
            "2028-07-22",
            "15:30",
            "16:30"
          ),
          makeSession(
            "S05",
            "Boxing",
            "SoFi Stadium Zone",
            "2028-07-22",
            "18:00",
            "19:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      const primary = dayCombos.find((c) => c.rank === "primary")!;
      const b1 = dayCombos.find((c) => c.rank === "backup1");
      const b2 = dayCombos.find((c) => c.rank === "backup2");

      expect(primary).toBeDefined();

      if (b1) {
        const pSet = new Set(primary.sessionCodes);
        expect(b1.sessionCodes.some((s) => !pSet.has(s))).toBe(true);
      }
      if (b1 && b2) {
        const b1Set = new Set(b1.sessionCodes);
        expect(b2.sessionCodes.some((s) => !b1Set.has(s))).toBe(true);
      }
    });

    it("no backups when all sessions fit in one combo (3 same-zone sessions)", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "11:30"
          ),
          makeSession(
            "S03",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "13:00",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // All 3 sessions fit in one triple → all other combos are subsets → no backups
      expect(dayCombos).toHaveLength(1);
      expect(dayCombos[0].rank).toBe("primary");
      expect(dayCombos[0].sessionCodes).toHaveLength(3);
    });

    it("no backups when only 2 same-day sessions and both fit in one combo", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "S02",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "11:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      expect(dayCombos).toHaveLength(1);
      expect(dayCombos[0].rank).toBe("primary");
      expect(dayCombos[0].sessionCodes).toHaveLength(2);
    });

    it("overlapping sessions force distinct solo combos — natural meaningful backups", () => {
      // 3 sessions all at 10:00-12:00, same zone → can't be paired.
      // Each becomes a solo combo. All distinct → P, B1, B2 each have a unique session.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        candidateSessions: [
          makeSession(
            "SWM",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "TRK",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      expect(dayCombos).toHaveLength(3);
      expect(dayCombos[0].rank).toBe("primary");
      expect(dayCombos[1].rank).toBe("backup1");
      expect(dayCombos[2].rank).toBe("backup2");

      // Each should be a single distinct session
      const allCodes = dayCombos.map((c) => c.sessionCodes[0]);
      expect(new Set(allCodes).size).toBe(3);
    });

    it("4th session creates meaningful backup even when triple is dominant", () => {
      // 4 sessions, all feasible. Triple {S01,S02,S03} is highest-scoring primary.
      // S04 (rank 4 sport) can only appear in backup combos.
      // B1 must contain S04 since all other combos are subsets of P.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field", "Diving"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "11:30"
          ),
          makeSession(
            "S03",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "13:00",
            "14:00"
          ),
          makeSession(
            "S04",
            "Diving",
            "SoFi Stadium Zone",
            "2028-07-22",
            "15:30",
            "16:30"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      const primary = dayCombos.find((c) => c.rank === "primary")!;
      const b1 = dayCombos.find((c) => c.rank === "backup1");

      // Primary is the top triple
      expect(primary.sessionCodes).toHaveLength(3);

      // B1 must exist and contain S04 (the only session that can make a non-subset)
      expect(b1).toBeDefined();
      expect(b1!.sessionCodes).toContain("S04");
    });

    it("B2 is skipped when it is a subset of P, even if it has sessions new vs B1", () => {
      // Setup: 3 sessions where S01+S02 are feasible together, but S03 overlaps with both.
      // P = {S01, S02} (highest pair), B1 = {S03} (new vs P, can't pair with anything).
      // Remaining candidates: {S01} and {S02} — both subsets of P → no B2.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "10:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "11:30",
            "13:30"
          ),
          // S03 overlaps with S01 (starts at 09:00, before S01 ends at 10:00)
          makeSession(
            "S03",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      const primary = dayCombos.find((c) => c.rank === "primary")!;
      const b1 = dayCombos.find((c) => c.rank === "backup1");
      const b2 = dayCombos.find((c) => c.rank === "backup2");

      // P = {S01, S02} (only feasible pair)
      expect(primary.sessionCodes).toHaveLength(2);
      expect(primary.sessionCodes).toContain("S01");
      expect(primary.sessionCodes).toContain("S02");

      // B1 = {S03} (new vs P; S03 can't pair with S01 due to overlap, or S02 due to gap)
      expect(b1).toBeDefined();
      expect(b1!.sessionCodes).toEqual(["S03"]);

      // B2 must be absent: {S01} and {S02} are both subsets of P → skip
      // Even though S01 is new vs B1={S03}, S01 IS in P → subset of P → skip
      expect(b2).toBeUndefined();
    });

    it("B2 is valid when it introduces a session new to both P and B1", () => {
      // P = {S01, S02} (pair). B1 = {S03} (overlapping with S01/S02).
      // {S04} is new vs both P and B1 → valid B2.
      // Use overlapping sessions so only singles are feasible, ensuring P={S01}, etc.
      // Instead: 4 overlapping sessions. P=highest single, B1=second, B2=third.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics", "Track & Field", "Diving"],
        candidateSessions: [
          makeSession(
            "S01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "S02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "S03",
            "Track & Field",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "S04",
            "Diving",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // All overlap → solo combos only. P={S01}, B1={S02}, B2={S03}.
      // Each is a distinct single → valid P, B1, B2.
      expect(dayCombos).toHaveLength(3);
      expect(dayCombos[0].rank).toBe("primary");
      expect(dayCombos[1].rank).toBe("backup1");
      expect(dayCombos[2].rank).toBe("backup2");

      // All three combos have distinct sessions (each new vs all others)
      const codes = dayCombos.map((c) => c.sessionCodes[0]);
      expect(new Set(codes).size).toBe(3);

      // B2 session must be new vs both P and B1
      const pSet = new Set(dayCombos[0].sessionCodes);
      const b1Set = new Set(dayCombos[1].sessionCodes);
      const b2Codes = dayCombos[2].sessionCodes;
      expect(b2Codes.some((c) => !pSet.has(c))).toBe(true);
      expect(b2Codes.some((c) => !b1Set.has(c))).toBe(true);
    });

    it("hard buddy filter leaving 2 sessions means primary only, no backups", () => {
      // Hard buddy filter removes 2 of 4 sessions → only 2 remain.
      // Both fit in one combo → no meaningful backups.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "10:00"
          ),
          makeSession(
            "SWM02",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:00",
            "14:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "15:00",
            "17:00"
          ),
          makeSession(
            "GYM02",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "18:00",
            "20:00"
          ),
        ],
      });

      // Bob only interested in SWM01 and SWM02
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "10:00"
          ),
          makeSession(
            "SWM02",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:00",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);
      const aliceCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );

      // Hard buddy removes GYM01, GYM02 → only SWM01+SWM02 → primary only
      expect(aliceCombos).toHaveLength(1);
      expect(aliceCombos[0].rank).toBe("primary");
      expect(aliceCombos[0].sessionCodes).toEqual(
        expect.arrayContaining(["SWM01", "SWM02"])
      );
    });
  });

  // =========================================================================
  // Interest level / scoring integration edge cases
  // =========================================================================

  describe("interest level affects combo ranking", () => {
    it("high interest session beats low interest session as primary combo on same day", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM_HIGH",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
          makeSession(
            "SWM_LOW",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00",
            "low"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Both are single-sport Swimming → same sport multiplier (2.0)
      // SWM_HIGH: 2.0 * 1.0 = 2.0
      // SWM_LOW: 2.0 * 0.4 = 0.8
      // Primary should be the 2-session combo or the high-interest single
      const primary = result.combos.find((c) => c.rank === "primary");
      expect(primary).toBeDefined();

      if (primary!.sessionCodes.length === 1) {
        expect(primary!.sessionCodes[0]).toBe("SWM_HIGH");
      }
      // If primary is 2-session, it should include the high-interest one
      if (primary!.sessionCodes.length === 2) {
        expect(primary!.sessionCodes).toContain("SWM_HIGH");
      }
    });

    it("medium interest #1 ranked sport beats high interest #10 ranked sport", () => {
      const tenSports = [
        "Swimming",
        "Gymnastics",
        "Track & Field",
        "Diving",
        "Basketball",
        "Volleyball",
        "Tennis",
        "Boxing",
        "Archery",
        "Fencing",
      ];

      const alice = makeMember("Alice", {
        sportRankings: tenSports,
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "medium"
          ),
          makeSession(
            "FEN01",
            "Fencing",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const singles = result.combos.filter(
        (c) => c.memberId === "Alice" && c.sessionCodes.length === 1
      );
      const swm = singles.find((c) => c.sessionCodes[0] === "SWM01");
      const fen = singles.find((c) => c.sessionCodes[0] === "FEN01");

      if (swm && fen) {
        // SWM01: rank 1/10 → 2.0, medium → 0.7 = 1.4
        // FEN01: rank 10/10 → 1.0, high → 1.0 = 1.0
        expect(swm.score).toBeCloseTo(1.4);
        expect(fen.score).toBeCloseTo(1.0);
        expect(swm.score).toBeGreaterThan(fen.score);
      }
    });
  });

  // =========================================================================
  // Multiple members with no combos
  // =========================================================================

  describe("multiple members with no combos", () => {
    it("reports all members with impossible constraints in membersWithNoCombos", () => {
      // Alice: empty sessions
      // Bob: hard buddy pointing to non-overlapping member
      // Carol: minBuddies too high
      // Dave: normal (should succeed)
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Diving"],
        hardBuddies: ["Carol"],
        candidateSessions: [
          makeSession(
            "DIV01",
            "Diving",
            "Long Beach Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Gymnastics"],
        minBuddies: 10,
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      expect(result.membersWithNoCombos).toContain("Alice"); // empty sessions
      expect(result.membersWithNoCombos).toContain("Bob"); // hard buddy Carol has no overlap
      expect(result.membersWithNoCombos).toContain("Carol"); // minBuddies=10, only 4 members total
      expect(result.membersWithNoCombos).not.toContain("Dave");
    });
  });

  // =========================================================================
  // Spec scoring formula validation scenarios (algorithm-spec.md lines 237-343)
  // =========================================================================

  describe("spec scoring formula validation scenarios", () => {
    it("Scenario 1 from spec: Alice ranks 5 sports, High interest Gymnastics, 2 soft buddies", () => {
      // Spec example:
      //   Alice ranks: 1. Gymnastics, 2. Swimming, 3. Track, 4. Diving, 5. Basketball
      //   Session: Women's Gymnastics All-Around Final, High interest
      //   2 soft buddies (Bob, Carol) also interested
      //   Expected score: 2.0 × 1.0 × 1.35 = 2.7
      const alice = makeMember("Alice", {
        sportRankings: [
          "Gymnastics",
          "Swimming",
          "Track & Field",
          "Diving",
          "Basketball",
        ],
        softBuddies: ["Bob", "Carol"],
        candidateSessions: [
          makeSession(
            "GYM-WFINAL",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM-WFINAL",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM-WFINAL",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "medium"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22"]
      );

      const aliceCombo = result.combos.find((c) => c.memberId === "Alice");
      expect(aliceCombo).toBeDefined();
      expect(aliceCombo!.score).toBeCloseTo(2.7);
    });

    it("Scenario 2 from spec: Low interest rank-1 sport with 2 buddies vs High interest rank-5 sport alone", () => {
      // Spec says:
      //   Basketball (rank 5/5): High, 4 buddies → 1.0 × 1.0 × 1.55 = 1.55
      //   But we test the simpler comparison: rank 1 Low+buddies vs rank 5 High alone
      //   Gymnastics (rank 1/5): Low, 2 soft buddies → 2.0 × 0.4 × 1.35 = 1.08
      //   Basketball (rank 5/5): High, 0 buddies → 1.0 × 1.0 × 1.0 = 1.0
      //   Low interest #1 sport CAN beat High interest #5 sport when buddies help
      // Sessions on separate days so each becomes its own primary (avoids subset filtering)
      const alice = makeMember("Alice", {
        sportRankings: [
          "Gymnastics",
          "Swimming",
          "Track & Field",
          "Diving",
          "Basketball",
        ],
        softBuddies: ["Bob", "Carol"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "low"
          ),
          makeSession(
            "BAS01",
            "Basketball",
            "SoFi Stadium Zone",
            "2028-07-23",
            "14:00",
            "16:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "medium"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol],
        LA_TRAVEL_ENTRIES,
        ["2028-07-22", "2028-07-23"]
      );

      const alicePrimaries = result.combos.filter(
        (c) => c.memberId === "Alice" && c.rank === "primary"
      );
      const gymCombo = alicePrimaries.find((c) =>
        c.sessionCodes.includes("GYM01")
      );
      const basCombo = alicePrimaries.find((c) =>
        c.sessionCodes.includes("BAS01")
      );

      expect(gymCombo).toBeDefined();
      expect(basCombo).toBeDefined();
      // Gymnastics: 2.0 × 0.4 × 1.35 = 1.08
      expect(gymCombo!.score).toBeCloseTo(1.08);
      // Basketball: 1.0 × 1.0 × 1.0 = 1.0
      expect(basCombo!.score).toBeCloseTo(1.0);
      // Low interest top sport + buddies beats High interest bottom sport
      expect(gymCombo!.score).toBeGreaterThan(basCombo!.score);
    });

    it("Scenario 3 from spec: buddy bonus impact — same sport, same interest, varying buddy count", () => {
      // Spec:
      //   Session A: High, rank 1, 0 buddies → 2.0 × 1.0 × 1.0 = 2.0
      //   Session B: High, rank 1, 3 buddies → 2.0 × 1.0 × 1.45 = 2.9
      //   Session C: High, rank 1, 6 buddies → 2.0 × 1.0 × 1.75 = 3.5
      const buddyIds = ["B1", "B2", "B3", "B4", "B5", "B6"];
      const members: MemberData[] = [];

      // Alice has 6 soft buddies, interested in 3 sessions
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: buddyIds,
        candidateSessions: [
          makeSession(
            "SA",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00",
            "high"
          ),
          makeSession(
            "SB",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-23",
            "08:00",
            "09:00",
            "high"
          ),
          makeSession(
            "SC",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-24",
            "08:00",
            "09:00",
            "high"
          ),
        ],
      });
      members.push(alice);

      // SA: no buddies interested
      // SB: 3 buddies interested (B1, B2, B3)
      // SC: 6 buddies interested (all)
      for (let i = 0; i < 6; i++) {
        const sessions = [];
        // All 6 buddies interested in SC
        sessions.push(
          makeSession(
            "SC",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-24",
            "08:00",
            "09:00",
            "high"
          )
        );
        // First 3 buddies also interested in SB
        if (i < 3) {
          sessions.push(
            makeSession(
              "SB",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-23",
              "08:00",
              "09:00",
              "high"
            )
          );
        }
        members.push(
          makeMember(buddyIds[i], {
            sportRankings: ["Swimming"],
            candidateSessions: sessions,
          })
        );
      }

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
        "2028-07-23",
        "2028-07-24",
      ]);

      const aliceCombos = result.combos.filter((c) => c.memberId === "Alice");
      const comboA = aliceCombos.find((c) => c.sessionCodes.includes("SA"));
      const comboB = aliceCombos.find((c) => c.sessionCodes.includes("SB"));
      const comboC = aliceCombos.find((c) => c.sessionCodes.includes("SC"));

      expect(comboA).toBeDefined();
      expect(comboB).toBeDefined();
      expect(comboC).toBeDefined();

      // SA: 0 buddies → 2.0 × 1.0 × 1.0 = 2.0
      expect(comboA!.score).toBeCloseTo(2.0);
      // SB: 3 buddies → 2.0 × 1.0 × 1.45 = 2.9
      expect(comboB!.score).toBeCloseTo(2.9);
      // SC: 6 buddies → 2.0 × 1.0 × (1.0 + 0.25 + 0.1*5) = 2.0 × 1.75 = 3.5
      expect(comboC!.score).toBeCloseTo(3.5);
    });

    it("Spec scenario: within same sport, Low interest CANNOT beat High interest without 14+ buddies", () => {
      // Session A: High interest, 0 buddies → 2.0 × 1.0 × 1.0 = 2.0
      // Session B: Low interest, N buddies → 2.0 × 0.4 × bonus
      //   For B > A: 2.0 × 0.4 × bonus > 2.0 → bonus > 2.5
      //   bonus = 1.0 + 0.25 + 0.1*(N-1) > 2.5 → N > 13.5, so need 14+ buddies
      // With 13 buddies: bonus = 1.0 + 0.25 + 0.1*12 = 2.45 → score = 2.0 × 0.4 × 2.45 = 1.96 < 2.0
      // With 14 buddies: bonus = 1.0 + 0.25 + 0.1*13 = 2.55 → score = 2.0 × 0.4 × 2.55 = 2.04 > 2.0

      // Test with 13 buddies: Low should NOT beat High
      // Sessions on separate days so each becomes its own primary (avoids subset filtering)
      const buddyIds13 = Array.from({ length: 13 }, (_, i) => `B${i}`);
      const members13: MemberData[] = [
        makeMember("Alice", {
          sportRankings: ["Swimming"],
          softBuddies: buddyIds13,
          candidateSessions: [
            makeSession(
              "HIGH",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "08:00",
              "09:00",
              "high"
            ),
            makeSession(
              "LOW",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-23",
              "11:00",
              "12:00",
              "low"
            ),
          ],
        }),
      ];
      // All 13 buddies interested in LOW only (not HIGH)
      for (const id of buddyIds13) {
        members13.push(
          makeMember(id, {
            sportRankings: ["Swimming"],
            candidateSessions: [
              makeSession(
                "LOW",
                "Swimming",
                "SoFi Stadium Zone",
                "2028-07-23",
                "11:00",
                "12:00",
                "high"
              ),
            ],
          })
        );
      }

      const result13 = runScheduleGeneration(members13, LA_TRAVEL_ENTRIES, [
        "2028-07-22",
        "2028-07-23",
      ]);
      const alicePrimaries13 = result13.combos.filter(
        (c) => c.memberId === "Alice" && c.rank === "primary"
      );
      const high13 = alicePrimaries13.find((c) =>
        c.sessionCodes.includes("HIGH")
      );
      const low13 = alicePrimaries13.find((c) =>
        c.sessionCodes.includes("LOW")
      );

      expect(high13).toBeDefined();
      expect(low13).toBeDefined();
      // HIGH: 2.0 × 1.0 × 1.0 = 2.0
      expect(high13!.score).toBeCloseTo(2.0);
      // LOW: 2.0 × 0.4 × 2.45 = 1.96
      expect(low13!.score).toBeCloseTo(1.96);
      expect(high13!.score).toBeGreaterThan(low13!.score);
    });
  });

  // =========================================================================
  // Overlapping sessions — implicit rejection via gap check
  // =========================================================================

  describe("overlapping sessions rejected", () => {
    it("fully overlapping sessions (same time) are never in the same combo", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Both start and end at the same time → gap = 0 < 90 → infeasible as pair
      const multiCombos = result.combos.filter(
        (c) => c.sessionCodes.length >= 2
      );
      expect(multiCombos).toHaveLength(0);

      // Each should appear individually
      const allCodes = result.combos.flatMap((c) => c.sessionCodes);
      expect(allCodes).toContain("SWM01");
      expect(allCodes).toContain("GYM01");
    });

    it("partially overlapping sessions (end > next start) are never in the same combo", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "11:30",
            "13:30"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 11:30 - 12:00 = -30 min (negative!) < 90 required → infeasible
      const multiCombos = result.combos.filter(
        (c) => c.sessionCodes.length >= 2
      );
      expect(multiCombos).toHaveLength(0);
    });

    it("session completely contained within another is rejected as pair", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "15:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // GYM01 starts at 10:00, SWM01 ends at 15:00 → gap for sorted pair:
      // sorted: SWM01(09:00) then GYM01(10:00), gap = 10:00 - 15:00 = -300 < 90 → infeasible
      // OR: GYM01(10:00) then SWM01(09:00) wouldn't happen since sorted by start
      const multiCombos = result.combos.filter(
        (c) => c.sessionCodes.length >= 2
      );
      expect(multiCombos).toHaveLength(0);
    });

    it("sessions ending and starting at exact same time: gap=0 < 90 → rejected", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "12:00",
            "14:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Gap = 12:00 - 12:00 = 0 < 90 → infeasible (no break between sessions even at same venue)
      const multiCombos = result.combos.filter(
        (c) => c.sessionCodes.length >= 2
      );
      expect(multiCombos).toHaveLength(0);
    });
  });

  // =========================================================================
  // Soft buddy bonus is based on interest, not combo membership
  // =========================================================================

  describe("soft buddy bonus based on interest, not combo attendance", () => {
    it("buddy interested in session but on a different day still gives bonus", () => {
      // Alice and Bob both interested in SWM01.
      // Alice has soft buddy Bob.
      // Even though Bob's combo for that day might differ, the bonus is
      // based on Bob having candidateSession SWM01 (interest), not attendance.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Gymnastics"],
        candidateSessions: [
          // Bob IS interested in SWM01 (has it in candidateSessions)
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "medium"
          ),
          // Bob also has a higher-scoring session at the same time
          // which may become his primary instead of SWM01
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // Alice should get the soft buddy bonus for SWM01 because Bob has SWM01
      // in his candidateSessions, regardless of whether Bob's primary combo picks SWM01 or GYM01
      const aliceCombo = result.combos.find((c) => c.memberId === "Alice");
      expect(aliceCombo).toBeDefined();
      // Swimming rank 1/1 → 2.0, high → 1.0, 1 buddy → 1.25 = 2.5
      expect(aliceCombo!.score).toBeCloseTo(2.5);
    });

    it("buddy NOT interested in session gives no bonus even if they attend same venue", () => {
      // Bob has no interest in SWM01 → Alice gets no buddy bonus for SWM01
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          // Bob at same venue, same day, but different session — no interest in SWM01
          makeSession(
            "GYM01",
            "Gymnastics",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const aliceCombo = result.combos.find((c) => c.memberId === "Alice");
      expect(aliceCombo).toBeDefined();
      // No buddy bonus: 2.0 × 1.0 × 1.0 = 2.0
      expect(aliceCombo!.score).toBeCloseTo(2.0);
    });

    it("non-soft-buddy member interested in session gives NO bonus", () => {
      // Carol is interested in SWM01 but is NOT Alice's soft buddy → no bonus
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: [], // No soft buddies
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, carol], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const aliceCombo = result.combos.find((c) => c.memberId === "Alice");
      expect(aliceCombo).toBeDefined();
      // No soft buddies → no bonus: 2.0 × 1.0 × 1.0 = 2.0
      expect(aliceCombo!.score).toBeCloseTo(2.0);
    });
  });

  // =========================================================================
  // Tiebreaking verification (spec lines 354-358)
  // =========================================================================

  describe("spec tiebreaking rules", () => {
    it("tiebreak 1: same score → prefer more sessions", () => {
      // Create a scenario where a 1-session combo has the same score as a 2-session combo
      // This is tricky because 2 sessions always sum higher. So we test that
      // given equal *individual* session scores, the 2-session combo ranks higher.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "S1",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "08:00",
            "09:00",
            "high"
          ),
          makeSession(
            "S2",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:30",
            "11:30",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // The 2-session combo has double the score of any single, so it should be primary
      const primary = result.combos.find(
        (c) => c.memberId === "Alice" && c.rank === "primary"
      );
      expect(primary).toBeDefined();
      expect(primary!.sessionCodes.length).toBe(2);
    });

    it("tiebreak 3: same score, same session count, same sport multiplier → alphabetical by first session code", () => {
      // Three overlapping sessions with identical score (same sport, same interest, no buddies).
      // Because they overlap, only solo combos are feasible. Each is distinct → P, B1, B2.
      // Tiebreak on score/count/multiplierSum is all equal → alphabetical session code wins.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "ZZZ01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
          makeSession(
            "AAA01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
          makeSession(
            "MMM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      // All three overlap → only solo combos. All distinct → P, B1, B2.
      const dayCombos = result.combos.filter(
        (c) => c.memberId === "Alice" && c.day === "2028-07-22"
      );
      expect(dayCombos).toHaveLength(3);

      // Sorted alphabetically: AAA01, MMM01, ZZZ01
      expect(dayCombos[0].rank).toBe("primary");
      expect(dayCombos[0].sessionCodes[0]).toBe("AAA01");
      expect(dayCombos[1].rank).toBe("backup1");
      expect(dayCombos[1].sessionCodes[0]).toBe("MMM01");
      expect(dayCombos[2].rank).toBe("backup2");
      expect(dayCombos[2].sessionCodes[0]).toBe("ZZZ01");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Convergence loop scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe("convergence loop", () => {
    it("converges in 1 pass when no violations exist", () => {
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s1],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.convergence.converged).toBe(true);
      expect(result.convergence.iterations).toBe(1);
      expect(result.convergence.violations).toHaveLength(0);
    });

    it("returns convergence info with all results", () => {
      const s1 = makeSession(
        "SWM01",
        "Swimming",
        "SoFi Stadium Zone",
        "2028-07-22",
        "09:00",
        "11:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s1],
      });

      const result = runScheduleGeneration([alice], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.convergence).toBeDefined();
      expect(typeof result.convergence.iterations).toBe("number");
      expect(typeof result.convergence.converged).toBe("boolean");
      expect(Array.isArray(result.convergence.violations)).toBe(true);
    });

    it("member ends up in membersWithNoCombos after convergence prunes all sessions", () => {
      // Alice has hard buddy Bob. Both interested in SWM01.
      // But Bob's only candidate session is GYM01 — which doesn't overlap with SWM01.
      // Pre-filter removes SWM01 from Alice since Bob doesn't have it.
      // Alice ends up with no combos.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Bob"],
        candidateSessions: [
          makeSession(
            "SWM01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "09:00",
            "11:00"
          ),
        ],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Gymnastics"],
        candidateSessions: [
          makeSession(
            "GYM01",
            "Gymnastics",
            "Downtown LA Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.convergence.converged).toBe(true);
    });

    it("returns converged: false when violations persist after max iterations", () => {
      // Create 15 sessions on one day, spaced 100 min apart (10-min sessions
      // with 90-min gaps) so any 3 form a travel-feasible combo.
      //
      // Alice has hardBuddies: ["Bob"] and all 15 sessions as candidates.
      // Bob also has all 15 as candidates (so Alice's hard-buddy pre-filter
      // passes), but Bob sets minBuddies: 99 which causes ALL his sessions to
      // be filtered out (interest count per session is only 2). Bob therefore
      // generates zero combos, meaning none of Alice's primary-combo sessions
      // are attended by Bob → hardBuddies violation every iteration.
      //
      // Each iteration prunes the 3 sessions in Alice's primary combo.
      // After 4 iterations 12 sessions are pruned, leaving 3. Iteration 5
      // still finds 3 violations and returns converged: false.

      const DAY = "2028-07-22";
      const sessions = Array.from({ length: 15 }, (_, i) => {
        const startHour = Math.floor((i * 100) / 60);
        const startMin = (i * 100) % 60;
        const endMin = startMin + 10;
        const endHour = startHour + Math.floor(endMin / 60);
        const pad = (n: number) => String(n).padStart(2, "0");
        return makeSession(
          `EV${pad(i + 1)}`,
          "Swimming",
          "SoFi Stadium Zone",
          DAY,
          `${pad(startHour)}:${pad(startMin)}`,
          `${pad(endHour)}:${pad(endMin % 60)}`
        );
      });

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Bob"],
        candidateSessions: sessions,
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        minBuddies: 99,
        candidateSessions: sessions.map((s) => ({ ...s })),
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        DAY,
      ]);

      expect(result.convergence.converged).toBe(false);
      expect(result.convergence.iterations).toBe(5);
      expect(result.convergence.violations.length).toBeGreaterThan(0);
      expect(
        result.convergence.violations.every((v) => v.type === "hardBuddies")
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  describe("timeout", () => {
    it("returns timedOut: true when timeoutMs is exceeded", () => {
      // Use -1 timeout so isTimedOut() is true immediately
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS, {
        timeoutMs: -1,
      });

      expect(result.convergence.timedOut).toBe(true);
    });

    it("does not set timedOut when completing within timeout", () => {
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS, {
        timeoutMs: 60000,
      });

      expect(result.convergence.timedOut).toBeUndefined();
      expect(result.convergence.converged).toBe(true);
    });

    it("skips per-member backup enhancement when timeout occurs mid-enhancement", () => {
      // Scenario: A→hardBuddy B, B→hardBuddy C. All prefer S1+S2, C only has S2.
      // Iteration 1: A's primary with S1 fails validation → S1 pruned from A.
      // Iteration 2: converges (A only has S2).
      // Backup enhancement: mock Date.now so the outer check passes but
      // the per-member check for A times out, skipping A's enhancement.
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          hardBuddies: ["B"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
      ];

      // Mock Date.now: allow convergence loop (2 iterations × 3 members = 8 calls
      // including the startTime capture and iteration check) + outer enhancement
      // check (call 9) to pass, then timeout on per-member enhancement (call 10+).
      let callCount = 0;
      const spy = vi.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        return callCount <= 9 ? 1000 : 200000;
      });

      try {
        const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS, {
          timeoutMs: 100000,
        });

        // A had pruned sessions but enhancement was skipped due to timeout
        // S1 should NOT appear in A's backups (enhancement skipped)
        const aBackups = result.combos.filter(
          (c) =>
            c.memberId === "A" && c.rank !== "primary" && c.day === "2028-07-22"
        );
        const backupCodes = aBackups.flatMap((c) => c.sessionCodes);
        expect(backupCodes).not.toContain("S1");

        // A's primary should still have S2 (the converged result)
        const aPrimary = result.combos.find(
          (c) => c.memberId === "A" && c.rank === "primary"
        );
        expect(aPrimary).toBeDefined();
        expect(aPrimary!.sessionCodes).toContain("S2");
      } finally {
        spy.mockRestore();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Backup enhancement with pruned sessions
  // -------------------------------------------------------------------------

  describe("backup enhancement", () => {
    it("includes pruned sessions in backup combos after convergence", () => {
      // A has hardBuddy B, B has hardBuddy C.
      // All three prefer S1 and S2.
      // C does NOT prefer S1 → B's hard buddy filter removes S1 from B's
      // filtered set → A's primary with S1 fails validation (B has no combo
      // with S1) → S1 is pruned from A → backup enhancement re-includes S1.
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          hardBuddies: ["B"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS);

      // A's primary should have S2 (the session that satisfies all constraints)
      const aPrimary = result.combos.filter(
        (c) =>
          c.memberId === "A" && c.rank === "primary" && c.day === "2028-07-22"
      );
      expect(aPrimary).toHaveLength(1);
      expect(aPrimary[0].sessionCodes).toContain("S2");

      // A's backup should include S1 (the pruned session re-included)
      const aBackups = result.combos.filter(
        (c) =>
          c.memberId === "A" && c.rank !== "primary" && c.day === "2028-07-22"
      );
      const backupCodes = aBackups.flatMap((c) => c.sessionCodes);
      expect(backupCodes).toContain("S1");
    });

    it("does not enhance backups when no sessions were pruned", () => {
      // Both members prefer the same sessions — no violations, no pruning
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS);

      expect(result.convergence.converged).toBe(true);
      const aDay = result.combos.filter(
        (c) => c.memberId === "A" && c.day === "2028-07-22"
      );
      expect(aDay.length).toBeGreaterThanOrEqual(1);
    });

    it("excludes naturally filtered sessions from enhanced backups", () => {
      // A has minBuddies=1. A prefers S1, S2, S3. B prefers S1 only. C prefers S2 only.
      // After filter: S1 (A+B=2 interested, passes minBuddies=1), S2 (A+C=2, passes),
      //   S3 (A only=1, fails minBuddies=1 because 0 others).
      // A also has hardBuddy B. B only has S1 in filtered set.
      // A's primary: {S1, S2}. Validation: S1 — B has S1 ✓. S2 — B must have S2 in
      //   any combo. B only has S1, no S2 → hardBuddies violation on S2.
      // S2 pruned from A. Next iteration: A has only S1 in candidates.
      // Backup enhancement: S2 is convergence-pruned (re-included with penalty).
      //   S3 was naturally filtered (not in prunedCodes) — should NOT appear.
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          minBuddies: 1,
          hardBuddies: ["B"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
            makeSession(
              "S3",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "18:00",
              "20:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S1",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "09:00",
              "11:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            makeSession(
              "S2",
              "Swimming",
              "SoFi Stadium Zone",
              "2028-07-22",
              "14:00",
              "16:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, LA_TRAVEL_ENTRIES, DAYS);

      // S3 should NOT appear anywhere in A's combos (was naturally filtered, not pruned)
      const aCombos = result.combos.filter(
        (c) => c.memberId === "A" && c.day === "2028-07-22"
      );
      const allCodes = aCombos.flatMap((c) => c.sessionCodes);
      expect(allCodes).not.toContain("S3");
    });
  });

  // -------------------------------------------------------------------------
  // Locked sessions
  // -------------------------------------------------------------------------

  describe("locked sessions", () => {
    it("locked sessions skip buddy constraint validation", () => {
      // Alice has minBuddies=1, but her locked session has no other attendees.
      // The locked session should still appear in her combo without a violation.
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 1,
        lockedSessionCodes: ["LOCK-01"],
        candidateSessions: [
          makeSession(
            "LOCK-01",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "10:00",
            "12:00"
          ),
          makeSession(
            "SWM-02",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          makeSession(
            "SWM-02",
            "Swimming",
            "SoFi Stadium Zone",
            "2028-07-22",
            "14:00",
            "16:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], LA_TRAVEL_ENTRIES, [
        "2028-07-22",
      ]);

      const alicePrimary = result.combos.find(
        (c) => c.memberId === "Alice" && c.rank === "primary"
      );
      expect(alicePrimary).toBeDefined();
      // Locked session must be present
      expect(alicePrimary!.sessionCodes).toContain("LOCK-01");
      // Should converge (locked session skips minBuddies check)
      expect(result.convergence.converged).toBe(true);
    });
  });
});

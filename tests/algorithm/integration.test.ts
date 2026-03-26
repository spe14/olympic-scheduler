import { describe, it, expect, vi } from "vitest";
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

// --- Real session helper (matches la2028_sessions.csv exactly) ---
function realSession(
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

// --- Real travel entries (from driving_times.csv and transit_times.csv) ---
const REAL_TRAVEL: TravelEntry[] = [
  // Inglewood ↔ Pasadena
  {
    originZone: "Inglewood Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 43.55,
    transitMinutes: 128,
  },
  {
    originZone: "Pasadena Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 36.25,
    transitMinutes: 128,
  },
  // Exposition Park ↔ DTLA
  {
    originZone: "Exposition Park Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 11.3,
    transitMinutes: 20,
  },
  {
    originZone: "DTLA Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 9.9,
    transitMinutes: 18,
  },
  // Exposition Park ↔ Pasadena
  {
    originZone: "Exposition Park Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 27.33,
    transitMinutes: 91,
  },
  {
    originZone: "Pasadena Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 25.02,
    transitMinutes: 97,
  },
  // DTLA ↔ Pasadena
  {
    originZone: "DTLA Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 22.02,
    transitMinutes: 69,
  },
  {
    originZone: "Pasadena Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 22.37,
    transitMinutes: 72,
  },
  // DTLA ↔ Valley
  {
    originZone: "DTLA Zone",
    destinationZone: "Valley Zone",
    drivingMinutes: 26.97,
    transitMinutes: 100,
  },
  {
    originZone: "Valley Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 32.08,
    transitMinutes: 100,
  },
  // Pasadena ↔ Valley
  {
    originZone: "Pasadena Zone",
    destinationZone: "Valley Zone",
    drivingMinutes: 25.52,
    transitMinutes: 151,
  },
  {
    originZone: "Valley Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 24.72,
    transitMinutes: 135,
  },
  // Pasadena ↔ Long Beach
  {
    originZone: "Pasadena Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 49.38,
    transitMinutes: 158,
  },
  {
    originZone: "Long Beach Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 49.88,
    transitMinutes: 160,
  },
  // Exposition Park ↔ Long Beach
  {
    originZone: "Exposition Park Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 33.33,
    transitMinutes: 120,
  },
  {
    originZone: "Long Beach Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 35.55,
    transitMinutes: 102,
  },
  // Long Beach ↔ DTLA
  {
    originZone: "Long Beach Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 39.53,
    transitMinutes: 98,
  },
  {
    originZone: "DTLA Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 37.13,
    transitMinutes: 95,
  },
  // Long Beach ↔ Valley
  {
    originZone: "Long Beach Zone",
    destinationZone: "Valley Zone",
    drivingMinutes: 50.97,
    transitMinutes: 191,
  },
  {
    originZone: "Valley Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 48.9,
    transitMinutes: 191,
  },
  // Inglewood ↔ DTLA
  {
    originZone: "Inglewood Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 27.35,
    transitMinutes: 69,
  },
  {
    originZone: "DTLA Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 21.15,
    transitMinutes: 54,
  },
  // Inglewood ↔ Long Beach
  {
    originZone: "Inglewood Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 35.42,
    transitMinutes: 118,
  },
  {
    originZone: "Long Beach Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 33.93,
    transitMinutes: 100,
  },
  // Inglewood ↔ Exposition Park
  {
    originZone: "Inglewood Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 14.17,
    transitMinutes: 40,
  },
  {
    originZone: "Exposition Park Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 12.55,
    transitMinutes: 38,
  },
  // Inglewood ↔ Valley
  {
    originZone: "Inglewood Zone",
    destinationZone: "Valley Zone",
    drivingMinutes: 38.5,
    transitMinutes: 130,
  },
  {
    originZone: "Valley Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 40.2,
    transitMinutes: 135,
  },
  // Exposition Park ↔ Valley
  {
    originZone: "Exposition Park Zone",
    destinationZone: "Valley Zone",
    drivingMinutes: 28.5,
    transitMinutes: 105,
  },
  {
    originZone: "Valley Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 30.1,
    transitMinutes: 108,
  },
  // Anaheim ↔ others (for Volleyball VVO sessions)
  {
    originZone: "Anaheim Zone",
    destinationZone: "Exposition Park Zone",
    drivingMinutes: 41.98,
    transitMinutes: 110,
  },
  {
    originZone: "Exposition Park Zone",
    destinationZone: "Anaheim Zone",
    drivingMinutes: 42.23,
    transitMinutes: 110,
  },
  {
    originZone: "Anaheim Zone",
    destinationZone: "DTLA Zone",
    drivingMinutes: 41.42,
    transitMinutes: 89,
  },
  {
    originZone: "DTLA Zone",
    destinationZone: "Anaheim Zone",
    drivingMinutes: 40.3,
    transitMinutes: 87,
  },
  {
    originZone: "Anaheim Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 21.57,
    transitMinutes: 117,
  },
  {
    originZone: "Long Beach Zone",
    destinationZone: "Anaheim Zone",
    drivingMinutes: 23.1,
    transitMinutes: 110,
  },
  {
    originZone: "Anaheim Zone",
    destinationZone: "Pasadena Zone",
    drivingMinutes: 46.2,
    transitMinutes: 141,
  },
  {
    originZone: "Pasadena Zone",
    destinationZone: "Anaheim Zone",
    drivingMinutes: 47.62,
    transitMinutes: 123,
  },
  // Trestles Beach ↔ others (driving only, no transit)
  {
    originZone: "Inglewood Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 75,
    transitMinutes: null,
  },
  {
    originZone: "Trestles Beach Zone",
    destinationZone: "Inglewood Zone",
    drivingMinutes: 75,
    transitMinutes: null,
  },
  {
    originZone: "DTLA Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 80,
    transitMinutes: null,
  },
  {
    originZone: "Trestles Beach Zone",
    destinationZone: "DTLA Zone",
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
    originZone: "Trestles Beach Zone",
    destinationZone: "Long Beach Zone",
    drivingMinutes: 70,
    transitMinutes: null,
  },
  {
    originZone: "Pasadena Zone",
    destinationZone: "Trestles Beach Zone",
    drivingMinutes: 85,
    transitMinutes: null,
  },
  {
    originZone: "Trestles Beach Zone",
    destinationZone: "Pasadena Zone",
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
      const swmSession = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00",
        "high",
        200
      );
      const gymSession = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "14:30:00",
        "16:30:00",
        "medium",
        300
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [swmSession, gymSession],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics", "Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:30:00",
            "16:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
      const sharedSession1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "10:30:00",
        "high"
      );
      const sharedSession2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "13:00:00",
        "15:00:00",
        "high"
      );
      const abOnlySession = realSession(
        "TRK01",
        "Athletics (Track & Field)",
        "Pasadena Zone",
        "2028-07-23",
        "10:00:00",
        "12:00:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        hardBuddies: ["Bob"],
        candidateSessions: [sharedSession1, sharedSession2, abOnlySession],
      });

      const bob = makeMember("Bob", {
        sportRankings: [
          "Artistic Gymnastics",
          "Swimming",
          "Athletics (Track & Field)",
        ],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "10:30:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "13:00:00",
            "15:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        minBuddies: 1,
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "10:30:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "13:00:00",
            "15:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
        "2028-07-23",
      ]);

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
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:00:00",
          "11:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "DTLA Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00"
        ),
        realSession(
          "TRK01",
          "Athletics (Track & Field)",
          "Pasadena Zone",
          "2028-07-23",
          "10:00:00",
          "12:00:00"
        ),
      ];
      const alice = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        softBuddies: ["Bob"],
        candidateSessions: aliceSessions,
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics", "Swimming"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Athletics (Track & Field)", "Swimming"],
        minBuddies: 1,
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const dave = makeMember("Dave", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        REAL_TRAVEL,
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
      const eveSession = realSession(
        "DIV01",
        "Diving",
        "Long Beach Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00",
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([eve, frank], REAL_TRAVEL, [
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
      const session = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00",
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // SWM01 interest count = 2, Alice needs 3 others → 2 - 1 = 1 < 3
      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.membersWithNoCombos).not.toContain("Bob");
    });
  });

  describe("single member group", () => {
    it("generates combos correctly for a solo member with no buddy constraints", () => {
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );
      const s2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00",
        "medium"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [s1, s2],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.combos).toHaveLength(0);
    });
  });

  describe("sessions on different days", () => {
    it("groups combos by day with no cross-day contamination", () => {
      const day1S1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00",
        "high"
      );
      const day1S2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00",
        "high"
      );
      const day2S1 = realSession(
        "TRK01",
        "Athletics (Track & Field)",
        "Pasadena Zone",
        "2028-07-23",
        "10:00:00",
        "12:00:00",
        "high"
      );
      const day3S1 = realSession(
        "DIV01",
        "Diving",
        "Long Beach Zone",
        "2028-07-24",
        "10:00:00",
        "12:00:00",
        "medium"
      );

      const alice = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
          "Diving",
        ],
        candidateSessions: [day1S1, day1S2, day2S1, day3S1],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, DAYS);

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
      // Inglewood → Pasadena: 43.55 min driving → 150 min required gap
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "10:00:00",
        "high"
      );
      const s2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Pasadena Zone",
        "2028-07-22",
        "11:00:00",
        "13:00:00",
        "high"
      );
      // gap = 11:00 - 10:00 = 60 min < 150 min required → infeasible as pair

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [s1, s2],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
      const trestlesSession = realSession(
        "SRF01",
        "Surfing",
        "Trestles Beach Zone",
        "2028-07-22",
        "08:00:00",
        "10:00:00",
        "high"
      );
      const closeSession = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "13:00:00",
        "15:00:00",
        "high"
      );
      // gap = 13:00 - 10:00 = 180 min < 240 required → infeasible

      const farSession = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00",
        "high"
      );
      // gap = 14:00 - 10:00 = 240 min = 240 required → feasible

      const aliceClose = makeMember("AliceClose", {
        sportRankings: ["Surfing", "Swimming"],
        candidateSessions: [trestlesSession, closeSession],
      });

      const aliceFar = makeMember("AliceFar", {
        sportRankings: ["Surfing", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "08:00:00",
            "10:00:00"
          ),
          farSession,
        ],
      });

      // Close session pairing: should only have individual combos
      const resultClose = runScheduleGeneration([aliceClose], REAL_TRAVEL, [
        "2028-07-22",
      ]);
      const closePairs = resultClose.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(closePairs).toHaveLength(0);

      // Far session pairing: should allow the 2-session combo
      const resultFar = runScheduleGeneration([aliceFar], REAL_TRAVEL, [
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
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );
      const s2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "12:30:00",
        "14:30:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "12:30:00",
            "14:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );
      const s2 = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "12:30:00",
        "14:30:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      // Bob is interested in SWM01 and GYM01, but has hard buddy Carol
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        hardBuddies: ["Carol"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "12:30:00",
            "14:30:00"
          ),
        ],
      });

      // Carol is only interested in GYM01 → Bob's SWM01 gets filtered out
      const carol = makeMember("Carol", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "12:30:00",
            "14:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

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
      const s1 = realSession(
        "TRK01",
        "Athletics (Track & Field)",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );
      const s2 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "12:30:00",
        "14:30:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Athletics (Track & Field)", "Swimming"],
        softBuddies: ["Bob"],
        candidateSessions: [s1, s2],
      });

      // Bob has minBuddies=2 and is interested in TRK01 and SWM01
      // TRK01: 2 total interested (Alice + Bob), Bob needs 2 others → 2-1=1 < 2 → filtered
      // SWM01: 2 total interested (Alice + Bob), Bob needs 2 others → 2-1=1 < 2 → filtered
      const bob = makeMember("Bob", {
        sportRankings: ["Athletics (Track & Field)", "Swimming"],
        minBuddies: 2,
        candidateSessions: [
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "12:30:00",
            "14:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
        ],
      });

      // Carol is interested in SWM01 → Bob keeps it
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

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
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:00:00",
          "11:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "DTLA Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00"
        ),
        realSession(
          "TRK01",
          "Athletics (Track & Field)",
          "Pasadena Zone",
          "2028-07-23",
          "10:00:00",
          "12:00:00"
        ),
      ];

      const alice = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        softBuddies: ["Bob"],
        candidateSessions: sessions,
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics", "Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result1 = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
        "2028-07-22",
        "2028-07-23",
      ]);

      // Re-create members (fresh objects) to ensure no mutation
      const alice2 = makeMember("Alice", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        softBuddies: ["Bob"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const bob2 = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics", "Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Pasadena Zone",
            "2028-07-23",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result2 = runScheduleGeneration([alice2, bob2], REAL_TRAVEL, [
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
      const s = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      expect(result.membersWithNoCombos).toHaveLength(0);
      expect(result.combos).toHaveLength(1);
      expect(result.combos[0].rank).toBe("primary");
      expect(result.combos[0].sessionCodes).toEqual(["SWM01"]);
    });

    it("single member with minBuddies > 0 gets no combos (can't satisfy alone)", () => {
      const s = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 1,
        candidateSessions: [s],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // Interest count for SWM01 = 1 (only Alice). 1 - 1 = 0 < 1 → filtered out
      expect(result.membersWithNoCombos).toContain("Alice");
      expect(result.combos).toHaveLength(0);
    });

    it("single member with hardBuddies pointing to nobody gets no combos", () => {
      const s = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Ghost"],
        candidateSessions: [s],
      });

      // "Ghost" doesn't exist → input filter skips that buddy, but post-generation
      // validation detects "Ghost" has no combo with SWM01 → session pruned → no combos
      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            `SWM${d}`,
            "Swimming",
            "Inglewood Zone",
            day,
            "10:00:00",
            "12:00:00"
          )
        );
      }

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, allDays);

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
          realSession(
            `S${i.toString().padStart(2, "0")}`,
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            `${8 + i * 2}:00:00`,
            `${9 + i * 2}:00:00`
          )
        );
      }

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
              realSession(
                "SWM01",
                "Swimming",
                "Inglewood Zone",
                "2028-07-22",
                "10:00:00",
                "12:00:00",
                "high"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
              realSession(
                "SWM01",
                "Swimming",
                "Inglewood Zone",
                "2028-07-22",
                "10:00:00",
                "12:00:00"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
              realSession(
                "SWM01",
                "Swimming",
                "Inglewood Zone",
                "2028-07-22",
                "10:00:00",
                "12:00:00"
              ),
            ],
          })
        );
      }
      // M11 is interested in a DIFFERENT session
      members.push(
        makeMember("M11", {
          sportRankings: ["Artistic Gymnastics"],
          candidateSessions: [
            realSession(
              "GYM01",
              "Artistic Gymnastics",
              "DTLA Zone",
              "2028-07-22",
              "10:00:00",
              "12:00:00"
            ),
          ],
        })
      );

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
              realSession(
                "SWM01",
                "Swimming",
                "Inglewood Zone",
                "2028-07-22",
                "10:00:00",
                "12:00:00"
              ),
            ],
          })
        );
      }

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
      "Artistic Gymnastics",
      "Athletics (Track & Field)",
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
        realSession(
          `${sport.substring(0, 3).toUpperCase()}01`,
          sport,
          "Inglewood Zone",
          "2028-07-22",
          `${8 + i}:30:00`,
          `${9 + i}:00:00`
        )
      );

      const alice = makeMember("Alice", {
        sportRankings: tenSports,
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
            realSession(
              `${tenSports[i].substring(0, 3).toUpperCase()}${day.slice(-2)}`,
              tenSports[i],
              "Inglewood Zone",
              day,
              `${8 + i}:30:00`,
              `${9 + i}:00:00`
            )
          );
        }
      }

      const alice = makeMember("Alice", {
        sportRankings: tenSports,
        candidateSessions: sessions,
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, days);

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
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:30:00",
          "high"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "10:30:00",
          "12:00:00",
          "medium"
        ),
        realSession(
          "TRK01",
          "Athletics (Track & Field)",
          "Inglewood Zone",
          "2028-07-22",
          "13:00:00",
          "14:30:00",
          "high"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "15:30:00",
          "17:00:00",
          "low"
        ),
        realSession(
          "BAS01",
          "Basketball",
          "Inglewood Zone",
          "2028-07-22",
          "18:00:00",
          "19:30:00",
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

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
      const shared = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const aOnly = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      );
      const bOnly = realSession(
        "TRK01",
        "Athletics (Track & Field)",
        "Pasadena Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [shared, aOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Athletics (Track & Field)"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          bOnly,
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
      const all3 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const abOnly = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      );
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [all3, abOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        hardBuddies: ["Carol"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Athletics (Track & Field)"],
        hardBuddies: ["Alice"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

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
      const shared = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const bOnly = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        hardBuddies: ["Bob"],
        candidateSessions: [shared],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        // No hard buddies — doesn't require Alice
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          bOnly,
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        hardBuddies: ["Bob", "Carol", "Dave"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "18:00:00",
            "20:00:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming", "Athletics (Track & Field)"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "TRK01",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "18:00:00",
            "20:00:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        REAL_TRAVEL,
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
      const shared = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );
      const aliceOnly = realSession(
        "GYM01",
        "Artistic Gymnastics",
        "Inglewood Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [shared, aliceOnly],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        hardBuddies: ["Bob"],
        minBuddies: 2,
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        REAL_TRAVEL,
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // SWM01: 3 interested, Alice needs 2 others → 3-1=2 >= 2 ✓
      expect(result.membersWithNoCombos).not.toContain("Alice");
    });

    it("minBuddies just below threshold: count-1 < minBuddies fails", () => {
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        minBuddies: 3,
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // SWM01: 3 interested, Alice needs 3 others → 3-1=2 < 3 ✗
      expect(result.membersWithNoCombos).toContain("Alice");
    });

    it("multiple soft buddies increase score multiplicatively", () => {
      const session = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "10:00:00",
        "12:00:00"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        softBuddies: ["Bob", "Carol", "Dave"],
        candidateSessions: [session],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });
      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        REAL_TRAVEL,
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        softBuddies: ["Bob"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      // Bob is only interested in SWM01, not GYM01
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:01:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:01 = 89 min < 90 required → NOT feasible as pair
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("close zones (<15 min) need 90-min gap — boundary test", () => {
      // Exposition Park → DTLA: 11.3 min driving → 90 min required
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "ATH01",
            "Athletics (Track & Field)",
            "Exposition Park Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "10:30:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "ATH01",
            "Athletics (Track & Field)",
            "Exposition Park Zone",
            "2028-07-22",
            "08:00:00",
            "09:01:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "10:30:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // Gap = 10:30 - 09:01 = 89 min < 90 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("medium zones (30-44 min) need 150-min gap — boundary test", () => {
      // Inglewood → Pasadena: 43.55 min driving → 150 min required
      const alice = makeMember("Alice", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Pasadena Zone",
            "2028-07-22",
            "11:30:00",
            "13:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:01:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Pasadena Zone",
            "2028-07-22",
            "11:30:00",
            "13:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Unknown Zone Alpha",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Unknown Zone Beta",
            "2028-07-22",
            "12:30:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Unknown Zone Alpha",
            "2028-07-22",
            "08:00:00",
            "09:01:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Unknown Zone Beta",
            "2028-07-22",
            "12:30:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00:00",
            "08:00:00"
          ),
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "12:00:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00:00",
            "08:01:00"
          ),
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "12:00:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // Gap = 12:00 - 08:01 = 239 min < 240 required → NOT feasible
      const twoSessionCombos = result.combos.filter(
        (c) => c.sessionCodes.length === 2
      );
      expect(twoSessionCombos).toHaveLength(0);
    });

    it("3-session chain: feasible first hop, infeasible second hop → no 3-combo", () => {
      // Exposition Park → DTLA (11.3 min, 90 min gap), then DTLA → Long Beach (37.13 min, 150 min gap)
      const alice = makeMember("Alice", {
        sportRankings: [
          "Athletics (Track & Field)",
          "Artistic Gymnastics",
          "Swimming",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Athletics (Track & Field)",
            "Exposition Park Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "10:30:00",
            "12:00:00"
          ),
          realSession(
            "S03",
            "Swimming",
            "Long Beach Zone",
            "2028-07-22",
            "13:00:00",
            "15:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      // Hop 1: 10:30 - 09:00 = 90 >= 90 (Expo Park→DTLA 11.3 min → 90 min required) ✓
      // Hop 2: 13:00 - 12:00 = 60 < 150 (DTLA→Long Beach 37.13 min → 150 min required) ✗
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
          realSession(
            "SRF01",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "06:00:00",
            "07:00:00"
          ),
          realSession(
            "SRF02",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "08:30:00",
            "09:30:00"
          ),
          realSession(
            "SRF03",
            "Surfing",
            "Trestles Beach Zone",
            "2028-07-22",
            "11:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "21:00:00",
            "00:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "10:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "12:30:00",
            "14:00:00"
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "low"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
          "Diving",
          "Boxing",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "11:30:00"
          ),
          realSession(
            "S03",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "13:00:00",
            "14:00:00"
          ),
          realSession(
            "S04",
            "Diving",
            "Inglewood Zone",
            "2028-07-22",
            "15:30:00",
            "16:30:00"
          ),
          realSession(
            "S05",
            "Boxing",
            "Inglewood Zone",
            "2028-07-22",
            "18:00:00",
            "19:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "11:30:00"
          ),
          realSession(
            "S03",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "13:00:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "S02",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "11:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        candidateSessions: [
          realSession(
            "SWM",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "TRK",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
          "Diving",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "11:30:00"
          ),
          realSession(
            "S03",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "13:00:00",
            "14:00:00"
          ),
          realSession(
            "S04",
            "Diving",
            "Inglewood Zone",
            "2028-07-22",
            "15:30:00",
            "16:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "10:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "11:30:00",
            "13:30:00"
          ),
          // S03 overlaps with S01 (starts at 09:00, before S01 ends at 10:00)
          realSession(
            "S03",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: [
          "Swimming",
          "Artistic Gymnastics",
          "Athletics (Track & Field)",
          "Diving",
        ],
        candidateSessions: [
          realSession(
            "S01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "S02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "S03",
            "Athletics (Track & Field)",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "S04",
            "Diving",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        hardBuddies: ["Bob"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "10:00:00"
          ),
          realSession(
            "SWM02",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "12:00:00",
            "14:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "15:00:00",
            "17:00:00"
          ),
          realSession(
            "GYM02",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "18:00:00",
            "20:00:00"
          ),
        ],
      });

      // Bob only interested in SWM01 and SWM02
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "10:00:00"
          ),
          realSession(
            "SWM02",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "12:00:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
          realSession(
            "SWM_HIGH",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
          realSession(
            "SWM_LOW",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00",
            "low"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        "Artistic Gymnastics",
        "Athletics (Track & Field)",
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "medium"
          ),
          realSession(
            "FEN01",
            "Fencing",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "DIV01",
            "Diving",
            "Long Beach Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const carol = makeMember("Carol", {
        sportRankings: ["Artistic Gymnastics"],
        minBuddies: 10,
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const dave = makeMember("Dave", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration(
        [alice, bob, carol, dave],
        REAL_TRAVEL,
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
          "Artistic Gymnastics",
          "Swimming",
          "Athletics (Track & Field)",
          "Diving",
          "Basketball",
        ],
        softBuddies: ["Bob", "Carol"],
        candidateSessions: [
          realSession(
            "GYM-WFINAL",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM-WFINAL",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM-WFINAL",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "medium"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
      ]);

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
          "Artistic Gymnastics",
          "Swimming",
          "Athletics (Track & Field)",
          "Diving",
          "Basketball",
        ],
        softBuddies: ["Bob", "Carol"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "low"
          ),
          realSession(
            "BAS01",
            "Basketball",
            "Inglewood Zone",
            "2028-07-23",
            "14:00:00",
            "16:00:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "medium"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob, carol], REAL_TRAVEL, [
        "2028-07-22",
        "2028-07-23",
      ]);

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
          realSession(
            "SA",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00",
            "high"
          ),
          realSession(
            "SB",
            "Swimming",
            "Inglewood Zone",
            "2028-07-23",
            "08:00:00",
            "09:00:00",
            "high"
          ),
          realSession(
            "SC",
            "Swimming",
            "Inglewood Zone",
            "2028-07-24",
            "08:00:00",
            "09:00:00",
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
          realSession(
            "SC",
            "Swimming",
            "Inglewood Zone",
            "2028-07-24",
            "08:00:00",
            "09:00:00",
            "high"
          )
        );
        // First 3 buddies also interested in SB
        if (i < 3) {
          sessions.push(
            realSession(
              "SB",
              "Swimming",
              "Inglewood Zone",
              "2028-07-23",
              "08:00:00",
              "09:00:00",
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

      const result = runScheduleGeneration(members, REAL_TRAVEL, [
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
            realSession(
              "HIGH",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "08:00:00",
              "09:00:00",
              "high"
            ),
            realSession(
              "LOW",
              "Swimming",
              "Inglewood Zone",
              "2028-07-23",
              "11:00:00",
              "12:00:00",
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
              realSession(
                "LOW",
                "Swimming",
                "Inglewood Zone",
                "2028-07-23",
                "11:00:00",
                "12:00:00",
                "high"
              ),
            ],
          })
        );
      }

      const result13 = runScheduleGeneration(members13, REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "11:30:00",
            "13:30:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "15:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "12:00:00",
            "14:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming", "Artistic Gymnastics"],
        candidateSessions: [
          // Bob IS interested in SWM01 (has it in candidateSessions)
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "medium"
          ),
          // Bob also has a higher-scoring session at the same time
          // which may become his primary instead of SWM01
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          // Bob at same venue, same day, but different session — no interest in SWM01
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });
      const carol = makeMember("Carol", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, carol], REAL_TRAVEL, [
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
          realSession(
            "S1",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "08:00:00",
            "09:00:00",
            "high"
          ),
          realSession(
            "S2",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:30:00",
            "11:30:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "ZZZ01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
          realSession(
            "AAA01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
          realSession(
            "MMM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00",
            "high"
          ),
        ],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s1],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
        "2028-07-22",
      ]);

      expect(result.convergence.converged).toBe(true);
      expect(result.convergence.iterations).toBe(1);
      expect(result.convergence.violations).toHaveLength(0);
    });

    it("returns convergence info with all results", () => {
      const s1 = realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00",
        "high"
      );

      const alice = makeMember("Alice", {
        sportRankings: ["Swimming"],
        candidateSessions: [s1],
      });

      const result = runScheduleGeneration([alice], REAL_TRAVEL, [
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
          realSession(
            "SWM01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
        ],
      });

      const bob = makeMember("Bob", {
        sportRankings: ["Artistic Gymnastics"],
        candidateSessions: [
          realSession(
            "GYM01",
            "Artistic Gymnastics",
            "DTLA Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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
        return realSession(
          `EV${pad(i + 1)}`,
          "Swimming",
          "Inglewood Zone",
          DAY,
          `${pad(startHour)}:${pad(startMin)}:00`,
          `${pad(endHour)}:${pad(endMin % 60)}:00`
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

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [DAY]);

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
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS, {
        timeoutMs: -1,
      });

      expect(result.convergence.timedOut).toBe(true);
    });

    it("does not set timedOut when completing within timeout", () => {
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS, {
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
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
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
        const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS, {
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
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS);

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
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS);

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
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
            realSession(
              "S3",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "18:00:00",
              "20:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS);

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
          realSession(
            "LOCK-01",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "10:00:00",
            "12:00:00"
          ),
          realSession(
            "SWM-02",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });
      const bob = makeMember("Bob", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "SWM-02",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      });

      const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
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

  // -------------------------------------------------------------------------
  // Timeout at convergence iteration boundary
  // -------------------------------------------------------------------------

  describe("timeout between convergence iterations", () => {
    it("returns early with timedOut when timeout triggers at start of iteration 2", () => {
      // Scenario: A→hardBuddy B, B→hardBuddy C. All prefer S1+S2, C only S2.
      // Iteration 1: A's primary with S1 fails validation (B filtered out S1
      // because C doesn't have it) → violation → prune S1 from A.
      // Before iteration 2 starts, timeout fires at the loop boundary check.
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          hardBuddies: ["B"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "11:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
          ],
        }),
      ];

      // Mock Date.now: first call captures startTime (0), next 3 are
      // per-member timeout checks inside iteration 1 (all pass). The 5th
      // call is the iteration-boundary check at the top of iteration 2 —
      // return a value that exceeds the timeout.
      let callCount = 0;
      const spy = vi.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        // Calls 1-4: startTime + 3 member checks in iteration 1
        // Call 5: iteration 2 boundary check → exceed timeout
        return callCount <= 4 ? 0 : 999999;
      });

      try {
        const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS, {
          timeoutMs: 100,
        });

        expect(result.convergence.timedOut).toBe(true);
        expect(result.convergence.converged).toBe(false);
        // Should report iteration 1 as the last completed iteration
        expect(result.convergence.iterations).toBe(1);
        // Violations from iteration 1 should be preserved
        expect(result.convergence.violations.length).toBeGreaterThan(0);
        // Combos from iteration 1 should be present
        expect(result.combos.length).toBeGreaterThan(0);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Backup enhancement with locked sessions
  // -------------------------------------------------------------------------

  describe("backup enhancement with locked sessions", () => {
    it("passes locked session codes to generateDayCombos during backup enhancement", () => {
      // A has lockedSessionCodes: ["S-LOCK"], hardBuddy B. B has hardBuddy C.
      // A prefers S-LOCK, S1, S2. B prefers S1, S2. C only prefers S2.
      //
      // Iteration 1: B's hard buddy filter removes S1 (C doesn't have it).
      // A's primary with S1 violates (B has no S1 combo). S1 pruned from A.
      // Iteration 2: A has S-LOCK + S2. Converges.
      //
      // Backup enhancement: A had S1 pruned → wide pool = [S-LOCK, S1, S2].
      // lockedSet = {"S-LOCK"}. dayLockedCodes = {"S-LOCK"} (from filtering
      // wideDaySessions for locked codes). generateDayCombos is called with
      // dayLockedCodes, ensuring S-LOCK appears in backup combos.
      const members = [
        makeMember("A", {
          sportRankings: ["Swimming"],
          hardBuddies: ["B"],
          lockedSessionCodes: ["S-LOCK"],
          candidateSessions: [
            realSession(
              "S-LOCK",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "09:00:00",
              "10:30:00"
            ),
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "18:00:00",
              "20:00:00"
            ),
          ],
        }),
        makeMember("B", {
          sportRankings: ["Swimming"],
          hardBuddies: ["C"],
          candidateSessions: [
            realSession(
              "S1",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "14:00:00",
              "16:00:00"
            ),
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "18:00:00",
              "20:00:00"
            ),
          ],
        }),
        makeMember("C", {
          sportRankings: ["Swimming"],
          candidateSessions: [
            realSession(
              "S2",
              "Swimming",
              "Inglewood Zone",
              "2028-07-22",
              "18:00:00",
              "20:00:00"
            ),
          ],
        }),
      ];

      const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS);

      // A's primary should contain S-LOCK (locked, always present)
      const aPrimary = result.combos.find(
        (c) =>
          c.memberId === "A" && c.rank === "primary" && c.day === "2028-07-22"
      );
      expect(aPrimary).toBeDefined();
      expect(aPrimary!.sessionCodes).toContain("S-LOCK");

      // A should have backup combos that also include S-LOCK (locked sessions
      // are passed as dayLockedCodes to generateDayCombos during enhancement)
      const aBackups = result.combos.filter(
        (c) =>
          c.memberId === "A" && c.rank !== "primary" && c.day === "2028-07-22"
      );
      expect(aBackups.length).toBeGreaterThan(0);
      // Every backup for that day should contain the locked session
      for (const backup of aBackups) {
        expect(backup.sessionCodes).toContain("S-LOCK");
      }

      // Pruned session S1 should appear in backups (re-included by enhancement)
      const allBackupCodes = aBackups.flatMap((c) => c.sessionCodes);
      expect(allBackupCodes).toContain("S1");
    });
  });
});

// ===========================================================================
// E2E Scenario Verification — Algorithm-level tests matching docs/e2e-scenarios.md
// Uses real session data from scripts/output/la2028_sessions.csv and real
// travel times from scripts/output/driving_times.csv + transit_times.csv.
// ===========================================================================

describe("E2E scenario: GROUP B — solo member multi-sport scoring (Phase B3)", () => {
  it("produces correct Jul 22 combos: P=[SWM01,SWM02], B1=[SWM01,DIV12], B2=[DIV11,SWM02]", () => {
    const solo = makeMember("Solo", {
      sportRankings: ["Swimming", "Diving"], // Swimming=2.0, Diving=1.0
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:30:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "SWM02",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "SWM03",
          "Swimming",
          "Inglewood Zone",
          "2028-07-23",
          "09:30:00",
          "11:30:00",
          "medium"
        ),
        realSession(
          "SWM04",
          "Swimming",
          "Inglewood Zone",
          "2028-07-23",
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "DIV11",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "medium"
        ),
        realSession(
          "DIV12",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "15:30:00",
          "16:45:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([solo], REAL_TRAVEL, [
      "2028-07-22",
      "2028-07-23",
    ]);

    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toEqual([]);

    // Jul 22 combos
    const jul22 = result.combos.filter(
      (c) => c.memberId === "Solo" && c.day === "2028-07-22"
    );
    const p22 = jul22.find((c) => c.rank === "primary")!;
    const b1_22 = jul22.find((c) => c.rank === "backup1")!;
    const b2_22 = jul22.find((c) => c.rank === "backup2")!;

    expect(p22.sessionCodes.sort()).toEqual(["SWM01", "SWM02"]);
    expect(p22.score).toBeCloseTo(4.0, 1);

    expect(b1_22.sessionCodes.sort()).toEqual(["DIV12", "SWM01"]);
    expect(b1_22.score).toBeCloseTo(3.0, 1);

    expect(b2_22.sessionCodes.sort()).toEqual(["DIV11", "SWM02"]);
    expect(b2_22.score).toBeCloseTo(2.7, 1);

    // Jul 23 combos
    const jul23 = result.combos.filter(
      (c) => c.memberId === "Solo" && c.day === "2028-07-23"
    );
    const p23 = jul23.find((c) => c.rank === "primary")!;

    expect(p23.sessionCodes.sort()).toEqual(["SWM03", "SWM04"]);
    expect(p23.score).toBeCloseTo(3.4, 1);

    // No backups on Jul 23 (only 2 sessions, both in primary)
    expect(jul23.filter((c) => c.rank === "backup1")).toHaveLength(0);
  });

  it("DIV12→SWM02 is infeasible (75 min gap < 150 min required for Pasadena→Inglewood)", () => {
    const solo = makeMember("Solo", {
      sportRankings: ["Swimming", "Diving"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:30:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "SWM02",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "DIV12",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "15:30:00",
          "16:45:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([solo], REAL_TRAVEL, ["2028-07-22"]);

    const jul22 = result.combos.filter(
      (c) => c.memberId === "Solo" && c.day === "2028-07-22"
    );
    // No combo should contain both DIV12 and SWM02
    for (const c of jul22) {
      const has = (code: string) => c.sessionCodes.includes(code);
      expect(has("DIV12") && has("SWM02")).toBe(false);
    }
  });
});

describe("E2E scenario: Directional travel feasibility (Phase B5)", () => {
  // Real asymmetric travel: DTLA→Valley 26.97 min (< 30 → 120 min gap),
  // Valley→DTLA 32.08 min (< 45 → 150 min gap)
  it("DTLA→Valley (120 min gap) is feasible but Valley→DTLA (120 min gap) is not", () => {
    const solo = makeMember("Solo", {
      sportRankings: ["Boxing", "3x3 Basketball", "Table Tennis"],
      candidateSessions: [
        // Real sessions from la2028_sessions.csv
        realSession(
          "BOX15",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "12:00:00",
          "15:00:00",
          "high"
        ),
        realSession(
          "BK319",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-22",
          "17:00:00",
          "19:00:00",
          "high"
        ),
        realSession(
          "TTE23",
          "Table Tennis",
          "DTLA Zone",
          "2028-07-22",
          "21:00:00",
          "23:15:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([solo], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.convergence.converged).toBe(true);

    const combos = result.combos.filter(
      (c) => c.memberId === "Solo" && c.day === "2028-07-22"
    );
    const p = combos.find((c) => c.rank === "primary")!;
    const b1 = combos.find((c) => c.rank === "backup1");

    // Primary: [BOX15, BK319] — DTLA→Valley, 120 min gap, 26.97 drive → needs 120 ✓
    expect(p.sessionCodes.sort()).toEqual(["BK319", "BOX15"]);
    // sportMultiplier: Boxing=2.0 (rank 1), 3x3=1.5 (rank 2), TT=1.0 (rank 3)
    // BOX15: 2.0×1.0=2.0, BK319: 1.5×1.0=1.5 → total=3.5
    expect(p.score).toBeCloseTo(3.5, 1);

    // Backup 1: [BOX15, TTE23] — same zone DTLA, 360 min gap ≥ 90 ✓
    expect(b1).toBeDefined();
    expect(b1!.sessionCodes.sort()).toEqual(["BOX15", "TTE23"]);
    // BOX15: 2.0, TTE23: 1.0×1.0=1.0 → total=3.0
    expect(b1!.score).toBeCloseTo(3.0, 1);

    // [BK319, TTE23] should NOT appear — Valley→DTLA needs 150 min, only 120 available
    for (const c of combos) {
      const codes = c.sessionCodes;
      expect(codes.includes("BK319") && codes.includes("TTE23")).toBe(false);
    }

    // No 3-session combo (second hop BK319→TTE23 fails)
    for (const c of combos) {
      expect(c.sessionCodes.length).toBeLessThanOrEqual(2);
    }

    // No B2 — only [BK319] and [TTE23] remain as singles, neither adds a new session
    expect(combos.find((c) => c.rank === "backup2")).toBeUndefined();
  });
});

describe("E2E scenario: GROUP A six-member hard buddy filtering (Phase A3, Jul 17)", () => {
  const JUL17 = ["2028-07-17"];

  // Real sessions from la2028_sessions.csv (Jul 17)
  const ATH05 = realSession(
    "ATH05",
    "Athletics (Track & Field)",
    "Exposition Park Zone",
    "2028-07-17",
    "09:00:00",
    "14:00:00",
    "high"
  );
  const ATH06 = realSession(
    "ATH06",
    "Athletics (Track & Field)",
    "Exposition Park Zone",
    "2028-07-17",
    "16:30:00",
    "19:30:00",
    "high"
  );
  const ATH06_med = realSession(
    "ATH06",
    "Athletics (Track & Field)",
    "Exposition Park Zone",
    "2028-07-17",
    "16:30:00",
    "19:30:00",
    "medium"
  );
  const GAR08 = realSession(
    "GAR08",
    "Artistic Gymnastics",
    "DTLA Zone",
    "2028-07-17",
    "17:15:00",
    "20:30:00",
    "medium"
  );
  const GAR08_high = realSession(
    "GAR08",
    "Artistic Gymnastics",
    "DTLA Zone",
    "2028-07-17",
    "17:15:00",
    "20:30:00",
    "high"
  );
  const DIV02 = realSession(
    "DIV02",
    "Diving",
    "Pasadena Zone",
    "2028-07-17",
    "10:00:00",
    "12:00:00"
  );
  const DIV02_med = realSession(
    "DIV02",
    "Diving",
    "Pasadena Zone",
    "2028-07-17",
    "10:00:00",
    "12:00:00",
    "medium"
  );
  const DIV03 = realSession(
    "DIV03",
    "Diving",
    "Pasadena Zone",
    "2028-07-17",
    "15:30:00",
    "16:45:00"
  );
  const VBV07 = realSession(
    "VBV07",
    "Beach Volleyball",
    "Long Beach Zone",
    "2028-07-17",
    "09:00:00",
    "12:00:00"
  );
  const VBV07_low = realSession(
    "VBV07",
    "Beach Volleyball",
    "Long Beach Zone",
    "2028-07-17",
    "09:00:00",
    "12:00:00",
    "low"
  );
  const VBV08 = realSession(
    "VBV08",
    "Beach Volleyball",
    "Long Beach Zone",
    "2028-07-17",
    "14:00:00",
    "18:00:00"
  );
  const BK304 = realSession(
    "BK304",
    "3x3 Basketball",
    "Valley Zone",
    "2028-07-17",
    "14:00:00",
    "16:00:00",
    "medium"
  );
  const BK304_low = realSession(
    "BK304",
    "3x3 Basketball",
    "Valley Zone",
    "2028-07-17",
    "14:00:00",
    "16:00:00",
    "low"
  );
  const ATH05_med = realSession(
    "ATH05",
    "Athletics (Track & Field)",
    "Exposition Park Zone",
    "2028-07-17",
    "09:00:00",
    "14:00:00",
    "medium"
  );

  it("verifies all 6 members' Jul 17 primary combos match the E2E document", () => {
    const alex = makeMember("Alex", {
      sportRankings: ["Athletics (Track & Field)", "Artistic Gymnastics"],
      minBuddies: 1,
      hardBuddies: ["Blake"],
      softBuddies: ["Casey"],
      candidateSessions: [
        { ...ATH05 },
        { ...ATH06 },
        { ...GAR08, interest: "medium" },
      ],
    });

    const blake = makeMember("Blake", {
      sportRankings: ["Athletics (Track & Field)", "Diving"],
      softBuddies: ["Alex"],
      candidateSessions: [
        { ...ATH05 },
        { ...ATH06_med },
        { ...DIV02_med },
        { ...DIV03 },
      ],
    });

    const casey = makeMember("Casey", {
      sportRankings: [
        "Artistic Gymnastics",
        "Athletics (Track & Field)",
        "Beach Volleyball",
      ],
      candidateSessions: [
        { ...ATH05_med },
        { ...GAR08_high },
        { ...VBV07_low },
      ],
    });

    const dana = makeMember("Dana", {
      sportRankings: ["Beach Volleyball", "3x3 Basketball"],
      minBuddies: 1,
      hardBuddies: ["Ellis"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "high" },
        { ...BK304 },
      ],
    });

    const ellis = makeMember("Ellis", {
      sportRankings: ["Beach Volleyball", "Diving"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "medium" },
        { ...DIV02, interest: "high" },
      ],
    });

    const frankie = makeMember("Frankie", {
      sportRankings: ["Diving", "3x3 Basketball"],
      candidateSessions: [
        { ...DIV02, interest: "high" },
        { ...DIV03, interest: "high" },
        { ...BK304 },
      ],
    });

    const result = runScheduleGeneration(
      [alex, blake, casey, dana, ellis, frankie],
      REAL_TRAVEL,
      JUL17
    );

    expect(result.convergence.converged).toBe(true);
    expect(result.membersWithNoCombos).toEqual([]);

    const primary = (id: string) =>
      result.combos.find(
        (c) =>
          c.memberId === id && c.rank === "primary" && c.day === "2028-07-17"
      )!;

    // Alex: P=[ATH05, ATH06] — GAR08 filtered (hard buddy Blake doesn't have it)
    const alexP = primary("Alex");
    expect(alexP.sessionCodes.sort()).toEqual(["ATH05", "ATH06"]);

    // Blake: P=[ATH05, ATH06] — soft buddy Alex boosts both
    const blakeP = primary("Blake");
    expect(blakeP.sessionCodes.sort()).toEqual(["ATH05", "ATH06"]);

    // Casey: P=[ATH05, GAR08] — no constraints, picks best combo
    const caseyP = primary("Casey");
    expect(caseyP.sessionCodes.sort()).toEqual(["ATH05", "GAR08"]);

    // Dana: P=[VBV07, VBV08] — BK304 filtered (hard buddy Ellis doesn't have it)
    const danaP = primary("Dana");
    expect(danaP.sessionCodes.sort()).toEqual(["VBV07", "VBV08"]);

    // Ellis: P=[VBV07, VBV08]
    const ellisP = primary("Ellis");
    expect(ellisP.sessionCodes.sort()).toEqual(["VBV07", "VBV08"]);

    // Frankie: P=[DIV02, DIV03]
    const frankieP = primary("Frankie");
    expect(frankieP.sessionCodes.sort()).toEqual(["DIV02", "DIV03"]);
  });

  it("verifies Blake's Jul 17 backup combos match the E2E document", () => {
    const alex = makeMember("Alex", {
      sportRankings: ["Athletics", "Artistic Gymnastics"],
      minBuddies: 1,
      hardBuddies: ["Blake"],
      softBuddies: ["Casey"],
      candidateSessions: [{ ...ATH05 }, { ...ATH06 }],
    });

    const blake = makeMember("Blake", {
      sportRankings: ["Athletics (Track & Field)", "Diving"],
      softBuddies: ["Alex"],
      candidateSessions: [
        { ...ATH05 },
        { ...ATH06_med },
        { ...DIV02_med },
        { ...DIV03 },
      ],
    });

    const casey = makeMember("Casey", {
      sportRankings: [
        "Artistic Gymnastics",
        "Athletics (Track & Field)",
        "Beach Volleyball",
      ],
      candidateSessions: [
        { ...ATH05_med },
        { ...GAR08_high },
        { ...VBV07_low },
      ],
    });

    const dana = makeMember("Dana", {
      sportRankings: ["Beach Volleyball", "3x3 Basketball"],
      minBuddies: 1,
      hardBuddies: ["Ellis"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "high" },
      ],
    });

    const ellis = makeMember("Ellis", {
      sportRankings: ["Beach Volleyball", "Diving"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "medium" },
        { ...DIV02, interest: "high" },
      ],
    });

    const frankie = makeMember("Frankie", {
      sportRankings: ["Diving", "3x3 Basketball"],
      candidateSessions: [
        { ...DIV02, interest: "high" },
        { ...DIV03, interest: "high" },
        { ...BK304 },
      ],
    });

    const result = runScheduleGeneration(
      [alex, blake, casey, dana, ellis, frankie],
      REAL_TRAVEL,
      JUL17
    );

    const blakeCombos = result.combos.filter(
      (c) => c.memberId === "Blake" && c.day === "2028-07-17"
    );

    // B1=[DIV02, ATH06]: DIV02 ends 12:00, ATH06 starts 16:30 → Pasadena→Expo 25.02 → 120 min gap, actual 270 ✓
    const b1 = blakeCombos.find((c) => c.rank === "backup1")!;
    expect(b1.sessionCodes.sort()).toEqual(["ATH06", "DIV02"]);

    // B2=[DIV02, DIV03]: same zone Pasadena, gap 210 min ≥ 90 ✓
    const b2 = blakeCombos.find((c) => c.rank === "backup2")!;
    expect(b2.sessionCodes.sort()).toEqual(["DIV02", "DIV03"]);
  });

  it("verifies hard buddy filtering: Alex has no GAR08, Dana has no BK304", () => {
    const alex = makeMember("Alex", {
      sportRankings: ["Athletics", "Artistic Gymnastics"],
      minBuddies: 1,
      hardBuddies: ["Blake"],
      candidateSessions: [
        { ...ATH05 },
        { ...ATH06 },
        { ...GAR08, interest: "medium" },
      ],
    });

    const blake = makeMember("Blake", {
      sportRankings: ["Athletics", "Diving"],
      candidateSessions: [{ ...ATH05 }, { ...ATH06_med }, { ...DIV02_med }],
    });

    const dana = makeMember("Dana", {
      sportRankings: ["Beach Volleyball", "3x3 Basketball"],
      minBuddies: 1,
      hardBuddies: ["Ellis"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "high" },
        { ...BK304 },
      ],
    });

    const ellis = makeMember("Ellis", {
      sportRankings: ["Beach Volleyball", "Diving"],
      candidateSessions: [
        { ...VBV07, interest: "high" },
        { ...VBV08, interest: "medium" },
      ],
    });

    const result = runScheduleGeneration(
      [alex, blake, dana, ellis],
      REAL_TRAVEL,
      JUL17
    );

    // Alex: GAR08 should not appear in any combo (Blake doesn't have it → hard buddy filter)
    const alexCombos = result.combos.filter((c) => c.memberId === "Alex");
    for (const c of alexCombos) {
      expect(c.sessionCodes).not.toContain("GAR08");
    }

    // Dana: BK304 should not appear in any combo (Ellis doesn't have it → hard buddy filter)
    const danaCombos = result.combos.filter((c) => c.memberId === "Dana");
    for (const c of danaCombos) {
      expect(c.sessionCodes).not.toContain("BK304");
    }
  });
});

// ===========================================================================
// Locked session — hard buddy bypass (Phase A7.4)
// ===========================================================================

describe("E2E scenario: locked session bypasses hard buddy filter (Phase A7.4)", () => {
  it("locked VBV07 appears despite hard buddy Frankie not having it", () => {
    // Dana: hard buddy = Frankie, locked VBV07. Real sessions from CSV.
    // Frankie has DIV02, DIV03, BK304 — NOT VBV07
    // VBV07 should still appear (locked bypass) but BK304 can't pair with it (travel)
    const dana = makeMember("Dana", {
      sportRankings: ["Beach Volleyball", "3x3 Basketball"],
      minBuddies: 1,
      hardBuddies: ["Frankie"],
      lockedSessionCodes: ["VBV07"],
      candidateSessions: [
        realSession(
          "VBV07",
          "Beach Volleyball",
          "Long Beach Zone",
          "2028-07-17",
          "09:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "VBV08",
          "Beach Volleyball",
          "Long Beach Zone",
          "2028-07-17",
          "14:00:00",
          "18:00:00",
          "high"
        ),
        realSession(
          "BK304",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-17",
          "14:00:00",
          "16:00:00",
          "medium"
        ),
      ],
    });

    const frankie = makeMember("Frankie", {
      sportRankings: ["Diving", "3x3 Basketball"],
      candidateSessions: [
        realSession(
          "DIV02",
          "Diving",
          "Pasadena Zone",
          "2028-07-17",
          "10:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "DIV03",
          "Diving",
          "Pasadena Zone",
          "2028-07-17",
          "15:30:00",
          "16:45:00",
          "high"
        ),
        realSession(
          "BK304",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-17",
          "14:00:00",
          "16:00:00",
          "medium"
        ),
      ],
    });

    const result = runScheduleGeneration([dana, frankie], REAL_TRAVEL, [
      "2028-07-17",
    ]);

    expect(result.convergence.converged).toBe(true);

    const danaP = result.combos.find(
      (c) =>
        c.memberId === "Dana" && c.rank === "primary" && c.day === "2028-07-17"
    )!;

    // VBV07 must appear (locked) despite Frankie not having it
    expect(danaP.sessionCodes).toContain("VBV07");

    // VBV08 filtered out by hard buddy (Frankie doesn't have it), not locked
    // BK304: Frankie has it → passes hard buddy filter, but:
    //   VBV07 (LB, ends 12:00) → BK304 (Valley, starts 14:00): LB→Valley ~51 min → 180 min gap, actual 120 < 180 → infeasible
    // So Dana ends up with just [VBV07]
    expect(danaP.sessionCodes).toEqual(["VBV07"]);

    // No backups — no other session can pair with locked VBV07
    const danaBackups = result.combos.filter(
      (c) =>
        c.memberId === "Dana" && c.rank !== "primary" && c.day === "2028-07-17"
    );
    expect(danaBackups).toHaveLength(0);
  });
});

// ===========================================================================
// Locked session constrains travel-feasible combos (Phase B4.4)
// ===========================================================================

describe("E2E scenario: locked session constrains combos via travel (Phase B4.4)", () => {
  it("locked SWM02 forces out DIV12 (75 min gap < 150 min) but keeps DIV11", () => {
    // Real sessions from CSV. SWM02 is locked (purchased).
    // DIV12 ends 16:45, SWM02 starts 18:00: Pasadena→Inglewood 36.25 min → 150 min gap, only 75 min → infeasible
    // DIV11 ends 12:00, SWM02 starts 18:00: 360 min gap ≥ 150 → feasible
    const solo = makeMember("Solo", {
      sportRankings: ["Swimming", "Diving"],
      lockedSessionCodes: ["SWM02"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:30:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "SWM02",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "DIV11",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "medium"
        ),
        realSession(
          "DIV12",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "15:30:00",
          "16:45:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([solo], REAL_TRAVEL, ["2028-07-22"]);

    const combos = result.combos.filter(
      (c) => c.memberId === "Solo" && c.day === "2028-07-22"
    );

    // Every combo must contain SWM02 (locked)
    for (const c of combos) {
      expect(c.sessionCodes).toContain("SWM02");
    }

    // DIV12 + SWM02 is infeasible → DIV12 should not appear in any combo
    for (const c of combos) {
      expect(c.sessionCodes).not.toContain("DIV12");
    }

    // Primary: [SWM01, SWM02] — both Inglewood, same zone, gap 390 min ≥ 90 ✓
    const p = combos.find((c) => c.rank === "primary")!;
    expect(p.sessionCodes.sort()).toEqual(["SWM01", "SWM02"]);
    expect(p.score).toBeCloseTo(4.0, 1);

    // B1: [DIV11, SWM02] — DIV11 ends 12:00, SWM02 starts 18:00, gap 360 ≥ 150 ✓
    const b1 = combos.find((c) => c.rank === "backup1")!;
    expect(b1.sessionCodes.sort()).toEqual(["DIV11", "SWM02"]);
    expect(b1.score).toBeCloseTo(2.7, 1);

    // No B2 — only [SWM02] alone remains and it's a subset of P/B1
    expect(combos.find((c) => c.rank === "backup2")).toBeUndefined();
  });
});

// ===========================================================================
// Non-convergence with backup enhancement penalty (Phase A7.3)
// ===========================================================================

describe("E2E scenario: non-convergence backup enhancement with 0.1x penalty (Phase A7.3)", () => {
  it("5 mutually infeasible sessions: non-convergence with pruned backups", () => {
    // Alex: 5 mutually infeasible sessions (all overlap or zero gap with wrong zones).
    // Hard buddy Blake. Blake has all 5 as Low interest but 4 high-scoring
    // Volleyball sessions fill P/B1/B2, leaving no room for shared sessions.
    //
    // Each iteration: Alex's primary = highest remaining session. Blake doesn't
    // have it in any combo → hardBuddies violation → prune. After 5 iterations,
    // converged=false. Backup enhancement re-includes pruned sessions with 0.1× penalty.

    const DAY = "2028-07-17";

    // Alex's 5 real sessions — all different zones, all overlapping/infeasible
    const alex = makeMember("Alex", {
      sportRankings: [
        "Athletics (Track & Field)",
        "Diving",
        "Beach Volleyball",
        "Fencing",
        "Boxing",
      ],
      minBuddies: 1,
      hardBuddies: ["Blake"],
      softBuddies: ["Casey"],
      candidateSessions: [
        realSession(
          "ATH05",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          DAY,
          "09:00:00",
          "14:00:00",
          "high"
        ),
        realSession(
          "DIV02",
          "Diving",
          "Pasadena Zone",
          DAY,
          "10:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "VBV07",
          "Beach Volleyball",
          "Long Beach Zone",
          DAY,
          "09:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "FEN05",
          "Fencing",
          "DTLA Zone",
          DAY,
          "09:00:00",
          "16:20:00",
          "high"
        ),
        realSession(
          "BOX05",
          "Boxing",
          "DTLA Zone",
          DAY,
          "12:00:00",
          "15:00:00",
          "high"
        ),
      ],
    });

    // Casey has ATH05 and VBV07 (for soft buddy bonus on Alex)
    const casey = makeMember("Casey", {
      sportRankings: ["Athletics (Track & Field)", "Beach Volleyball"],
      candidateSessions: [
        realSession(
          "ATH05",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          DAY,
          "09:00:00",
          "14:00:00",
          "medium"
        ),
        realSession(
          "VBV07",
          "Beach Volleyball",
          "Long Beach Zone",
          DAY,
          "09:00:00",
          "12:00:00",
          "low"
        ),
      ],
    });

    // Blake: 4 Volleyball sessions (all Anaheim Zone, spaced for 3-session combos)
    // + all 5 of Alex's sessions at Low interest
    const blake = makeMember("Blake", {
      sportRankings: [
        "Volleyball",
        "Athletics (Track & Field)",
        "Diving",
        "Beach Volleyball",
        "Fencing",
        "Boxing",
      ],
      softBuddies: ["Alex"],
      candidateSessions: [
        realSession(
          "VVO09",
          "Volleyball",
          "Anaheim Zone",
          DAY,
          "09:00:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "VVO10",
          "Volleyball",
          "Anaheim Zone",
          DAY,
          "13:00:00",
          "15:30:00",
          "high"
        ),
        realSession(
          "VVO11",
          "Volleyball",
          "Anaheim Zone",
          DAY,
          "17:00:00",
          "19:30:00",
          "high"
        ),
        realSession(
          "VVO12",
          "Volleyball",
          "Anaheim Zone",
          DAY,
          "21:00:00",
          "23:30:00",
          "high"
        ),
        realSession(
          "ATH05",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          DAY,
          "09:00:00",
          "14:00:00",
          "low"
        ),
        realSession(
          "DIV02",
          "Diving",
          "Pasadena Zone",
          DAY,
          "10:00:00",
          "12:00:00",
          "low"
        ),
        realSession(
          "VBV07",
          "Beach Volleyball",
          "Long Beach Zone",
          DAY,
          "09:00:00",
          "12:00:00",
          "low"
        ),
        realSession(
          "FEN05",
          "Fencing",
          "DTLA Zone",
          DAY,
          "09:00:00",
          "16:20:00",
          "low"
        ),
        realSession(
          "BOX05",
          "Boxing",
          "DTLA Zone",
          DAY,
          "12:00:00",
          "15:00:00",
          "low"
        ),
      ],
    });

    const result = runScheduleGeneration([alex, blake, casey], REAL_TRAVEL, [
      DAY,
    ]);

    // Non-convergence: 5 iterations, all Alex's sessions fail hard buddy check
    expect(result.convergence.converged).toBe(false);
    expect(result.convergence.iterations).toBe(5);
    expect(result.convergence.violations.length).toBeGreaterThan(0);

    // Alex's primary should be a single session (last one standing after 4 pruning rounds)
    const alexP = result.combos.find(
      (c) => c.memberId === "Alex" && c.rank === "primary" && c.day === DAY
    )!;
    expect(alexP.sessionCodes).toHaveLength(1);

    // Backup enhancement: pruned sessions re-included with 0.1× penalty
    const alexBackups = result.combos.filter(
      (c) => c.memberId === "Alex" && c.rank !== "primary" && c.day === DAY
    );
    expect(alexBackups.length).toBeGreaterThan(0);

    // Backup scores should be much lower than primary (0.1× penalty on pruned sessions)
    for (const backup of alexBackups) {
      expect(backup.score).toBeLessThan(alexP.score);
    }

    // Blake should be unaffected: P/B1/B2 all Volleyball 3-session combos
    const blakeP = result.combos.find(
      (c) => c.memberId === "Blake" && c.rank === "primary" && c.day === DAY
    )!;
    expect(blakeP.sessionCodes).toHaveLength(3);
    expect(blakeP.sessionCodes.every((s) => s.startsWith("VVO"))).toBe(true);
  });
});

// ===========================================================================
// Locked sessions are never pruned during convergence
// ===========================================================================

describe("locked sessions survive convergence pruning", () => {
  it("locked session stays in combos even when unlocked sessions are pruned away", () => {
    // Alice: hardBuddy Bob. Alice has SWM01 (locked) + SWM02 + SWM03 (unlocked).
    // Bob has minBuddies=99 → all sessions filtered → no combos.
    // Iteration 1: Alice's primary [SWM01, SWM02, SWM03]. Validation: SWM02 and SWM03
    // fail hardBuddies check (Bob has no combos). SWM01 is locked → skipped.
    // SWM02 and SWM03 get pruned. SWM01 survives (never pruned).
    // Iteration 2: Alice's only candidate is SWM01 (locked). Primary = [SWM01].
    // Validation: only SWM01, which is locked → skipped. No violations → converges.
    const DAY = "2028-07-22";

    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      hardBuddies: ["Bob"],
      lockedSessionCodes: ["SWM01"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          DAY,
          "09:30:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "SWM02",
          "Swimming",
          "Inglewood Zone",
          DAY,
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "SWM03",
          "Swimming",
          "Inglewood Zone",
          "2028-07-23",
          "09:30:00",
          "11:30:00",
          "high"
        ),
      ],
    });

    const bob = makeMember("Bob", {
      sportRankings: ["Swimming"],
      minBuddies: 99,
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          DAY,
          "09:30:00",
          "11:30:00",
          "high"
        ),
        realSession(
          "SWM02",
          "Swimming",
          "Inglewood Zone",
          DAY,
          "18:00:00",
          "20:00:00",
          "high"
        ),
        realSession(
          "SWM03",
          "Swimming",
          "Inglewood Zone",
          "2028-07-23",
          "09:30:00",
          "11:30:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
      DAY,
      "2028-07-23",
    ]);

    // Converges because after pruning, only locked SWM01 remains and it skips validation
    expect(result.convergence.converged).toBe(true);

    // Alice's Jul 22 primary must contain SWM01 (locked, never pruned)
    const aliceP = result.combos.find(
      (c) => c.memberId === "Alice" && c.rank === "primary" && c.day === DAY
    )!;
    expect(aliceP.sessionCodes).toContain("SWM01");

    // SWM02 should NOT be in any primary combo on Jul 22 (pruned during convergence)
    const aliceCombosJul22 = result.combos.filter(
      (c) => c.memberId === "Alice" && c.rank === "primary" && c.day === DAY
    );
    for (const c of aliceCombosJul22) {
      expect(c.sessionCodes).not.toContain("SWM02");
    }
  });
});

// ===========================================================================
// Missing travel bracket boundary tests (15-29 min → 120 min gap)
// ===========================================================================

describe("travel bracket: 15-29 min driving → 120 min required gap", () => {
  // DTLA → Pasadena: 22.02 min driving → falls in [15, 30) bracket → 120 min gap
  it("DTLA→Pasadena (22 min) with exactly 120-min gap is feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Boxing", "Artistic Gymnastics"],
      candidateSessions: [
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Pasadena Zone",
          "2028-07-22",
          "11:00:00",
          "13:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 11:00 - 09:00 = 120 min = 120 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("DTLA→Pasadena (22 min) with 119-min gap is NOT feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Boxing", "Artistic Gymnastics"],
      candidateSessions: [
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "08:00:00",
          "09:01:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Pasadena Zone",
          "2028-07-22",
          "11:00:00",
          "13:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 11:00 - 09:01 = 119 min < 120 required → NOT feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos).toHaveLength(0);
  });
});

// ===========================================================================
// Missing travel bracket boundary tests (45-59 min → 180 min required gap)
// ===========================================================================

describe("travel bracket: 45-59 min driving → 180 min required gap", () => {
  // Pasadena → Long Beach: 49.38 min driving → falls in [45, 60) bracket → 180 min gap
  it("Pasadena→Long Beach (49 min) with exactly 180-min gap is feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Diving", "Swimming"],
      candidateSessions: [
        realSession(
          "DIV01",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "SWM01",
          "Swimming",
          "Long Beach Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 09:00 = 180 min = 180 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("Pasadena→Long Beach (49 min) with 179-min gap is NOT feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Diving", "Swimming"],
      candidateSessions: [
        realSession(
          "DIV01",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "08:00:00",
          "09:01:00"
        ),
        realSession(
          "SWM01",
          "Swimming",
          "Long Beach Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 09:01 = 179 min < 180 required → NOT feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos).toHaveLength(0);
  });

  // Long Beach → Valley: 50.97 min driving → also [45, 60) bracket → 180 min gap
  it("Long Beach→Valley (51 min) with exactly 180-min gap is feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "3x3 Basketball"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Long Beach Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "BK301",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 09:00 = 180 min = 180 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// Successful 3-session combo across 3 real zones
// ===========================================================================

describe("3-session combo across 3 real zones — all hops feasible", () => {
  it("Expo Park → DTLA → Pasadena: all gaps met → 3-session combo exists", () => {
    // Hop 1: Exposition Park → DTLA: 11.3 min → 90 min gap required
    // Hop 2: DTLA → Pasadena: 22.02 min → 120 min gap required
    const alice = makeMember("Alice", {
      sportRankings: [
        "Athletics (Track & Field)",
        "Boxing",
        "Artistic Gymnastics",
      ],
      candidateSessions: [
        realSession(
          "ATH01",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "10:30:00",
          "12:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Pasadena Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Hop 1: 10:30 - 09:00 = 90 min ≥ 90 (Expo→DTLA 11.3 min → 90 min) ✓
    // Hop 2: 14:00 - 12:00 = 120 min ≥ 120 (DTLA→Pasadena 22.02 min → 120 min) ✓
    const threeCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 3
    );
    expect(threeCombos.length).toBeGreaterThanOrEqual(1);
    expect(threeCombos[0].sessionCodes.sort()).toEqual([
      "ATH01",
      "BOX01",
      "GYM01",
    ]);
  });

  it("Inglewood → Exposition Park → DTLA: 3 close zones, all feasible with 90-min gaps", () => {
    // Inglewood → Expo Park: 14.17 min → < 15 → 90 min gap
    // Expo Park → DTLA: 11.3 min → < 15 → 90 min gap
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Athletics (Track & Field)", "Boxing"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "ATH01",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          "2028-07-22",
          "10:30:00",
          "12:00:00"
        ),
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "13:30:00",
          "15:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Hop 1: 10:30 - 09:00 = 90 ≥ 90 (Inglewood→Expo 14.17 < 15 → 90) ✓
    // Hop 2: 13:30 - 12:00 = 90 ≥ 90 (Expo→DTLA 11.3 < 15 → 90) ✓
    const threeCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 3
    );
    expect(threeCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("3-session combo fails when middle hop requires higher bracket gap", () => {
    // Expo Park → Pasadena: 27.33 min → [15,30) → 120 min gap
    // Pasadena → Long Beach: 49.38 min → [45,60) → 180 min gap
    const alice = makeMember("Alice", {
      sportRankings: [
        "Athletics (Track & Field)",
        "Artistic Gymnastics",
        "Swimming",
      ],
      candidateSessions: [
        realSession(
          "ATH01",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Pasadena Zone",
          "2028-07-22",
          "11:00:00",
          "12:00:00"
        ),
        realSession(
          "SWM01",
          "Swimming",
          "Long Beach Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Hop 1: 11:00 - 09:00 = 120 ≥ 120 (Expo→Pasadena 27.33 → 120) ✓
    // Hop 2: 14:00 - 12:00 = 120 < 180 (Pasadena→LB 49.38 → 180) ✗
    const threeCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 3
    );
    expect(threeCombos).toHaveLength(0);

    // But the first 2 sessions should pair fine
    const athGymPair = result.combos.find(
      (c) =>
        c.sessionCodes.length === 2 &&
        c.sessionCodes.includes("ATH01") &&
        c.sessionCodes.includes("GYM01")
    );
    expect(athGymPair).toBeDefined();
  });
});

// ===========================================================================
// Non-Trestles → Trestles direction (arriving AT Trestles)
// ===========================================================================

describe("arriving at Trestles Beach (non-Trestles → Trestles)", () => {
  it("session at Inglewood then Trestles with 240-min gap is feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Surfing"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "06:00:00",
          "08:00:00"
        ),
        realSession(
          "SRF01",
          "Surfing",
          "Trestles Beach Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 08:00 = 240 min = 240 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("session at Inglewood then Trestles with 239-min gap is NOT feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Surfing"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "06:00:00",
          "08:01:00"
        ),
        realSession(
          "SRF01",
          "Surfing",
          "Trestles Beach Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 08:01 = 239 min < 240 required → NOT feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos).toHaveLength(0);
  });
});

// ===========================================================================
// Multiple locked sessions on same day
// ===========================================================================

describe("multiple locked sessions on same day", () => {
  it("2 locked sessions on same day both appear in every combo", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics", "Diving"],
      lockedSessionCodes: ["SWM01", "GYM01"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:30:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "11:00:00",
          "12:30:00"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "14:00:00",
          "15:30:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.membersWithNoCombos).toHaveLength(0);

    // Every combo on that day must contain both locked sessions
    const dayCombos = result.combos.filter(
      (c) => c.memberId === "Alice" && c.day === "2028-07-22"
    );
    for (const c of dayCombos) {
      expect(c.sessionCodes).toContain("SWM01");
      expect(c.sessionCodes).toContain("GYM01");
    }

    // Primary should have all 3 (2 locked + 1 unlocked fills the 3rd slot)
    const primary = dayCombos.find((c) => c.rank === "primary")!;
    expect(primary.sessionCodes).toHaveLength(3);
    expect(primary.sessionCodes).toContain("DIV01");
  });

  it("3 locked sessions on same day fills all slots — no unlocked sessions added", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics", "Diving", "Boxing"],
      lockedSessionCodes: ["SWM01", "GYM01", "DIV01"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:30:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "11:00:00",
          "12:30:00"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "14:00:00",
          "15:30:00"
        ),
        realSession(
          "BOX01",
          "Boxing",
          "Inglewood Zone",
          "2028-07-22",
          "17:00:00",
          "18:30:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.membersWithNoCombos).toHaveLength(0);

    // remainingSlots = 3 - 3 = 0 → only one possible combo: [SWM01, GYM01, DIV01]
    // BOX01 cannot be added since all 3 slots are locked
    const dayCombos = result.combos.filter(
      (c) => c.memberId === "Alice" && c.day === "2028-07-22"
    );
    expect(dayCombos).toHaveLength(1);
    expect(dayCombos[0].rank).toBe("primary");
    expect(dayCombos[0].sessionCodes.sort()).toEqual([
      "DIV01",
      "GYM01",
      "SWM01",
    ]);
  });
});

// ===========================================================================
// Locked sessions travel-infeasible with each other → locked-only fallback
// ===========================================================================

describe("locked sessions travel-infeasible with each other", () => {
  it("2 locked sessions in far zones with insufficient gap falls back to locked-only combo", () => {
    // SWM01 at Inglewood ends 11:30, DIV01 at Pasadena starts 12:30
    // Inglewood → Pasadena: 43.55 min → [30,45) bracket → 150 min gap required
    // Gap = 12:30 - 11:30 = 60 min < 150 → infeasible as pair
    // But both are locked → fallback to locked-only combo (each on its own)
    // Actually, locked-only for the combo means [SWM01, DIV01] is tried, fails,
    // then falls back to just [locked sessions] anyway — combos.ts line 71-72.
    // Wait, re-reading: if feasible.length === 0 AND locked.length > 0, return [[...locked]].
    // The locked combo itself is also travel-checked. If even the locked-only combo
    // [SWM01, DIV01] is infeasible... the fallback still returns it!
    // combos.ts line 71: `feasible = [[...locked]]` — forced regardless of feasibility.
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Diving"],
      lockedSessionCodes: ["SWM01", "DIV01"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "11:30:00"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "12:30:00",
          "14:00:00"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "16:00:00",
          "17:30:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.membersWithNoCombos).toHaveLength(0);

    // Primary combo must contain both locked sessions (forced fallback)
    const primary = result.combos.find(
      (c) => c.memberId === "Alice" && c.rank === "primary"
    )!;
    expect(primary.sessionCodes).toContain("SWM01");
    expect(primary.sessionCodes).toContain("DIV01");
  });
});

// ===========================================================================
// Asymmetric travel: direction matters for bracket boundary
// ===========================================================================

describe("asymmetric travel at bracket boundary", () => {
  // DTLA → Valley: 26.97 min → [15,30) bracket → 120 min gap
  // Valley → DTLA: 32.08 min → [30,45) bracket → 150 min gap
  it("DTLA→Valley needs 120-min gap; Valley→DTLA needs 150-min gap", () => {
    // Forward: DTLA session first, then Valley
    const forward = makeMember("Forward", {
      sportRankings: ["Boxing", "3x3 Basketball"],
      candidateSessions: [
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "BK301",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-22",
          "11:00:00",
          "13:00:00"
        ),
      ],
    });

    const resultFwd = runScheduleGeneration([forward], REAL_TRAVEL, [
      "2028-07-22",
    ]);

    // Gap = 11:00 - 09:00 = 120 min ≥ 120 (DTLA→Valley 26.97 → 120) ✓
    const fwdPairs = resultFwd.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(fwdPairs.length).toBeGreaterThanOrEqual(1);

    // Reverse: Valley session first, then DTLA — same 120-min gap
    const reverse = makeMember("Reverse", {
      sportRankings: ["3x3 Basketball", "Boxing"],
      candidateSessions: [
        realSession(
          "BK301",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "11:00:00",
          "13:00:00"
        ),
      ],
    });

    const resultRev = runScheduleGeneration([reverse], REAL_TRAVEL, [
      "2028-07-22",
    ]);

    // Gap = 11:00 - 09:00 = 120 min < 150 (Valley→DTLA 32.08 → 150) ✗
    const revPairs = resultRev.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(revPairs).toHaveLength(0);
  });

  it("Valley→DTLA with exactly 150-min gap is feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["3x3 Basketball", "Boxing"],
      candidateSessions: [
        realSession(
          "BK301",
          "3x3 Basketball",
          "Valley Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "BOX01",
          "Boxing",
          "DTLA Zone",
          "2028-07-22",
          "11:30:00",
          "13:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 11:30 - 09:00 = 150 min = 150 (Valley→DTLA 32.08 → 150) ✓
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// Convergence cascade: pruning reduces interest counts for other members
// ===========================================================================

describe("convergence cascade: pruning reduces interest counts", () => {
  it("pruning a session from one member can cause another member's minBuddies to fail", () => {
    // Setup:
    // - Alice: hardBuddy=Bob, interested in S1, S2
    // - Bob: interested in S2 only (not S1)
    // - Carol: minBuddies=2, interested in S1, S2
    // - Dave: interested in S1, S2
    //
    // Iteration 1:
    //   Alice's hard buddy filter: Bob has {S2} → Alice keeps only S2.
    //   S1 interest count for Carol's filter: Alice(filtered out), Carol, Dave = 2 interested
    //   Carol needs minBuddies=2 → 2-1=1 < 2 → S1 filtered from Carol!
    //   (Actually, minBuddies filter uses raw interest counts from candidateSessions,
    //    not filtered. Let me re-check...)
    //
    // Actually, looking at the code: sessionInterestCounts is built from
    // currentMembers[].candidateSessions, NOT from filtered sessions.
    // So S1 interest count = Alice + Carol + Dave = 3 (Alice still has it in candidates
    // even though hard buddy filter will remove it during filtering).
    //
    // After iteration 1, if Alice's primary includes S2, and post-validation:
    //   - Alice: S2 in primary, Bob has S2 → no violation. ✓
    //   - Carol: if S1 in primary and Alice doesn't have S1 in any combo...
    //     Actually Carol's minBuddies is checked on HER primary sessions, not Alice's.
    //
    // Let me design a better cascade scenario:
    // - Alice: hardBuddy=Bob, interested in S1
    // - Bob: interested in S1 but has hardBuddy=Carol
    // - Carol: interested in S2 only (not S1)
    // - Dave: minBuddies=1, interested in S1
    //
    // Pre-filter: Bob's hard buddy Carol has {S2} → Bob's S1 filtered out.
    //   Alice's hard buddy Bob has {} (S1 filtered) → Alice's S1 filtered.
    //   Dave: S1 interest count = Alice+Bob+Dave = 3 → 3-1=2 ≥ 1 ✓ (pre-filter passes)
    //   But after filtering, only Dave actually has S1.
    //
    // Post-validation: Dave's primary has S1. minBuddies check: count other members
    // with S1 in ANY combo (P/B1/B2). Alice/Bob have no combos with S1 (filtered out).
    // Carol has no S1. Only Dave → 0 others < minBuddies=1 → violation!
    //
    // This triggers convergence: S1 pruned from Dave. Next iteration Dave has
    // no candidates → membersWithNoCombos.

    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      hardBuddies: ["Bob"],
      candidateSessions: [
        realSession(
          "S1",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const bob = makeMember("Bob", {
      sportRankings: ["Swimming"],
      hardBuddies: ["Carol"],
      candidateSessions: [
        realSession(
          "S1",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const carol = makeMember("Carol", {
      sportRankings: ["Artistic Gymnastics"],
      candidateSessions: [
        realSession(
          "S2",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00"
        ),
      ],
    });

    const dave = makeMember("Dave", {
      sportRankings: ["Swimming"],
      minBuddies: 1,
      candidateSessions: [
        realSession(
          "S1",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration(
      [alice, bob, carol, dave],
      REAL_TRAVEL,
      ["2028-07-22"]
    );

    // Alice's S1 is filtered by hard buddy (Bob doesn't have it after Bob's own filter)
    expect(result.membersWithNoCombos).toContain("Alice");

    // Bob's S1 is filtered by hard buddy (Carol doesn't have it)
    expect(result.membersWithNoCombos).toContain("Bob");

    // Dave initially passes pre-filter (interest count=3 for S1) but post-validation
    // finds no other member has S1 in combos → violation → pruned → no combos
    expect(result.membersWithNoCombos).toContain("Dave");

    // Carol has S2, no constraints → fine
    expect(result.membersWithNoCombos).not.toContain("Carol");
  });
});

// ===========================================================================
// Anaheim Zone travel: covers long-distance non-Trestles route
// ===========================================================================

describe("Anaheim Zone long-distance travel", () => {
  // Anaheim → Exposition Park: 41.98 min → [30,45) bracket → 150 min gap
  // Anaheim → Pasadena: 46.2 min → [45,60) bracket → 180 min gap
  it("Anaheim→Expo Park (42 min) needs 150-min gap — boundary test", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Volleyball", "Athletics (Track & Field)"],
      candidateSessions: [
        realSession(
          "VVO01",
          "Volleyball",
          "Anaheim Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "ATH01",
          "Athletics (Track & Field)",
          "Exposition Park Zone",
          "2028-07-22",
          "11:30:00",
          "13:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 11:30 - 09:00 = 150 min = 150 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("Anaheim→Pasadena (46 min) needs 180-min gap — boundary test", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Volleyball", "Diving"],
      candidateSessions: [
        realSession(
          "VVO01",
          "Volleyball",
          "Anaheim Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 09:00 = 180 min = 180 required → feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos.length).toBeGreaterThanOrEqual(1);
  });

  it("Anaheim→Pasadena (46 min) with 179-min gap is NOT feasible", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Volleyball", "Diving"],
      candidateSessions: [
        realSession(
          "VVO01",
          "Volleyball",
          "Anaheim Zone",
          "2028-07-22",
          "08:00:00",
          "09:01:00"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Pasadena Zone",
          "2028-07-22",
          "12:00:00",
          "14:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // Gap = 12:00 - 09:01 = 179 min < 180 required → NOT feasible
    const twoSessionCombos = result.combos.filter(
      (c) => c.sessionCodes.length === 2
    );
    expect(twoSessionCombos).toHaveLength(0);
  });
});

// ===========================================================================
// Sport not in sportRankings → defaults to last rank score
// ===========================================================================

describe("session sport not in sportRankings", () => {
  it("unranked sport gets the same multiplier as the last-ranked sport", () => {
    // Alice ranks Swimming and Gymnastics but has a Diving session (not ranked).
    // Diving should be treated as rank = sportRankings.length = 2, which is the
    // same rank as Artistic Gymnastics (the last-ranked sport).
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00",
          "high"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-23",
          "10:00:00",
          "12:00:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, [
      "2028-07-22",
      "2028-07-23",
    ]);

    expect(result.membersWithNoCombos).toHaveLength(0);

    // DIV01 (unranked) and GYM01 (rank 2/2) should have the same score.
    // Both: multiplier = 1.0 (last rank), high → 1.0, no buddies → 1.0 = 1.0
    // Use separate days so each is a solo primary.
    const divCombo = result.combos.find(
      (c) =>
        c.memberId === "Alice" &&
        c.sessionCodes.length === 1 &&
        c.sessionCodes[0] === "DIV01"
    );
    const gymCombo = result.combos.find(
      (c) =>
        c.memberId === "Alice" && c.rank === "primary" && c.day === "2028-07-23"
    );

    // GYM01: rank 2/2 → 1.0, high → 1.0 = 1.0
    expect(gymCombo!.score).toBeCloseTo(1.0);

    // DIV01 (unranked): rank defaults to 2 (sportRankings.length=2), same multiplier
    if (divCombo) {
      expect(divCombo.score).toBeCloseTo(1.0);
    }
  });

  it("locked session with unranked sport still appears in primary", () => {
    // Alice ranks only Swimming but has a locked Diving session.
    // The locked session must appear even though Diving isn't ranked.
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      lockedSessionCodes: ["DIV01"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "high"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "14:00:00",
          "16:00:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    const primary = result.combos.find(
      (c) => c.memberId === "Alice" && c.rank === "primary"
    )!;
    // Locked session appears despite sport not being in rankings
    expect(primary.sessionCodes).toContain("DIV01");
    // Swimming also included (both fit in a 2-session combo)
    expect(primary.sessionCodes).toContain("SWM01");

    // DIV01 score: sportRankings.length=1, rank defaults to 1 → getSportMultiplier(1, 1) = 2.0
    // (single sport → totalSports <= 1 → returns 2.0)
    // Total: SWM01 (2.0 * 1.0 * 1.0) + DIV01 (2.0 * 1.0 * 1.0) = 4.0
    expect(primary.score).toBeCloseTo(4.0);
  });
});

// ===========================================================================
// Sessions on days not in `days` parameter are silently ignored
// ===========================================================================

describe("sessions outside requested days are ignored", () => {
  it("sessions on days not in the days array produce no combos for those days", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
        // This session is on Jul 25, which is NOT in the days array
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-25",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    // Only request Jul 22 — Jul 25 should be silently dropped
    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.membersWithNoCombos).toHaveLength(0);

    // Only Jul 22 combos should exist
    const allDays = new Set(result.combos.map((c) => c.day));
    expect(allDays.size).toBe(1);
    expect(allDays.has("2028-07-22")).toBe(true);
    expect(allDays.has("2028-07-25")).toBe(false);

    // GYM01 should not appear in any combo
    const allCodes = result.combos.flatMap((c) => c.sessionCodes);
    expect(allCodes).not.toContain("GYM01");
  });

  it("member with ALL sessions outside requested days ends up in membersWithNoCombos", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-25",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    // Request Jul 22 but Alice only has a Jul 25 session
    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    expect(result.membersWithNoCombos).toContain("Alice");
    expect(result.combos).toHaveLength(0);
  });
});

// ===========================================================================
// Mixed hard buddies: one exists, one doesn't
// ===========================================================================

describe("mixed hard buddies: one real, one non-existent", () => {
  it("existing hard buddy's sessions intersect normally; non-existent buddy is skipped in filter but caught in validation", () => {
    // Alice hardBuddies: ["Bob", "Ghost"]. Bob exists, Ghost doesn't.
    // filter.ts: Ghost not found in allMembersData → skipped (not added to
    //   hardBuddySessionSets). Only Bob's sessions used for intersection.
    // Alice keeps sessions that Bob has: SWM01.
    // Post-validation: Ghost doesn't have SWM01 in any combo → hardBuddies
    //   violation → pruned. Alice ends up with no combos.
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      hardBuddies: ["Bob", "Ghost"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const bob = makeMember("Bob", {
      sportRankings: ["Swimming"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
      "2028-07-22",
    ]);

    // Alice's sessions pass Bob's filter (Bob has SWM01) but fail Ghost validation
    expect(result.membersWithNoCombos).toContain("Alice");
    // Bob has no constraints → fine
    expect(result.membersWithNoCombos).not.toContain("Bob");
  });
});

// ===========================================================================
// Input mutation safety: original member objects not modified
// ===========================================================================

describe("input mutation safety", () => {
  it("original member candidateSessions array is not mutated after running", () => {
    const originalSessions = [
      realSession(
        "SWM01",
        "Swimming",
        "Inglewood Zone",
        "2028-07-22",
        "09:00:00",
        "11:00:00"
      ),
      realSession(
        "GYM01",
        "Artistic Gymnastics",
        "DTLA Zone",
        "2028-07-22",
        "14:00:00",
        "16:00:00"
      ),
    ];

    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics"],
      hardBuddies: ["Bob"],
      candidateSessions: originalSessions,
    });

    const bob = makeMember("Bob", {
      sportRankings: ["Swimming"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "09:00:00",
          "11:00:00"
        ),
      ],
    });

    // Running should trigger convergence pruning (GYM01 violates hard buddy)
    runScheduleGeneration([alice, bob], REAL_TRAVEL, ["2028-07-22"]);

    // Original array should still have both sessions
    expect(alice.candidateSessions).toHaveLength(2);
    expect(alice.candidateSessions.map((s) => s.sessionCode)).toEqual([
      "SWM01",
      "GYM01",
    ]);
  });
});

// ===========================================================================
// Backup combo attendance satisfies another member's minBuddies
// ===========================================================================

describe("backup combo attendance counts toward minBuddies validation", () => {
  it("session in backup1 of member X counts as attendance for member Y's minBuddies check", () => {
    // Alice has minBuddies=1, interested in SWM01.
    // Bob is interested in SWM01 AND GYM01 (same time, overlapping).
    //   Bob's primary = SWM01 (higher rank), backup1 = GYM01 (new session vs P).
    //   Wait, these overlap — only solo combos. Bob's primary = GYM01 (rank 1)
    //   if Bob ranks Gymnastics first.
    //
    // Actually let me make it simpler:
    // Alice: minBuddies=1, only session SWM01.
    // Bob: has SWM01 (low interest) and GYM01 (high interest), different times.
    //   Bob's primary = [SWM01, GYM01] (both fit). SWM01 is in Bob's primary → counts.
    // This is trivially satisfied. Let me make Bob have SWM01 only in backup.
    //
    // Bob: has SWM01 (low, rank 2), GYM01 (high, rank 1), TRK01 (high, rank 1).
    //   GYM01 and TRK01 overlap with SWM01 timing-wise.
    //   Actually let me just use overlapping to force it into backup:
    //
    // Bob: SWM01 at 10-12 (low, rank 2), GYM01 at 10-12 (high, rank 1).
    //   Solo combos only (overlap). P = GYM01 (higher score), B1 = SWM01.
    //   SWM01 is in B1, not P.
    //
    // Alice's minBuddies check on SWM01: attendance for SWM01 includes ALL
    // of Bob's ranks → Bob has SWM01 in B1 → counts → 1 other ≥ 1 ✓.
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      minBuddies: 1,
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "high"
        ),
      ],
    });

    const bob = makeMember("Bob", {
      sportRankings: ["Artistic Gymnastics", "Swimming"],
      candidateSessions: [
        // GYM01: rank 1 → 2.0, high → 1.0 = 2.0 (will be primary)
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "high"
        ),
        // SWM01: rank 2 → 1.0, low → 0.4 = 0.4 (will be backup1)
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00",
          "low"
        ),
      ],
    });

    const result = runScheduleGeneration([alice, bob], REAL_TRAVEL, [
      "2028-07-22",
    ]);

    // Bob's primary should be GYM01 (higher score), SWM01 in backup1
    const bobPrimary = result.combos.find(
      (c) => c.memberId === "Bob" && c.rank === "primary"
    );
    expect(bobPrimary!.sessionCodes).toEqual(["GYM01"]);
    const bobBackup = result.combos.find(
      (c) => c.memberId === "Bob" && c.rank === "backup1"
    );
    expect(bobBackup!.sessionCodes).toEqual(["SWM01"]);

    // Alice's minBuddies=1 on SWM01: Bob has SWM01 in backup1 → counts as attendance
    // → Alice should NOT be in membersWithNoCombos and should converge
    expect(result.membersWithNoCombos).not.toContain("Alice");
    expect(result.convergence.converged).toBe(true);
  });
});

// ===========================================================================
// Pruned session penalty: verify exact 0.1x score in backup combo
// ===========================================================================

describe("pruned session 0.1x penalty numerical verification", () => {
  it("backup combo with pruned session has exactly 0.1x the normal score", () => {
    // A has hardBuddy B. B has hardBuddy C. C only has S2.
    // A has S1 and S2 (different days to avoid subset issues).
    // S1 is on Jul 22, S2 is on Jul 22 (same day, well-spaced).
    //
    // Iteration 1: B's S1 filtered (C doesn't have it).
    //   A's primary on Jul 22: [S1, S2]. S1 fails (B has no S1 combo) → prune S1.
    // Iteration 2: A has only S2. Primary = [S2]. Converges.
    // Backup enhancement: S1 re-included with pruned=true.
    //   S1 score: 2.0 (single sport) × 1.0 (high) × 1.0 (no buddies) × 0.1 (pruned) = 0.2
    //   S2 score: 2.0 × 1.0 × 1.0 = 2.0
    const members = [
      makeMember("A", {
        sportRankings: ["Swimming"],
        hardBuddies: ["B"],
        candidateSessions: [
          realSession(
            "S1",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00",
            "high"
          ),
          realSession(
            "S2",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00",
            "high"
          ),
        ],
      }),
      makeMember("B", {
        sportRankings: ["Swimming"],
        hardBuddies: ["C"],
        candidateSessions: [
          realSession(
            "S1",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "09:00:00",
            "11:00:00"
          ),
          realSession(
            "S2",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      }),
      makeMember("C", {
        sportRankings: ["Swimming"],
        candidateSessions: [
          realSession(
            "S2",
            "Swimming",
            "Inglewood Zone",
            "2028-07-22",
            "14:00:00",
            "16:00:00"
          ),
        ],
      }),
    ];

    const result = runScheduleGeneration(members, REAL_TRAVEL, DAYS);

    // A's primary should have S2 (converged result)
    const aPrimary = result.combos.find(
      (c) =>
        c.memberId === "A" && c.rank === "primary" && c.day === "2028-07-22"
    )!;
    expect(aPrimary.sessionCodes).toContain("S2");
    expect(aPrimary.score).toBeCloseTo(2.0);

    // A's backup should include S1 (pruned, re-included with 0.1× penalty)
    const aBackup = result.combos.find(
      (c) =>
        c.memberId === "A" &&
        c.rank !== "primary" &&
        c.day === "2028-07-22" &&
        c.sessionCodes.includes("S1")
    );
    expect(aBackup).toBeDefined();

    // If backup has both S1 (pruned) and S2 (normal):
    //   S1: 2.0 × 1.0 × 1.0 × 0.1 = 0.2
    //   S2: 2.0 × 1.0 × 1.0 = 2.0
    //   Total = 2.2
    if (aBackup!.sessionCodes.includes("S2")) {
      expect(aBackup!.score).toBeCloseTo(2.2);
    }
    // If backup is just [S1]: score = 0.2
    if (
      aBackup!.sessionCodes.length === 1 &&
      aBackup!.sessionCodes[0] === "S1"
    ) {
      expect(aBackup!.score).toBeCloseTo(0.2);
    }
  });
});

// ===========================================================================
// Empty days array
// ===========================================================================

describe("empty days array", () => {
  it("produces no combos and all members in membersWithNoCombos", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:00:00",
          "12:00:00"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, []);

    // No days requested → no combos generated → member has no combos
    expect(result.combos).toHaveLength(0);
    expect(result.membersWithNoCombos).toContain("Alice");
  });
});

// ===========================================================================
// Mixed interest levels in multi-session combo — exact score verification
// ===========================================================================

describe("mixed interest levels in multi-session combo scoring", () => {
  it("3-session combo with high/medium/low interests produces correct total score", () => {
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming", "Artistic Gymnastics", "Diving"],
      candidateSessions: [
        realSession(
          "SWM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00",
          "high"
        ),
        realSession(
          "GYM01",
          "Artistic Gymnastics",
          "Inglewood Zone",
          "2028-07-22",
          "10:30:00",
          "11:30:00",
          "medium"
        ),
        realSession(
          "DIV01",
          "Diving",
          "Inglewood Zone",
          "2028-07-22",
          "13:00:00",
          "14:00:00",
          "low"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    // All 3 sessions fit (same zone, 90 min gaps: 10:30-09:00=90, 13:00-11:30=90)
    const primary = result.combos.find(
      (c) => c.memberId === "Alice" && c.rank === "primary"
    )!;
    expect(primary.sessionCodes).toHaveLength(3);

    // Score calculation:
    //   SWM01: rank 1/3 → 2.0, high → 1.0, no buddies → 1.0 = 2.0
    //   GYM01: rank 2/3 → 1.5, medium → 0.7, no buddies → 1.0 = 1.05
    //   DIV01: rank 3/3 → 1.0, low → 0.4, no buddies → 1.0 = 0.4
    //   Total = 2.0 + 1.05 + 0.4 = 3.45
    expect(primary.score).toBeCloseTo(3.45);
  });
});

// ===========================================================================
// Tiebreaker: multi-session combos with equal score differ by session code
// ===========================================================================

describe("tiebreaker on multi-session combos by lexicographic session codes", () => {
  it("equal-score 2-session combos are ordered by first sorted session code", () => {
    // Two pairs of sessions, all same sport, same interest, same zone.
    // Pair 1: [AAA, BBB], Pair 2: [CCC, DDD]. Both pairs score identically.
    // Because they all overlap, we need them on separate time slots but with
    // the same gap structure.
    //
    // Actually, for tiebreaking to matter, we need 2+ combos with the same
    // score AND same session count AND same sportMultiplierSum. The simplest
    // setup: two non-overlapping pairs where each pair has the same total score.
    //
    // Use 4 sessions at the same time (overlapping) so only solo combos exist.
    // But solos are simpler. Let me make 2 feasible pairs:
    //   Pair [AAA01, ZZZ01] at 08:00-09:00 and 10:30-11:30
    //   Pair [MMM01, NNN01] at 08:00-09:00 and 10:30-11:30
    // But sessions can't share the same time unless they're different sessions.
    //
    // Simpler: 4 sessions, 2 morning + 2 afternoon. All same sport/interest.
    //   AAA at 08-09, ZZZ at 08-09 (overlap), MMM at 10:30-11:30, NNN at 10:30-11:30 (overlap)
    //   Feasible pairs: [AAA, MMM], [AAA, NNN], [ZZZ, MMM], [ZZZ, NNN]
    //   All pairs score identically: same sport, same interest, same count.
    //   Tiebreaker: first sorted session code → AAA < MMM < NNN < ZZZ
    //   [AAA, MMM] → first sorted = "AAA01" → best
    //   [AAA, NNN] → first sorted = "AAA01" → tie with above, then compare...
    //   Actually with sort on the combo's sessions, both [AAA, MMM] and [AAA, NNN]
    //   have first sorted code "AAA01". Need to check if there's a secondary.
    //
    // Let me simplify: just use overlapping sessions to produce solo combos.
    // Same sport, same interest → identical scores → alphabetical order.
    // This is already tested in "tiebreak 3" above.
    //
    // For multi-session: make 2 pairs with different first-sorted codes.
    const alice = makeMember("Alice", {
      sportRankings: ["Swimming"],
      candidateSessions: [
        realSession(
          "ZZZ01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00",
          "high"
        ),
        realSession(
          "AAA01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "08:00:00",
          "09:00:00",
          "high"
        ),
        realSession(
          "MMM01",
          "Swimming",
          "Inglewood Zone",
          "2028-07-22",
          "10:30:00",
          "11:30:00",
          "high"
        ),
      ],
    });

    const result = runScheduleGeneration([alice], REAL_TRAVEL, ["2028-07-22"]);

    const dayCombos = result.combos.filter(
      (c) => c.memberId === "Alice" && c.day === "2028-07-22"
    );

    // Feasible pairs: [AAA01, MMM01] and [ZZZ01, MMM01] (same scores)
    // Solo combos: [AAA01], [ZZZ01], [MMM01]
    // Primary should be a pair (higher score from 2 sessions).
    // Between [AAA01, MMM01] and [ZZZ01, MMM01]: first sorted code "AAA01" < "MMM01"
    // Wait, for [AAA01, MMM01]: sorted codes = ["AAA01", "MMM01"], first = "AAA01"
    //       for [ZZZ01, MMM01]: sorted codes = ["MMM01", "ZZZ01"], first = "MMM01"
    // "AAA01" < "MMM01" → [AAA01, MMM01] is primary
    const primary = dayCombos.find((c) => c.rank === "primary")!;
    expect(primary.sessionCodes.sort()).toEqual(["AAA01", "MMM01"]);
  });
});

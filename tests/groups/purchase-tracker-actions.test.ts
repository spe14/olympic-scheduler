import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPurchaseTrackerData,
  lookupSession,
  searchSessionCodes,
} from "@/app/(main)/groups/[groupId]/purchase-tracker/actions";
import { emptyPurchaseData } from "@/tests/helpers";

// ── Mock auth ───────────────────────────────────────────────────────────────
const mockGetCurrentUser = vi.fn();
const mockGetMembership = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  getMembership: (...args: unknown[]) => mockGetMembership(...args),
  requireMembership: async (groupId: string) => {
    const membership = await mockGetMembership(groupId);
    if (!membership)
      return {
        membership: null,
        error: { error: "You are not an active member of this group." },
      };
    return { membership, error: null };
  },
}));

// ── Mock DB ─────────────────────────────────────────────────────────────────
let queryResults: unknown[][] = [];

const mockOrderBy = vi.fn(function (this: { _result: unknown[] }) {
  const self = this;
  return {
    _result: self._result,
    limit: vi.fn(() => ({
      then: (resolve: (v: unknown) => void) => resolve(self._result),
    })),
    then: (resolve: (v: unknown) => void) => resolve(self._result),
  };
});

const mockLimit = vi.fn(function (this: { _result: unknown[] }) {
  const result = this._result;
  return { then: (resolve: (v: unknown) => void) => resolve(result) };
});

const mockWhere = vi.fn(function (this: { _result: unknown[] }) {
  const self = this;
  return {
    _result: self._result,
    limit: mockLimit.bind({ _result: self._result }),
    orderBy: mockOrderBy.bind({ _result: self._result }),
    then: (resolve: (v: unknown) => void) => resolve(self._result),
  };
});

const mockInnerJoin: ReturnType<typeof vi.fn> = vi.fn(function (this: {
  _result: unknown[];
}) {
  const self = this;
  return {
    _result: self._result,
    innerJoin: mockInnerJoin.bind({ _result: self._result }),
    where: vi.fn(() => ({
      _result: self._result,
      then: (resolve: (v: unknown) => void) => resolve(self._result),
      orderBy: mockOrderBy.bind({ _result: self._result }),
    })),
    then: (resolve: (v: unknown) => void) => resolve(self._result),
  };
});

const mockFrom = vi.fn(() => {
  const result = queryResults.shift() ?? [];
  const ctx = { _result: result };
  return {
    _result: result,
    where: mockWhere.bind(ctx),
    innerJoin: mockInnerJoin.bind(ctx),
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
});

const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  session: {
    sessionCode: "session_code",
    sport: "sport",
    sessionType: "session_type",
    sessionDescription: "session_description",
    venue: "venue",
    zone: "zone",
    sessionDate: "session_date",
    startTime: "start_time",
    endTime: "end_time",
  },
  combo: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
    day: "day",
    rank: "rank",
    score: "score",
  },
  comboSession: {
    comboId: "combo_id",
    sessionId: "session_id",
  },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    status: "status",
    excludedSessionCodes: "excluded_session_codes",
  },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    avatarColor: "avatar_color",
  },
  purchaseTimeslot: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
  },
  windowRanking: {
    id: "id",
    groupId: "group_id",
    startDate: "start_date",
    endDate: "end_date",
    score: "score",
  },
  ticketPurchase: {
    id: "id",
    groupId: "group_id",
    sessionId: "session_id",
    purchasedByMemberId: "purchased_by_member_id",
  },
  reportedPrice: {
    groupId: "group_id",
    sessionId: "session_id",
    reportedByMemberId: "reported_by_member_id",
  },
  soldOutSession: {
    groupId: "group_id",
    sessionId: "session_id",
  },
  outOfBudgetSession: {
    groupId: "group_id",
    memberId: "member_id",
    sessionId: "session_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  notInArray: vi.fn(),
  desc: vi.fn(),
  or: vi.fn(),
  ilike: vi.fn(),
}));

// Mock purchase-actions (used by getPurchaseTrackerData)
const mockGetPurchaseDataForSessions = vi.fn().mockResolvedValue({
  planEntries: new Map(),
  purchases: new Map(),
  soldOutSessions: new Set<string>(),
  outOfBudgetSessions: new Set<string>(),
  reportedPrices: new Map(),
});

vi.mock("@/app/(main)/groups/[groupId]/schedule/purchase-actions", () => ({
  getPurchaseDataForSessions: (...args: unknown[]) =>
    mockGetPurchaseDataForSessions(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const membership = { id: "member-1", userId: "user-1", groupId: "group-1" };

function makeSession(code: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionCode: code,
    sport: "Swimming",
    sessionType: "Final",
    sessionDescription: null,
    venue: "Aquatics Centre",
    zone: "Zone A",
    sessionDate: "2028-07-15",
    startTime: "09:00",
    endTime: "11:00",
    ...overrides,
  };
}

function makeComboSession(comboId: string, code: string) {
  return { comboId, ...makeSession(code) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("getPurchaseTrackerData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    mockGetPurchaseDataForSessions.mockResolvedValue(emptyPurchaseData());
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await getPurchaseTrackerData("group-1");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty data with hasTimeslot=false when no combos and no timeslot", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [
      [], // timeslotRow — none
      [], // combos — empty → early return
    ];

    const result = await getPurchaseTrackerData("group-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      days: [],
      members: [],
      windowRankings: [],
      offScheduleSessions: [],
      excludedSessions: [],
      hasTimeslot: false,
    });
  });

  it("returns hasTimeslot=true when user has a timeslot but no combos", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [
      [{ id: "ts-1" }], // timeslotRow — exists
      [], // combos — empty → early return
    ];

    const result = await getPurchaseTrackerData("group-1");

    expect(result.data!.hasTimeslot).toBe(true);
    expect(result.data!.days).toEqual([]);
  });

  it("returns full tracker data with days grouped by combo rank", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const combos = [
      { comboId: "c-1", day: "2028-07-15", rank: "primary", score: 95 },
      { comboId: "c-2", day: "2028-07-15", rank: "backup1", score: 80 },
      { comboId: "c-3", day: "2028-07-16", rank: "primary", score: 88 },
    ];

    const comboSessions = [
      makeComboSession("c-1", "SES-001"),
      makeComboSession("c-2", "SES-002"),
      makeComboSession("c-3", "SES-003"),
    ];

    const interestedRows = [
      {
        sessionId: "SES-001",
        memberId: "member-2",
        firstName: "Bob",
        lastName: "Jones",
        avatarColor: "green",
      },
    ];

    const activeMembers = [
      {
        memberId: "member-1",
        firstName: "Alice",
        lastName: "Smith",
        avatarColor: "blue",
      },
      {
        memberId: "member-2",
        firstName: "Bob",
        lastName: "Jones",
        avatarColor: "green",
      },
    ];

    const windows = [
      {
        id: "w-1",
        startDate: "2028-07-14",
        endDate: "2028-07-16",
        score: 95,
      },
    ];

    queryResults = [
      [{ id: "ts-1" }], // 1. timeslotRow
      combos, // 2. combos (orderBy)
      comboSessions, // 3. allComboSessions (innerJoin → where)
      interestedRows, // 4. interestedRows (innerJoin chain → where)
      // getPurchaseDataForSessions is mocked
      activeMembers, // 5. activeMembers (innerJoin → where)
      windows, // 6. windows (orderBy)
      [], // 7. purchasedSessionCodes
      [], // 8. reportedSessionCodes
      // allTouchedCodes empty → skip groupComboSessionRows
      // offScheduleCodes empty → skip offScheduleRows
      [{ excludedSessionCodes: null }], // 9. memberRow (limit)
      [], // 10. soldOutRows
      [], // 11. oobRows
      // excludedCodes empty → skip excludedSessionRows
    ];

    const result = await getPurchaseTrackerData("group-1");

    expect(result.error).toBeUndefined();
    const data = result.data!;

    // hasTimeslot
    expect(data.hasTimeslot).toBe(true);

    // Days sorted by primaryScore descending
    expect(data.days).toHaveLength(2);
    expect(data.days[0].day).toBe("2028-07-15");
    expect(data.days[0].primaryScore).toBe(95);
    expect(data.days[0].primary).toHaveLength(1);
    expect(data.days[0].backup1).toHaveLength(1);
    expect(data.days[0].backup2).toHaveLength(0);

    expect(data.days[1].day).toBe("2028-07-16");
    expect(data.days[1].primaryScore).toBe(88);

    // Members
    expect(data.members).toHaveLength(2);
    expect(data.members[0].firstName).toBe("Alice");

    // Window rankings (capped at 3)
    expect(data.windowRankings).toHaveLength(1);
    expect(data.windowRankings[0].score).toBe(95);

    // No off-schedule or excluded sessions
    expect(data.offScheduleSessions).toHaveLength(0);
    expect(data.excludedSessions).toHaveLength(0);
  });

  it("deduplicates interested members for the same session", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }], // combos
      [makeComboSession("c-1", "SES-001")], // comboSessions
      [
        // interestedRows — duplicated member
        {
          sessionId: "SES-001",
          memberId: "m-2",
          firstName: "Bob",
          lastName: "J",
          avatarColor: "blue",
        },
        {
          sessionId: "SES-001",
          memberId: "m-2",
          firstName: "Bob",
          lastName: "J",
          avatarColor: "blue",
        },
      ],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }], // activeMembers
      [], // windows
      [], // purchasedSessionCodes
      [], // reportedSessionCodes
      [{ excludedSessionCodes: null }], // memberRow
      [], // soldOutRows
      [], // oobRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    const day = result.data!.days[0];
    // Bob should appear only once despite duplicate rows
    expect(day.primary[0].interestedMembers).toHaveLength(1);
    expect(day.primary[0].interestedMembers[0].memberId).toBe("m-2");
  });

  it("handles off-schedule sessions with purchase data", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const offSchedulePurchaseData = emptyPurchaseData();
    offSchedulePurchaseData.purchases.set("OFF-001", [
      {
        purchaseId: "p-1",
        buyerMemberId: "member-1",
        buyerFirstName: "Alice",
        buyerLastName: "Smith",
        pricePerTicket: 100,
        assignees: [],
        createdAt: new Date(),
      },
    ]);

    // First call returns empty (for on-schedule), second returns off-schedule data
    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(offSchedulePurchaseData);

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")], // comboSessions
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ sessionId: "OFF-001" }], // purchasedSessionCodes — not in combos
      [], // reportedSessionCodes
      [], // groupComboSessionRows — not in any combo
      [makeSession("OFF-001", { sessionDate: "2028-07-20" })], // offScheduleRows
      // getPurchaseDataForSessions called again (second mock value)
      [{ excludedSessionCodes: null }], // memberRow
      [], // soldOutRows
      [], // oobRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("OFF-001");
    expect(result.data!.offScheduleSessions[0].purchases).toHaveLength(1);
  });

  it("excludes off-schedule sessions that appear in another member's combo", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")], // comboSessions
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ sessionId: "OVERLAP-001" }], // purchasedSessionCodes
      [], // reportedSessionCodes
      [{ sessionId: "OVERLAP-001" }], // groupComboSessionRows — IS in another combo
      // allTouchedCodes now empty after removal → no offScheduleRows query
      [{ excludedSessionCodes: null }], // memberRow
      [], // soldOutRows
      [], // oobRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(0);
  });

  it("handles excluded sessions with stored snapshot (new format)", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const excludedPurchaseData = emptyPurchaseData();
    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData()) // for on-schedule
      .mockResolvedValueOnce(excludedPurchaseData); // for excluded

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")], // comboSessions
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [], // purchasedSessionCodes
      [], // reportedSessionCodes
      // allTouchedCodes empty → no groupComboSessionRows
      [
        {
          excludedSessionCodes: [
            // memberRow (new format)
            { code: "EXC-001", soldOut: true, outOfBudget: false },
            { code: "EXC-002", soldOut: false, outOfBudget: true },
          ],
        },
      ],
      [{ sessionCode: "EXC-001" }], // soldOutRows (still sold out)
      [], // oobRows (EXC-002 no longer OOB)
      [
        // excludedSessionRows
        makeSession("EXC-001"),
        makeSession("EXC-002"),
      ],
      // getPurchaseDataForSessions called (second mock value)
    ];

    const result = await getPurchaseTrackerData("group-1");
    const excluded = result.data!.excludedSessions;
    expect(excluded).toHaveLength(2);

    const exc1 = excluded.find((e) => e.sessionCode === "EXC-001")!;
    expect(exc1.isSoldOut).toBe(true); // currently sold out
    expect(exc1.wasSoldOut).toBe(true); // was sold out at generation
    expect(exc1.isOutOfBudget).toBe(false);

    const exc2 = excluded.find((e) => e.sessionCode === "EXC-002")!;
    expect(exc2.isOutOfBudget).toBe(false); // no longer OOB
    expect(exc2.wasOutOfBudget).toBe(true); // was OOB at generation
    expect(exc2.isSoldOut).toBe(false);
  });

  it("handles excluded sessions with legacy format (string[])", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [], // purchasedSessionCodes
      [], // reportedSessionCodes
      [{ excludedSessionCodes: ["LEGACY-001"] }], // memberRow (old string[] format)
      [], // soldOutRows
      [], // oobRows
      [makeSession("LEGACY-001")], // excludedSessionRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    const excluded = result.data!.excludedSessions;
    expect(excluded).toHaveLength(1);
    expect(excluded[0].sessionCode).toBe("LEGACY-001");
    // Legacy format assumes neither sold out nor OOB at generation
    expect(excluded[0].wasSoldOut).toBe(false);
    expect(excluded[0].wasOutOfBudget).toBe(false);
  });

  it("includes new sold-out sessions not in combos as excluded", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [], // purchasedSessionCodes
      [], // reportedSessionCodes
      [{ excludedSessionCodes: null }], // memberRow — no stored excluded
      [{ sessionCode: "NEW-SOLD" }], // soldOutRows — newly sold out
      [], // oobRows
      [makeSession("NEW-SOLD")], // excludedSessionRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.excludedSessions).toHaveLength(1);
    expect(result.data!.excludedSessions[0].sessionCode).toBe("NEW-SOLD");
    expect(result.data!.excludedSessions[0].isSoldOut).toBe(true);
    expect(result.data!.excludedSessions[0].wasSoldOut).toBe(false); // not in stored snapshot
  });

  it("does not count on-schedule sessions as excluded even if sold out", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [],
      [],
      [{ excludedSessionCodes: null }],
      [{ sessionCode: "SES-001" }], // SES-001 is sold out BUT is in combos
      [],
      // SES-001 is on-schedule, so it shouldn't appear as excluded
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.excludedSessions).toHaveLength(0);
  });

  it("caps windowRankings to 3", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const windows = Array.from({ length: 5 }, (_, i) => ({
      id: `w-${i}`,
      startDate: `2028-07-${12 + i}`,
      endDate: `2028-07-${14 + i}`,
      score: 100 - i * 10,
    }));

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      windows,
      [],
      [],
      [{ excludedSessionCodes: null }],
      [],
      [],
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.windowRankings).toHaveLength(3);
  });

  it("assigns backup2 sessions correctly", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [],
      [
        { comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 },
        { comboId: "c-2", day: "2028-07-15", rank: "backup2", score: 70 },
      ],
      [makeComboSession("c-1", "SES-001"), makeComboSession("c-2", "SES-002")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [],
      [],
      [{ excludedSessionCodes: null }],
      [],
      [],
    ];

    const result = await getPurchaseTrackerData("group-1");
    const day = result.data!.days[0];
    expect(day.primary).toHaveLength(1);
    expect(day.backup2).toHaveLength(1);
    expect(day.backup2[0].sessionCode).toBe("SES-002");
  });

  it("sorts sessions within a combo by startTime", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [
        makeComboSession("c-1", "SES-B"),
        { ...makeComboSession("c-1", "SES-A"), startTime: "08:00" },
      ],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [],
      [],
      [{ excludedSessionCodes: null }],
      [],
      [],
    ];

    const result = await getPurchaseTrackerData("group-1");
    const sessions = result.data!.days[0].primary;
    expect(sessions).toHaveLength(2);
    // SES-A (08:00) should come before SES-B (09:00)
    expect(sessions[0].sessionCode).toBe("SES-A");
    expect(sessions[1].sessionCode).toBe("SES-B");
  });

  it("removes on-schedule purchased sessions from off-schedule list", async () => {
    mockGetMembership.mockResolvedValue(membership);

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [{ sessionId: "SES-001" }], // purchased SES-001 — but it's in combos
      [],
      // SES-001 removed from allTouchedCodes by the delete loop → no off-schedule query
      [{ excludedSessionCodes: null }],
      [],
      [],
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(0);
  });

  it("sorts off-schedule sessions by sessionDate", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [{ sessionId: "OFF-B" }, { sessionId: "OFF-A" }], // two off-schedule purchases
      [],
      [], // groupComboSessionRows — neither in any combo
      [
        makeSession("OFF-B", { sessionDate: "2028-07-25" }),
        makeSession("OFF-A", { sessionDate: "2028-07-20" }),
      ],
      [{ excludedSessionCodes: null }],
      [],
      [],
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(2);
    // Should be sorted by sessionDate ascending
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("OFF-A");
    expect(result.data!.offScheduleSessions[1].sessionCode).toBe("OFF-B");
  });

  it("includes new OOB sessions not in combos as excluded", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [],
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [],
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [],
      [],
      [],
      [{ excludedSessionCodes: null }],
      [],
      [{ sessionCode: "OOB-001" }], // newly OOB, not in combos
      [makeSession("OOB-001")],
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.excludedSessions).toHaveLength(1);
    expect(result.data!.excludedSessions[0].sessionCode).toBe("OOB-001");
    expect(result.data!.excludedSessions[0].isOutOfBudget).toBe(true);
  });
});

describe("lookupSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await lookupSession("SES-001");
    expect(result).toEqual({ error: "Not authenticated." });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns error when session not found", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    queryResults = [[]];
    const result = await lookupSession("INVALID-CODE");
    expect(result).toEqual({ error: "Session not found." });
  });

  it("returns session data when found", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const sessionData = {
      sessionCode: "SWM-101",
      sport: "Swimming",
      sessionType: "Final",
      sessionDescription: "100m Freestyle",
      venue: "Aquatics Centre",
      zone: "Zone A",
      sessionDate: "2028-07-15",
      startTime: "09:00",
      endTime: "11:00",
    };
    queryResults = [[sessionData]];

    const result = await lookupSession("SWM-101");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(sessionData);
  });
});

describe("searchSessionCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns empty array when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await searchSessionCodes("SWM");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const result = await searchSessionCodes("");
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const result = await searchSessionCodes("   ");
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns matching session suggestions", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const suggestions = [
      { sessionCode: "SWM-101", sport: "Swimming", sessionType: "Final" },
      { sessionCode: "SWM-102", sport: "Swimming", sessionType: "Heat" },
    ];
    queryResults = [suggestions];

    const result = await searchSessionCodes("SWM");

    expect(result).toEqual(suggestions);
    expect(result).toHaveLength(2);
  });
});

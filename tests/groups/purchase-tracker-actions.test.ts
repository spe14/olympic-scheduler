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
    reportedByMemberId: "reported_by_member_id",
  },
  outOfBudgetSession: {
    groupId: "group_id",
    memberId: "member_id",
    sessionId: "session_id",
    createdAt: "created_at",
  },
  group: {
    id: "id",
    scheduleGeneratedAt: "schedule_generated_at",
    soldOutCodesAtGeneration: "sold_out_codes_at_generation",
  },
  sessionInterest: {
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
  // Current query order in getPurchaseTrackerData (main path, combos > 0):
  //  1. timeslotRow (purchaseTimeslot)
  //  2. combos (combo, orderBy)
  //  3. allComboSessions (comboSession.innerJoin)
  //  4. interestedRows (comboSession.innerJoin chain)
  //  5. (getPurchaseDataForSessions — mocked, 1st call: on-schedule)
  //  6. activeMembers (member.innerJoin)
  //  7. windows (windowRanking, orderBy)
  //  8. memberRow (member — excluded section)
  //  9. soldOutRows (soldOutSession — excluded section)
  // 10. oobRows (outOfBudgetSession — excluded section)
  // 11. groupRow (group — excluded section)
  // 12. (conditional) excludedSessionRows (session)
  // 13. (conditional) (getPurchaseDataForSessions — mocked: excluded)
  // 14. purchasedSessionCodes (ticketPurchase — off-schedule, via Promise.all)
  // 15. reportedSessionCodes (reportedPrice — off-schedule, via Promise.all)
  // 16. soldOutReportedCodes (soldOutSession — off-schedule, via Promise.all)
  // 17. (conditional) offScheduleRows (session)
  // 18. (conditional) (getPurchaseDataForSessions — mocked: off-schedule)

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

  it("returns generic error when DB query throws", async () => {
    mockGetMembership.mockResolvedValue({ id: "member-1" });
    mockSelect.mockImplementationOnce(() => ({
      from: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));

    const result = await getPurchaseTrackerData("group-1");

    expect(result.error).toBe(
      "Failed to load purchase tracker. Please try again."
    );
    expect(result.data).toBeUndefined();
  });

  // No-combos early return path query order:
  //  1. timeslotRow (purchaseTimeslot)
  //  2. combos (combo) — empty → enters early return
  //  3. activeMembers (member.innerJoin)  ─┐ Promise.all
  //  4. purchasedSessionCodes (ticketPurchase) ─┐              ─┤
  //  5. reportedSessionCodes (reportedPrice)    ├ Promise.all  ─┤
  //  6. soldOutReportedCodes (soldOutSession)   ┘              ─┘
  //  7. (conditional) offScheduleRows (session)
  //  8. (conditional) (getPurchaseDataForSessions — off-schedule)

  it("returns empty data with hasTimeslot=false when no combos and no timeslot", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [
      [], // 1. timeslotRow — none
      [], // 2. combos — empty → early return
      [], // 3. activeMembers
      [], // 4. purchasedSessionCodes
      [], // 5. reportedSessionCodes
      [], // 6. soldOutReportedCodes
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
      [{ id: "ts-1" }], // 1. timeslotRow — exists
      [], // 2. combos — empty → early return
      [], // 3. activeMembers
      [], // 4. purchasedSessionCodes
      [], // 5. reportedSessionCodes
      [], // 6. soldOutReportedCodes
    ];

    const result = await getPurchaseTrackerData("group-1");

    expect(result.data!.hasTimeslot).toBe(true);
    expect(result.data!.days).toEqual([]);
  });

  it("returns members and off-schedule sessions even with no combos", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const offSchedulePurchaseData = emptyPurchaseData();
    offSchedulePurchaseData.purchases.set("PRE-001", [
      {
        purchaseId: "p-pre",
        buyerMemberId: "member-1",
        buyerFirstName: "Alice",
        buyerLastName: "Smith",
        pricePerTicket: 75,
        assignees: [],
        createdAt: new Date(),
      },
    ]);
    mockGetPurchaseDataForSessions.mockResolvedValueOnce(
      offSchedulePurchaseData
    );

    queryResults = [
      [], // 1. timeslotRow
      [], // 2. combos — empty → early return
      [
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
      ], // 3. activeMembers
      [{ sessionId: "PRE-001" }], // 4. purchasedSessionCodes
      [], // 5. reportedSessionCodes
      [], // 6. soldOutReportedCodes
      [makeSession("PRE-001", { sessionDate: "2028-07-20" })], // 7. offScheduleRows
      // getPurchaseDataForSessions called (off-schedule)
    ];

    const result = await getPurchaseTrackerData("group-1");

    expect(result.data!.days).toEqual([]);
    expect(result.data!.windowRankings).toEqual([]);
    expect(result.data!.excludedSessions).toEqual([]);

    // Members are populated even without schedules
    expect(result.data!.members).toHaveLength(2);
    expect(result.data!.members[0].firstName).toBe("Alice");
    expect(result.data!.members[1].firstName).toBe("Bob");

    // Off-schedule sessions from prior purchases are returned
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("PRE-001");
    expect(result.data!.offScheduleSessions[0].purchases).toHaveLength(1);
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
      combos, // 2. combos
      comboSessions, // 3. allComboSessions
      interestedRows, // 4. interestedRows
      // getPurchaseDataForSessions mocked (on-schedule)
      activeMembers, // 6. activeMembers
      windows, // 7. windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      // excludedCodes empty → skip excludedSessionRows
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
      // allTouchedCodes empty → skip offScheduleRows
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
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
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
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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

    // 1st: on-schedule, 2nd: off-schedule (no excluded sessions in this test)
    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(offSchedulePurchaseData);

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      // excludedCodes empty → skip excludedSessionRows
      [{ sessionId: "OFF-001" }], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
      [makeSession("OFF-001", { sessionDate: "2028-07-20" })], // 17. offScheduleRows
      // getPurchaseDataForSessions called (2nd mock value: off-schedule)
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("OFF-001");
    expect(result.data!.offScheduleSessions[0].purchases).toHaveLength(1);
  });

  it("keeps off-schedule sessions even if in another member's combo", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [{ sessionId: "OVERLAP-001" }], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
      [makeSession("OVERLAP-001", { sessionDate: "2028-07-20" })], // 17. offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("OVERLAP-001");
  });

  it("handles excluded sessions with stored snapshot (new format)", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const excludedPurchaseData = emptyPurchaseData();
    // 1st: on-schedule, 2nd: excluded (no off-schedule in this test)
    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(excludedPurchaseData);

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [
        {
          excludedSessionCodes: [
            { code: "EXC-001", soldOut: true, outOfBudget: false },
            { code: "EXC-002", soldOut: false, outOfBudget: true },
          ],
        },
      ], // 8. memberRow (new format)
      [{ sessionCode: "EXC-001" }], // 9. soldOutRows (still sold out)
      [], // 10. oobRows (EXC-002 no longer OOB)
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [makeSession("EXC-001"), makeSession("EXC-002")], // 12. excludedSessionRows
      // getPurchaseDataForSessions called (2nd mock: excluded)
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: ["LEGACY-001"] }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [makeSession("LEGACY-001")], // 12. excludedSessionRows
      // getPurchaseDataForSessions called (2nd mock: excluded)
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
    ];

    const result = await getPurchaseTrackerData("group-1");
    const excluded = result.data!.excludedSessions;
    expect(excluded).toHaveLength(1);
    expect(excluded[0].sessionCode).toBe("LEGACY-001");
    // Legacy format assumes neither sold out nor OOB at generation
    expect(excluded[0].wasSoldOut).toBe(false);
    expect(excluded[0].wasOutOfBudget).toBe(false);
  });

  it("includes sold-out-at-generation sessions not in combos as excluded", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [{ sessionCode: "NEW-SOLD" }], // 9. soldOutRows — currently sold out
      [], // 10. oobRows
      [
        {
          scheduleGeneratedAt: null,
          soldOutCodesAtGeneration: ["NEW-SOLD"],
        },
      ], // 11. groupRow — NEW-SOLD was sold out at generation
      [makeSession("NEW-SOLD")], // 12. excludedSessionRows
      // getPurchaseDataForSessions called (2nd mock: excluded)
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.excludedSessions).toHaveLength(1);
    expect(result.data!.excludedSessions[0].sessionCode).toBe("NEW-SOLD");
    expect(result.data!.excludedSessions[0].isSoldOut).toBe(true);
    expect(result.data!.excludedSessions[0].wasSoldOut).toBe(true);
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [{ sessionCode: "SES-001" }], // 9. soldOutRows — SES-001 sold out
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      // SES-001 is on-schedule → excluded from soldOutAtGen filter → no excludedSessionRows
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [{ sessionId: "SES-001" }], // 14. purchasedSessionCodes — in combos
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
      // SES-001 removed by the delete loop → no offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(0);
  });

  it("includes sessions from reported prices in off-schedule list", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes — empty
      [{ sessionId: "REPORTED-001" }], // 15. reportedSessionCodes — has a reported price
      [], // 16. soldOutReportedCodes
      [makeSession("REPORTED-001", { sessionDate: "2028-07-22" })], // 17. offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe(
      "REPORTED-001"
    );
  });

  it("includes sessions from sold-out reports in off-schedule list", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [], // 14. purchasedSessionCodes — empty
      [], // 15. reportedSessionCodes — empty
      [{ sessionId: "SOLDOUT-RPT-001" }], // 16. soldOutReportedCodes — has a sold-out report
      [makeSession("SOLDOUT-RPT-001", { sessionDate: "2028-07-23" })], // 17. offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(1);
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe(
      "SOLDOUT-RPT-001"
    );
  });

  it("combines purchases, reported prices, and sold-out reports into off-schedule set", async () => {
    mockGetMembership.mockResolvedValue(membership);

    mockGetPurchaseDataForSessions
      .mockResolvedValueOnce(emptyPurchaseData())
      .mockResolvedValueOnce(emptyPurchaseData());

    queryResults = [
      [], // 1. timeslotRow
      [{ comboId: "c-1", day: "2028-07-15", rank: "primary", score: 90 }],
      [makeComboSession("c-1", "SES-001")],
      [], // interestedRows
      [{ memberId: "m-1", firstName: "A", lastName: "S", avatarColor: "blue" }],
      [], // windows
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [{ sessionId: "BUY-001" }], // 14. purchasedSessionCodes
      [{ sessionId: "RPT-001" }], // 15. reportedSessionCodes
      [{ sessionId: "SO-001" }], // 16. soldOutReportedCodes
      [
        makeSession("BUY-001", { sessionDate: "2028-07-20" }),
        makeSession("RPT-001", { sessionDate: "2028-07-21" }),
        makeSession("SO-001", { sessionDate: "2028-07-22" }),
      ], // 17. offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(3);
    // Sorted by sessionDate
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("BUY-001");
    expect(result.data!.offScheduleSessions[1].sessionCode).toBe("RPT-001");
    expect(result.data!.offScheduleSessions[2].sessionCode).toBe("SO-001");
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
      [{ excludedSessionCodes: null }], // 8. memberRow
      [], // 9. soldOutRows
      [], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [{ sessionId: "OFF-B" }, { sessionId: "OFF-A" }], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
      [
        makeSession("OFF-B", { sessionDate: "2028-07-25" }),
        makeSession("OFF-A", { sessionDate: "2028-07-20" }),
      ], // 17. offScheduleRows
    ];

    const result = await getPurchaseTrackerData("group-1");
    expect(result.data!.offScheduleSessions).toHaveLength(2);
    // Should be sorted by sessionDate ascending
    expect(result.data!.offScheduleSessions[0].sessionCode).toBe("OFF-A");
    expect(result.data!.offScheduleSessions[1].sessionCode).toBe("OFF-B");
  });

  it("includes OOB sessions from snapshot as excluded", async () => {
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
      [
        {
          excludedSessionCodes: [
            { code: "OOB-001", soldOut: false, outOfBudget: true },
          ],
        },
      ], // 8. memberRow — OOB-001 in snapshot
      [], // 9. soldOutRows
      [{ sessionCode: "OOB-001", createdAt: new Date("2028-07-01") }], // 10. oobRows
      [{ scheduleGeneratedAt: null, soldOutCodesAtGeneration: null }], // 11. groupRow
      [makeSession("OOB-001")], // 12. excludedSessionRows
      // getPurchaseDataForSessions called (2nd mock: excluded)
      [], // 14. purchasedSessionCodes
      [], // 15. reportedSessionCodes
      [], // 16. soldOutReportedCodes
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
    mockGetPurchaseDataForSessions.mockResolvedValue(emptyPurchaseData());
  });

  it("returns error when not a group member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await lookupSession("SES-001", "group-1");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns error when session not found", async () => {
    mockGetMembership.mockResolvedValue({ id: "member-1" });
    queryResults = [[]];
    const result = await lookupSession("INVALID-CODE", "group-1");
    expect(result).toEqual({ error: "Session not found." });
  });

  it("returns generic error when DB query throws", async () => {
    mockGetMembership.mockResolvedValue({ id: "member-1" });
    mockSelect.mockImplementationOnce(() => ({
      from: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));

    const result = await lookupSession("SES-001", "group-1");

    expect(result.error).toBe("Failed to look up session. Please try again.");
    expect(result.data).toBeUndefined();
  });

  it("returns session data with purchases and prices when found", async () => {
    mockGetMembership.mockResolvedValue({ id: "member-1" });
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
    const purchaseData = emptyPurchaseData();
    purchaseData.purchases.set("SWM-101", [
      {
        purchaseId: "p-1",
        buyerMemberId: "member-1",
        buyerFirstName: "Alice",
        buyerLastName: "A",
        pricePerTicket: 150,
        assignees: [],
        createdAt: new Date("2028-07-01"),
      },
    ]);
    purchaseData.soldOutSessions.add("SWM-101");
    mockGetPurchaseDataForSessions.mockResolvedValue(purchaseData);
    queryResults = [[sessionData]];

    const result = await lookupSession("SWM-101", "group-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      ...sessionData,
      isSoldOut: true,
      purchases: purchaseData.purchases.get("SWM-101"),
      reportedPrices: [],
    });
    expect(mockGetPurchaseDataForSessions).toHaveBeenCalledWith(
      "group-1",
      "member-1",
      ["SWM-101"]
    );
  });
});

describe("searchSessionCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns empty data when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await searchSessionCodes("SWM");
    expect(result).toEqual({ data: [] });
  });

  it("returns empty data for empty query", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const result = await searchSessionCodes("");
    expect(result).toEqual({ data: [] });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty data for whitespace-only query", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const result = await searchSessionCodes("   ");
    expect(result).toEqual({ data: [] });
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

    expect(result).toEqual({ data: suggestions });
    expect(result.data).toHaveLength(2);
  });

  it("returns error when DB query throws", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockSelect.mockImplementationOnce(() => ({
      from: vi.fn(() => {
        throw new Error("connection reset");
      }),
    }));

    const result = await searchSessionCodes("SWM");

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

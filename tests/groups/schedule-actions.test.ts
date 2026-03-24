import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMySchedule } from "@/app/(main)/groups/[groupId]/schedule/actions";
import { createPurchaseDataMock } from "@/tests/helpers";

// Mock auth
const mockGetMembership = vi.fn();
vi.mock("@/lib/auth", () => ({
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

// ---------------------------------------------------------------------------
// Mock DB — chainable select/from/where/innerJoin/orderBy
// ---------------------------------------------------------------------------
// Each query the source issues goes through select().from().<chain>
// We track the query invocation order and return different results per call.
let queryResults: unknown[][] = [];

const mockOrderBy = vi.fn(function (this: { _result: unknown[] }) {
  const result = this._result;
  return { then: (resolve: (v: unknown) => void) => resolve(result) };
});

const mockInnerJoin = vi.fn(function (this: { _result: unknown[] }) {
  const self = this;
  return {
    _result: self._result,
    innerJoin: mockInnerJoin,
    where: vi.fn(() => ({
      then: (resolve: (v: unknown) => void) => resolve(self._result),
    })),
  };
});

const mockWhere = vi.fn(function (this: { _result: unknown[] }) {
  const self = this;
  return {
    _result: self._result,
    orderBy: mockOrderBy.bind({ _result: self._result }),
    limit: vi.fn(() => ({
      then: (resolve: (v: unknown) => void) => resolve(self._result),
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
  },
  session: {
    sessionCode: "session_code",
    sport: "sport",
    sessionType: "session_type",
    sessionDescription: "session_description",
    venue: "venue",
    zone: "zone",
    startTime: "start_time",
    endTime: "end_time",
  },
  sessionPreference: {
    memberId: "member_id",
    sessionId: "session_id",
    interest: "interest",
  },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    username: "username",
    avatarColor: "avatar_color",
  },
  purchaseTimeslot: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  ne: vi.fn(),
}));

// Mock purchase actions
const mockGetPurchaseDataForSessions = createPurchaseDataMock();
vi.mock("@/app/(main)/groups/[groupId]/schedule/purchase-actions", () => ({
  getPurchaseDataForSessions: (...args: unknown[]) =>
    mockGetPurchaseDataForSessions(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const membership = { id: "member-1", userId: "user-1", groupId: "group-1" };

function makeSession(
  overrides: Partial<{
    comboId: string;
    sessionCode: string;
    sport: string;
    sessionType: string;
    sessionDescription: string | null;
    venue: string;
    zone: string;
    startTime: string;
    endTime: string;
  }> = {}
) {
  return {
    comboId: overrides.comboId ?? "combo-1",
    sessionCode: overrides.sessionCode ?? "SES-001",
    sport: overrides.sport ?? "Swimming",
    sessionType: overrides.sessionType ?? "Final",
    sessionDescription: overrides.sessionDescription ?? null,
    venue: overrides.venue ?? "Aquatics Centre",
    zone: overrides.zone ?? "Zone A",
    startTime: overrides.startTime ?? "09:00",
    endTime: overrides.endTime ?? "11:00",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("getMySchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);

    const result = await getMySchedule("group-1");

    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
    expect(mockGetMembership).toHaveBeenCalledWith("group-1");
    // No DB queries should have been made
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty data when no combos", async () => {
    mockGetMembership.mockResolvedValue(membership);
    // First query: combos — empty
    queryResults = [[]];

    const result = await getMySchedule("group-1");

    expect(result).toEqual({ data: [] });
    // Only one select (combos query)
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("returns schedule data grouped by day", async () => {
    mockGetMembership.mockResolvedValue(membership);

    // Query 1: combos — two combos on different days
    const combos = [
      { comboId: "combo-1", day: "2026-08-01", rank: "primary", score: 95 },
      { comboId: "combo-2", day: "2026-08-02", rank: "primary", score: 88 },
    ];

    // Query 2: comboSessions
    const comboSessions = [
      makeSession({
        comboId: "combo-1",
        sessionCode: "SES-001",
        startTime: "10:00",
        endTime: "12:00",
      }),
      makeSession({
        comboId: "combo-1",
        sessionCode: "SES-002",
        sport: "Athletics",
        startTime: "14:00",
        endTime: "16:00",
        venue: "Stadium",
      }),
      makeSession({
        comboId: "combo-2",
        sessionCode: "SES-003",
        sport: "Gymnastics",
        startTime: "09:00",
        endTime: "11:00",
        venue: "Gym Arena",
      }),
    ];

    // Query 3: prefs
    const prefs = [
      { sessionId: "SES-001", interest: "high" },
      { sessionId: "SES-002", interest: "low" },
      { sessionId: "SES-003", interest: "medium" },
    ];

    // Query 4: interestedRows
    const interestedRows = [
      {
        sessionId: "SES-001",
        memberId: "member-alice",
        firstName: "Alice",
        lastName: "Smith",
        username: "alice",
        avatarColor: "blue",
      },
    ];

    // Query 5: scheduledRows
    const scheduledRows = [
      {
        sessionId: "SES-001",
        memberId: "member-bob",
        rank: "backup1",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "pink",
      },
    ];

    queryResults = [
      combos,
      comboSessions,
      prefs,
      interestedRows,
      scheduledRows,
      [], // purchaseTimeslot query
    ];

    const result = await getMySchedule("group-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(2);

    // Day 1
    const day1 = result.data![0];
    expect(day1.day).toBe("2026-08-01");
    expect(day1.combos.length).toBe(1);
    expect(day1.combos[0].rank).toBe("primary");
    expect(day1.combos[0].score).toBe(95);
    expect(day1.combos[0].sessions.length).toBe(2);
    // Sessions should be sorted by startTime
    expect(day1.combos[0].sessions[0].sessionCode).toBe("SES-001");
    expect(day1.combos[0].sessions[0].startTime).toBe("10:00");
    expect(day1.combos[0].sessions[0].interest).toBe("high");
    expect(day1.combos[0].sessions[0].interestedMembers).toEqual([
      {
        memberId: "member-alice",
        firstName: "Alice",
        lastName: "Smith",
        username: "alice",
        avatarColor: "blue",
      },
    ]);
    expect(day1.combos[0].sessions[0].scheduledMembers).toEqual([
      {
        memberId: "member-bob",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "pink",
        ranks: ["backup1"],
      },
    ]);
    expect(day1.combos[0].sessions[1].sessionCode).toBe("SES-002");
    expect(day1.combos[0].sessions[1].interest).toBe("low");

    // Day 2
    const day2 = result.data![1];
    expect(day2.day).toBe("2026-08-02");
    expect(day2.combos[0].sessions[0].sessionCode).toBe("SES-003");
    expect(day2.combos[0].sessions[0].interest).toBe("medium");
  });

  it("deduplicates scheduled members keeping best rank", async () => {
    mockGetMembership.mockResolvedValue(membership);

    // Query 1: combos
    const combos = [
      { comboId: "combo-1", day: "2026-08-01", rank: "primary", score: 90 },
    ];

    // Query 2: comboSessions
    const comboSessions = [
      makeSession({ comboId: "combo-1", sessionCode: "SES-001" }),
    ];

    // Query 3: prefs
    const prefs = [{ sessionId: "SES-001", interest: "high" }];

    // Query 4: interestedRows — empty
    const interestedRows: unknown[] = [];

    // Query 5: scheduledRows — same user appears twice with different ranks
    const scheduledRows = [
      {
        sessionId: "SES-001",
        memberId: "member-bob",
        rank: "backup1",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "green",
      },
      {
        sessionId: "SES-001",
        memberId: "member-bob",
        rank: "primary",
        firstName: "Bob",
        lastName: "Jones",
        username: "bob",
        avatarColor: "green",
      },
    ];

    queryResults = [
      combos,
      comboSessions,
      prefs,
      interestedRows,
      scheduledRows,
      [], // purchaseTimeslot query
    ];

    const result = await getMySchedule("group-1");

    expect(result.data).toBeDefined();
    const session = result.data![0].combos[0].sessions[0];
    // Should have only one entry for bob with both ranks collected
    expect(session.scheduledMembers.length).toBe(1);
    expect(session.scheduledMembers[0].username).toBe("bob");
    expect(session.scheduledMembers[0].ranks).toContain("primary");
    expect(session.scheduledMembers[0].ranks).toContain("backup1");
  });

  it("defaults interest to medium when preference not found", async () => {
    mockGetMembership.mockResolvedValue(membership);

    // Query 1: combos
    const combos = [
      { comboId: "combo-1", day: "2026-08-01", rank: "primary", score: 80 },
    ];

    // Query 2: comboSessions
    const comboSessions = [
      makeSession({ comboId: "combo-1", sessionCode: "SES-NOPREF" }),
    ];

    // Query 3: prefs — empty, no preference for this session
    const prefs: unknown[] = [];

    // Query 4: interestedRows — empty
    const interestedRows: unknown[] = [];

    // Query 5: scheduledRows — empty
    const scheduledRows: unknown[] = [];

    queryResults = [
      combos,
      comboSessions,
      prefs,
      interestedRows,
      scheduledRows,
      [], // purchaseTimeslot query
    ];

    const result = await getMySchedule("group-1");

    expect(result.data).toBeDefined();
    const session = result.data![0].combos[0].sessions[0];
    // Should default to "medium" when no preference found
    expect(session.interest).toBe("medium");
  });

  it("computes primaryScore from the primary combo", async () => {
    mockGetMembership.mockResolvedValue(membership);

    const combos = [
      { comboId: "combo-1", day: "2026-08-01", rank: "primary", score: 95 },
      { comboId: "combo-2", day: "2026-08-01", rank: "backup1", score: 80 },
    ];
    const comboSessions = [
      makeSession({ comboId: "combo-1", sessionCode: "SES-001" }),
      makeSession({ comboId: "combo-2", sessionCode: "SES-002" }),
    ];

    queryResults = [
      combos,
      comboSessions,
      [], // prefs
      [], // interestedRows
      [], // scheduledRows
      [], // purchaseTimeslot
    ];

    const result = await getMySchedule("group-1");

    expect(result.data).toBeDefined();
    expect(result.data![0].primaryScore).toBe(95);
    expect(result.data![0].combos).toHaveLength(2);
  });

  it("handles combos with no associated sessions", async () => {
    mockGetMembership.mockResolvedValue(membership);

    // Query 1: combos — one combo
    const combos = [
      { comboId: "combo-1", day: "2026-08-01", rank: "primary", score: 50 },
    ];

    // Query 2: comboSessions — empty (no sessions linked to any combo)
    const comboSessions: unknown[] = [];

    queryResults = [combos, comboSessions];

    const result = await getMySchedule("group-1");

    expect(result.data).toBeDefined();
    // Day exists but the combo has no sessions
    expect(result.data![0].day).toBe("2026-08-01");
    expect(result.data![0].combos[0].sessions).toEqual([]);
  });
});

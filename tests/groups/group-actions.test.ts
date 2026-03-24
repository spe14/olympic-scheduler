import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateGroupName,
  updateDateConfig,
  approveMember,
  denyMember,
  leaveGroup,
  removeMember,
  transferOwnership,
  deleteGroup,
  generateSchedules,
} from "@/app/(main)/groups/[groupId]/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetCurrentUser = vi.fn();
const mockGetMembership = vi.fn();
const mockGetOwnerMembership = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  getMembership: (...args: unknown[]) => mockGetMembership(...args),
  getOwnerMembership: (...args: unknown[]) => mockGetOwnerMembership(...args),
  requireMembership: async (groupId: string) => {
    const membership = await mockGetMembership(groupId);
    if (!membership)
      return {
        membership: null,
        error: { error: "You are not an active member of this group." },
      };
    return { membership, error: null };
  },
  requireOwnerMembership: async (groupId: string, action: string) => {
    const membership = await mockGetOwnerMembership(groupId);
    if (!membership)
      return {
        membership: null,
        error: { error: `Only the group owner can ${action}.` },
      };
    return { membership, error: null };
  },
}));

// Mock DB
const mockLimit = vi.fn();
let directWhereResults: unknown[][] = [];
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
let directFromResults: unknown[][] = [];
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  innerJoin: vi.fn(() => ({ where: mockWhere })),
  then(resolve: (v: unknown) => void) {
    resolve(directFromResults.shift() ?? []);
  },
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => {
  // Build a mock tx that mirrors the db shape
  const txSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => []),
        for: vi.fn(() => ({
          then(r: (v: unknown) => void) {
            r([]);
          },
        })),
        then(r: (v: unknown) => void) {
          r([]);
        },
      })),
    })),
  }));
  const txDeleteWhere = vi.fn(() => Promise.resolve());
  const txUpdateWhere = vi.fn(() => Promise.resolve());
  const tx = {
    select: txSelect,
    delete: vi.fn(() => ({ where: txDeleteWhere })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: txUpdateWhere })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
  };
  return cb(tx);
});

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...(args as [never])),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: {
    id: "id",
    name: "name",
    phase: "phase",
    dateMode: "date_mode",
    consecutiveDays: "consecutive_days",
    startDate: "start_date",
    endDate: "end_date",
    departedMembers: "departed_members",
    affectedBuddyMembers: "affected_buddy_members",
    scheduleGeneratedAt: "schedule_generated_at",
    membersWithNoCombos: "members_with_no_combos",
  },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
    preferenceStep: "preference_step",
    joinedAt: "joined_at",
    statusChangedAt: "status_changed_at",
  },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
  },
  buddyConstraint: { memberId: "member_id", buddyMemberId: "buddy_id" },
  sessionPreference: {
    memberId: "member_id",
    sessionId: "session_id",
    interest: "interest",
  },
  session: {
    sessionCode: "session_code",
    sport: "sport",
    zone: "zone",
    sessionDate: "session_date",
    startTime: "start_time",
    endTime: "end_time",
  },
  travelTime: {
    originZone: "origin_zone",
    destinationZone: "destination_zone",
    drivingMinutes: "driving_minutes",
    transitMinutes: "transit_minutes",
  },
  combo: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
    day: "day",
    rank: "rank",
    score: "score",
  },
  comboSession: { comboId: "combo_id" },
  windowRanking: { groupId: "group_id" },
  ticketPurchase: { id: "id", groupId: "group_id", sessionId: "session_id" },
  ticketPurchaseAssignee: {
    ticketPurchaseId: "ticket_purchase_id",
    memberId: "member_id",
  },
  soldOutSession: { groupId: "group_id", sessionId: "session_id" },
  outOfBudgetSession: {
    groupId: "group_id",
    memberId: "member_id",
    sessionId: "session_id",
  },
  purchaseTimeslot: { groupId: "group_id", memberId: "member_id" },
  purchasePlanEntry: { groupId: "group_id", memberId: "member_id" },
  reportedPrice: {
    groupId: "group_id",
    reportedByMemberId: "reported_by_member_id",
  },
}));

// Mock algorithm runner
const mockRunScheduleGeneration = vi.fn();
vi.mock("@/lib/algorithm/runner", () => ({
  runScheduleGeneration: (...args: unknown[]) =>
    mockRunScheduleGeneration(...args),
}));

// Mock window ranking computation
const mockComputeWindowRankings = vi.fn();
const mockBuildMemberScores = vi.fn(
  (
    combos: { memberId: string; day: string; rank: string; score: number }[]
  ) => {
    const primaryMap = new Map<string, Map<string, number>>();
    const backupMap = new Map<
      string,
      Map<string, { b1: number; b2: number }>
    >();
    for (const c of combos) {
      if (c.rank === "primary") {
        if (!primaryMap.has(c.memberId)) primaryMap.set(c.memberId, new Map());
        primaryMap.get(c.memberId)!.set(c.day, c.score);
      } else if (c.rank === "backup1" || c.rank === "backup2") {
        if (!backupMap.has(c.memberId)) backupMap.set(c.memberId, new Map());
        const existing = backupMap.get(c.memberId)!.get(c.day) ?? {
          b1: 0,
          b2: 0,
        };
        if (c.rank === "backup1") existing.b1 = c.score;
        else existing.b2 = c.score;
        backupMap.get(c.memberId)!.set(c.day, existing);
      }
    }
    return [...primaryMap.entries()].map(([memberId, dailyScores]) => ({
      memberId,
      dailyScores,
      dailyBackupScores: backupMap.get(memberId),
    }));
  }
);
vi.mock("@/lib/algorithm/window-ranking", () => ({
  computeWindowRankings: (...args: unknown[]) =>
    mockComputeWindowRankings(...args),
  buildMemberScores: (...args: unknown[]) =>
    mockBuildMemberScores(...(args as [never])),
}));

// Mock algorithm types (type-only, no runtime exports needed)
vi.mock("@/lib/algorithm/types", () => ({}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const mockUser = { id: "user-1", authId: "auth-123" };

// Helper: set up getOwnerMembership to succeed
function mockOwner() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetOwnerMembership.mockResolvedValue({
    id: "owner-member-1",
    role: "owner",
  });
}

// Helper: set up getOwnerMembership to fail (not owner)
function mockNonOwner() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetOwnerMembership.mockResolvedValue(null);
}

describe("updateGroupName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns error when not logged in", async () => {
    mockGetOwnerMembership.mockResolvedValue(null);
    const fd = makeFormData({ name: "New Name" });
    const result = await updateGroupName("group-1", fd);

    expect(result.error).toContain("owner");
  });

  it("returns error when user is not the owner", async () => {
    mockNonOwner();
    const fd = makeFormData({ name: "New Name" });
    const result = await updateGroupName("group-1", fd);

    expect(result.error).toContain("owner");
  });

  it("returns error for empty name", async () => {
    mockOwner();
    const fd = makeFormData({ name: "" });
    const result = await updateGroupName("group-1", fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain("owner");
    expect(result.error).not.toContain("Failed");
  });

  it("returns error for name over 50 characters", async () => {
    mockOwner();
    const fd = makeFormData({ name: "a".repeat(51) });
    const result = await updateGroupName("group-1", fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain("owner");
    expect(result.error).not.toContain("Failed");
  });

  it("updates name successfully", async () => {
    mockOwner();
    const fd = makeFormData({ name: "New Name" });
    const result = await updateGroupName("group-1", fd);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ name: "New Name" });
  });

  it("returns error when db update fails", async () => {
    mockOwner();
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));
    const fd = makeFormData({ name: "New Name" });
    const result = await updateGroupName("group-1", fd);

    expect(result.error).toContain("Failed to update group name");
  });
});

/**
 * Builds a mock tx for approveMember tests. All count checks, status updates,
 * user lookups, and departed member handling now happen in a single transaction.
 */
function buildApproveTxMock(opts: {
  activeCount: number;
  approvedUser?: {
    userId: string;
    firstName: string;
    lastName: string;
  } | null;
  groupData?: { departedMembers: unknown[] };
}) {
  const setCalls: Record<string, unknown>[] = [];
  const selectQueue: unknown[][] = [
    [{ id: "group-1" }], // FOR UPDATE lock on group
    [{ count: opts.activeCount }], // active member count
  ];
  if (opts.activeCount < 12) {
    // user lookup (only if not full)
    selectQueue.push(opts.approvedUser ? [opts.approvedUser] : []);
    // group data for departed member check (only if user found)
    if (opts.approvedUser) {
      selectQueue.push([opts.groupData ?? { departedMembers: [] }]);
    }
  }

  const makeQueryChain = () => {
    const result = selectQueue.shift() ?? [];
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(() => result),
          limit: vi.fn(() => result),
          then(r: (v: unknown) => void) {
            r(result);
          },
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => result),
          })),
        })),
      })),
    };
  };

  const txMock = {
    select: vi.fn(makeQueryChain),
    update: vi.fn(() => ({
      set: vi.fn((vals: Record<string, unknown>) => {
        setCalls.push(vals);
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
  };

  return { txMock, setCalls };
}

describe("approveMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns error when not the owner", async () => {
    mockNonOwner();
    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("owner");
  });

  it("returns error when target not pending", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([{ id: "member-2", status: "joined" }]);

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("not pending");
  });

  it("returns error when target not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([]); // no target

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("not pending");
  });

  it("approves member successfully", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: { departedMembers: [] },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(setCalls[0]).toEqual(
      expect.objectContaining({ status: "joined", joinedAt: expect.any(Date) })
    );
  });

  it("sets joinedAt to current time on approval", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: { departedMembers: [] },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const before = new Date();
    await approveMember("group-1", "member-2");
    const after = new Date();

    const calledWith = setCalls[0] as { joinedAt: Date };
    expect(calledWith.joinedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
    expect(calledWith.joinedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("returns error when group is full", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock } = buildApproveTxMock({ activeCount: 12 });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("full");
    expect(result.error).toContain("12 members");
  });

  it("returns error when group is at capacity boundary", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock } = buildApproveTxMock({ activeCount: 13 });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("full");
  });

  it("approves when group has 11 active members", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock } = buildApproveTxMock({
      activeCount: 11,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: { departedMembers: [] },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("sets rejoinedAt on departed member entry when rejoining", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: {
        departedMembers: [
          {
            userId: "u-2",
            name: "Jane Doe",
            departedAt: "2028-01-10T12:00:00Z",
          },
          {
            userId: "u-3",
            name: "Bob Smith",
            departedAt: "2028-01-11T12:00:00Z",
          },
        ],
      },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    const groupUpdateCall = setCalls.find(
      (call) => call && typeof call === "object" && "departedMembers" in call
    );
    expect(groupUpdateCall).toBeDefined();
    const updated = (
      groupUpdateCall as {
        departedMembers: {
          name: string;
          departedAt: string;
          rejoinedAt?: string;
        }[];
      }
    ).departedMembers;
    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe("Jane Doe");
    expect(updated[0].rejoinedAt).toBeDefined();
    expect(updated[1].name).toBe("Bob Smith");
    expect(updated[1].rejoinedAt).toBeUndefined();
  });

  it("does not clear affectedBuddyMembers when departed member rejoins", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: {
        departedMembers: [
          {
            userId: "u-2",
            name: "Jane Doe",
            departedAt: "2028-01-10T12:00:00Z",
          },
        ],
      },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    const groupUpdateCall = setCalls.find(
      (call) => call && typeof call === "object" && "departedMembers" in call
    );
    expect(groupUpdateCall).toBeDefined();
    expect(groupUpdateCall).not.toHaveProperty("affectedBuddyMembers");
  });

  it("departed member rejoins — affected members still have entries in affectedBuddyMembers", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: {
        departedMembers: [
          {
            userId: "u-2",
            name: "Jane Doe",
            departedAt: "2028-01-10T12:00:00Z",
          },
        ],
      },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    const groupUpdate = setCalls.find(
      (call) => call && typeof call === "object" && "departedMembers" in call
    );
    expect(groupUpdate).toBeDefined();
    expect(groupUpdate).not.toHaveProperty("affectedBuddyMembers");
  });

  it("does not update group when approved member is not in departedMembers", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const { txMock, setCalls } = buildApproveTxMock({
      activeCount: 5,
      approvedUser: { userId: "u-2", firstName: "Jane", lastName: "Doe" },
      groupData: {
        departedMembers: [
          {
            userId: "u-99",
            name: "Bob Smith",
            departedAt: "2028-01-10T12:00:00Z",
          },
        ],
      },
    });
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)
    );

    await approveMember("group-1", "member-2");

    // Only the member status update, no group update (u-2 not in departed list)
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toEqual(expect.objectContaining({ status: "joined" }));
  });

  it("returns error when transaction fails", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    mockTransaction.mockRejectedValue(new Error("DB error"));

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("Failed to approve");
  });
});

describe("denyMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns error when not the owner", async () => {
    mockNonOwner();
    const result = await denyMember("group-1", "member-2");

    expect(result.error).toContain("owner");
  });

  it("returns error when target not pending", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([{ id: "member-2", status: "joined" }]);

    const result = await denyMember("group-1", "member-2");

    expect(result.error).toContain("not pending");
  });

  it("returns error when target not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([]);

    const result = await denyMember("group-1", "member-2");

    expect(result.error).toContain("not pending");
  });

  it("denies member by setting status to denied", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);

    const result = await denyMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockSet).toHaveBeenCalledWith({ status: "denied" });
  });

  it("returns error when db update fails", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));

    const result = await denyMember("group-1", "member-2");

    expect(result.error).toContain("Failed to deny");
  });
});

// Helper: set up getMembership to return an active non-owner member
function mockActiveMember() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetMembership.mockResolvedValue({
    id: "member-1",
    role: "member",
    status: "joined",
    preferenceStep: null,
  });
}

// Helper: set up getMembership to return the owner
function mockActiveOwner() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetMembership.mockResolvedValue({
    id: "owner-member-1",
    role: "owner",
    status: "joined",
    preferenceStep: null,
  });
}

/**
 * Creates a thenable where mock that supports .limit() and direct .then().
 * If `results` is a queue array, shifts the next result on each call.
 */
function makeThenableWhere(resultOrQueue: unknown[] | (() => unknown[]) = []) {
  const getResult =
    typeof resultOrQueue === "function" ? resultOrQueue : () => resultOrQueue;
  return () => {
    const thenable = {
      limit: vi.fn(() => ({
        then(r: (v: unknown) => void) {
          r(getResult());
        },
        for: vi.fn(() => ({
          then(r: (v: unknown) => void) {
            r(getResult());
          },
        })),
      })),
      for: vi.fn(() => ({
        then(r: (v: unknown) => void) {
          r(getResult());
        },
      })),
      then(r: (v: unknown) => void) {
        r(getResult());
      },
    };
    return thenable;
  };
}

/**
 * Creates a tx.select().from() mock that handles both .where() and .innerJoin().where()
 * chains. If `result` is an array, returns it for all queries. If undefined, returns [].
 */
function makeTxSelectFrom(result: unknown[] = []) {
  return vi.fn(() => ({
    where: vi.fn(makeThenableWhere(result)),
    innerJoin: vi.fn(() => ({
      where: vi.fn(makeThenableWhere(result)),
    })),
  }));
}

/**
 * Creates a tx.select().from() mock that returns sequential results from a queue.
 * Each query call shifts the next result from the queue.
 */
function makeTxSelectFromQueue(queue: unknown[][]) {
  let idx = 0;
  const getNext = () => queue[idx++] ?? [];
  return vi.fn(() => ({
    where: vi.fn(makeThenableWhere(getNext)),
    innerJoin: vi.fn(() => ({
      where: vi.fn(makeThenableWhere(getNext)),
    })),
  }));
}

// Reusable default transaction mock for removeMemberTransaction tests.
function defaultRemoveMemberTxMock() {
  mockTransaction.mockImplementation(
    (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({ from: makeTxSelectFrom() })),
        delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
        })),
      };
      return cb(tx);
    }
  );
}

describe("leaveGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    defaultRemoveMemberTxMock();
  });

  it("returns error when not logged in", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await leaveGroup("group-1");

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error when user has no active membership", async () => {
    mockGetMembership.mockResolvedValue(null);

    const result = await leaveGroup("group-1");

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error when user is the owner", async () => {
    mockActiveOwner();

    const result = await leaveGroup("group-1");

    expect(result.error).toContain("transfer ownership");
    expect(result.error).toContain("Group Settings");
  });

  it("returns error when group not found", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([]); // group not found

    const result = await leaveGroup("group-1");

    expect(result.error).toBe("Group not found.");
  });

  it("succeeds for non-owner member in preferences phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]); // group

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("succeeds for non-owner member in post-preferences phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "schedule_review" }]); // group

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("deletes buddy constraints, session prefs, and member row in transaction", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);

    const deletedTables: string[] = [];
    const txDeleteWhere = vi.fn(() => Promise.resolve());
    const txDelete = vi.fn((table: unknown) => {
      deletedTables.push(String(table));
      return { where: txDeleteWhere };
    });

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({ from: makeTxSelectFrom() })),
          delete: txDelete,
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    // Should delete buddy constraints, session preferences, and member row
    expect(txDelete).toHaveBeenCalledTimes(3);
  });

  it("does not reset affected buddy members to joined/buddies in preferences phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);

    const setCalls: Record<string, unknown>[] = [];
    const txUpdateWhere = vi.fn(() => Promise.resolve());
    const txSet = vi.fn((vals: Record<string, unknown>) => {
      setCalls.push(vals);
      return { where: txUpdateWhere };
    });
    const txUpdate = vi.fn(() => ({ set: txSet }));

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: makeTxSelectFrom([{ memberId: "member-3" }]),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: txUpdate,
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    // Affected members are no longer reset to joined/buddies
    expect(setCalls).not.toContainEqual({
      status: "joined",
      preferenceStep: "buddies",
    });
  });

  it("deletes algorithm outputs and resets group phase in post-preferences phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "schedule_review" }]);

    const setCalls: Record<string, unknown>[] = [];
    let deleteCount = 0;
    const txDeleteWhere = vi.fn(() => Promise.resolve());
    const txUpdateWhere = vi.fn(() => Promise.resolve());
    const txSet = vi.fn((vals: Record<string, unknown>) => {
      setCalls.push(vals);
      return { where: txUpdateWhere };
    });

    // Queue: 1) affected buddies, 2) group data, 3) departing user
    const queryQueue: unknown[][] = [
      [], // no affected buddies
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Test",
          lastName: "User",
          joinedAt: new Date("2028-01-01"),
          userId: "user-test",
        },
      ],
    ];
    let qIdx = 0;
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeWhere = () => {
          const res = () => queryQueue[qIdx++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeWhere),
              innerJoin: vi.fn(() => ({ where: vi.fn(makeWhere) })),
            })),
          })),
          delete: vi.fn(() => {
            deleteCount++;
            return { where: txDeleteWhere };
          }),
          update: vi.fn(() => ({ set: txSet })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    // Post-preferences: deletes buddy constraints, session prefs, combo_session,
    // combo, window_ranking, member
    expect(deleteCount).toBeGreaterThanOrEqual(6);
    // Should reset group phase to preferences
    expect(setCalls).toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // Should reset non-buddy member statuses to preferences_set with statusChangedAt
    expect(setCalls).toContainEqual({
      status: "preferences_set",
      statusChangedAt: expect.any(Date),
    });
  });

  it("does not delete algorithm outputs or reset group in preferences phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);

    const setCalls: Record<string, unknown>[] = [];
    let deleteCount = 0;

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({ from: makeTxSelectFrom() })),
          delete: vi.fn(() => {
            deleteCount++;
            return { where: vi.fn(() => Promise.resolve()) };
          }),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    // Preferences phase: only deletes buddy constraints, session prefs, member row
    expect(deleteCount).toBe(3);
    // Should NOT reset group phase
    expect(setCalls).not.toContainEqual({ phase: "preferences" });
  });

  it("persists affectedBuddyMembers when leaving during preferences phase with buddy connections", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);

    const setCalls: Record<string, unknown>[] = [];

    // Queue: 1) affected buddies, 2) group data (no schedule), 3) departing user
    const queryQueue: unknown[][] = [
      [{ memberId: "member-3" }], // member-3 had departing member as buddy
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: null,
        },
      ],
      [
        {
          firstName: "Test",
          lastName: "User",
          joinedAt: null,
          userId: "user-test",
        },
      ],
    ];
    let qIdx = 0;
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeWhere = () => {
          const res = () => queryQueue[qIdx++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeWhere),
              innerJoin: vi.fn(() => ({ where: vi.fn(makeWhere) })),
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    // Should persist affectedBuddyMembers even without a schedule
    expect(setCalls).toContainEqual({
      affectedBuddyMembers: { "member-3": ["Test User"] },
    });
    // Should NOT reset phase or delete algorithm outputs
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
  });

  it("returns error when transaction fails", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await leaveGroup("group-1");

    expect(result.error).toBe("Failed to leave group. Please try again.");
  });

  it("returns race condition error when member became owner during transaction", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const txQueryResults: unknown[][] = [
      [], // affected buddies
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: null,
        },
      ], // group data
      [
        {
          role: "owner",
          userId: "user-1",
          firstName: "Test",
          lastName: "User",
          joinedAt: null,
        },
      ], // departing user — now owner
    ];
    let queryIndex = 0;
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeThenableWhere = () => {
          const res = () => txQueryResults[queryIndex++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeThenableWhere),
              innerJoin: vi.fn(() => ({
                where: vi.fn(makeThenableWhere),
              })),
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.error).toBe(
      "You became the group owner while leaving. Please refresh the page."
    );
  });
});

describe("removeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    defaultRemoveMemberTxMock();
  });

  it("returns error when caller is not the owner", async () => {
    mockNonOwner();

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can remove members.");
  });

  it("returns error when not logged in", async () => {
    mockGetOwnerMembership.mockResolvedValue(null);

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can remove members.");
  });

  it("returns error when target member not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([]); // target not found

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Member not found.");
  });

  it("returns error when target is the owner", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "owner-member-1",
        role: "owner",
        status: "joined",
        groupId: "group-1",
      },
    ]);

    const result = await removeMember("group-1", "owner-member-1");

    expect(result.error).toBe("Cannot remove the group owner.");
  });

  it("returns error when target is pending_approval", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "pending_approval",
        groupId: "group-1",
      },
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Cannot remove a pending or denied member.");
  });

  it("returns error when target is denied", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "denied",
        groupId: "group-1",
      },
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Cannot remove a pending or denied member.");
  });

  it("returns error when group not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]); // target found
    mockLimit.mockResolvedValueOnce([]); // group not found

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Group not found.");
  });

  it("succeeds for valid target in preferences phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]); // group

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("succeeds for valid target in post-preferences phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "schedule_review" }]); // group

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("deletes algorithm outputs and resets group in post-preferences phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "schedule_review" }]);

    const setCalls: Record<string, unknown>[] = [];
    let deleteCount = 0;

    // Queue: 1) affected buddies, 2) group data, 3) departing user
    const queryQueue: unknown[][] = [
      [], // no affected buddies
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Test",
          lastName: "User",
          joinedAt: new Date("2028-01-01"),
          userId: "user-test",
        },
      ],
    ];
    let qIdx = 0;
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeWhere = () => {
          const res = () => queryQueue[qIdx++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeWhere),
              innerJoin: vi.fn(() => ({ where: vi.fn(makeWhere) })),
            })),
          })),
          delete: vi.fn(() => {
            deleteCount++;
            return { where: vi.fn(() => Promise.resolve()) };
          }),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
        };
        return cb(tx);
      }
    );

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Post-preferences: deletes buddy constraints, session prefs, combo_session,
    // combo, window_ranking, member
    expect(deleteCount).toBeGreaterThanOrEqual(6);
    // Should reset group phase to preferences
    expect(setCalls).toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // Should reset non-buddy member statuses to preferences_set with statusChangedAt
    expect(setCalls).toContainEqual({
      status: "preferences_set",
      statusChangedAt: expect.any(Date),
    });
  });

  it("does not reset affected buddy members to joined/buddies when removing in preferences phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);

    const setCalls: Record<string, unknown>[] = [];

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: makeTxSelectFrom([{ memberId: "member-3" }]),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
        };
        return cb(tx);
      }
    );

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Affected members are no longer reset to joined/buddies
    expect(setCalls).not.toContainEqual({
      status: "joined",
      preferenceStep: "buddies",
    });
  });

  it("returns error when transaction fails", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Failed to remove member. Please try again.");
  });

  it("returns race condition error when target became owner during transaction", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const txQueryResults: unknown[][] = [
      [], // affected buddies
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: null,
        },
      ], // group data
      [
        {
          role: "owner",
          userId: "user-2",
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: null,
        },
      ], // target — now owner
    ];
    let queryIndex = 0;
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeThenableWhere = () => {
          const res = () => txQueryResults[queryIndex++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeThenableWhere),
              innerJoin: vi.fn(() => ({
                where: vi.fn(makeThenableWhere),
              })),
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe(
      "This member is now the group owner and cannot be removed."
    );
  });
});

describe("transferOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    // Reset transaction to default (succeeds)
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txUpdateWhere = vi.fn(() => Promise.resolve());
        const tx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: txUpdateWhere })),
          })),
        };
        return cb(tx);
      }
    );
  });

  it("returns error when caller is not the owner", async () => {
    mockNonOwner();

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can transfer ownership.");
  });

  it("returns error when not logged in", async () => {
    mockGetOwnerMembership.mockResolvedValue(null);

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can transfer ownership.");
  });

  it("returns error when target is the owner themselves", async () => {
    mockOwner();

    const result = await transferOwnership("group-1", "owner-member-1");

    expect(result.error).toBe("You are already the owner.");
  });

  it("returns error when target member not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([]); // target not found

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe("Member not found.");
  });

  it("returns error when target is pending_approval", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "pending_approval",
        groupId: "group-1",
      },
    ]);

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe(
      "Cannot transfer ownership to a pending or denied member."
    );
  });

  it("returns error when target is denied", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "denied",
        groupId: "group-1",
      },
    ]);

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe(
      "Cannot transfer ownership to a pending or denied member."
    );
  });

  it("succeeds for valid active member", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);

    // In-transaction: first select uses .for("update") (group lock),
    // second select uses .limit(1) (target member re-verification).
    mockTransaction.mockImplementationOnce(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => [{ id: "member-2", status: "joined" }]),
                for: vi.fn(() => ({
                  then(r: (v: unknown) => void) {
                    r([]);
                  },
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await transferOwnership("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("succeeds for member with preferences_set status", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);

    mockTransaction.mockImplementationOnce(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => [
                  { id: "member-2", status: "preferences_set" },
                ]),
                for: vi.fn(() => ({
                  then(r: (v: unknown) => void) {
                    r([]);
                  },
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await transferOwnership("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error when transaction fails", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe(
      "Failed to transfer ownership. Please try again."
    );
  });

  it("returns error when target member left during transaction", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "joined",
        groupId: "group-1",
      },
    ]);

    mockTransaction.mockImplementationOnce(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => []), // target not found in tx
                for: vi.fn(() => ({
                  then(r: (v: unknown) => void) {
                    r([]);
                  },
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe("Member not found.");
  });
});

describe("deleteGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockDeleteWhere.mockReset();
    directWhereResults = [];
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  it("returns error when not logged in", async () => {
    mockGetOwnerMembership.mockResolvedValue(null);

    const result = await deleteGroup("group-1");

    expect(result.error).toBe("Only the group owner can delete the group.");
  });

  it("returns error when user is not the owner", async () => {
    mockNonOwner();

    const result = await deleteGroup("group-1");

    expect(result.error).toBe("Only the group owner can delete the group.");
  });

  it("succeeds for owner using cascade delete", async () => {
    mockOwner();
    mockDeleteWhere.mockResolvedValue(undefined);

    const result = await deleteGroup("group-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // Uses a single DELETE on the group row — cascades handle related data
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("returns error when delete fails", async () => {
    mockOwner();
    mockDeleteWhere.mockRejectedValue(new Error("DB error"));

    const result = await deleteGroup("group-1");

    expect(result.error).toBe("Failed to delete group. Please try again.");
  });
});

describe("updateDateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    // Restore default mockTransaction implementation for updateDateConfig
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txSelect = vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => []),
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r([]);
                },
              })),
              then(r: (v: unknown) => void) {
                r([]);
              },
            })),
          })),
        }));
        const txDeleteWhere = vi.fn(() => Promise.resolve());
        const txUpdateWhere = vi.fn(() => Promise.resolve());
        const tx = {
          select: txSelect,
          delete: vi.fn(() => ({ where: txDeleteWhere })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: txUpdateWhere })),
          })),
          insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
        };
        return cb(tx);
      }
    );
  });

  it("returns error when not logged in", async () => {
    mockGetOwnerMembership.mockResolvedValue(null);
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("owner");
  });

  it("returns error when user is not the owner", async () => {
    mockNonOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("owner");
  });

  it("updates to consecutive mode successfully", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("updates to specific mode successfully", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("clears specific date fields when switching to consecutive", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "3" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("clears consecutive days when switching to specific", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-12",
      endDate: "2028-07-20",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns error for invalid consecutive days (0)", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "0" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for consecutive days over 19", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "20" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("accepts consecutive days at boundary 1", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "1" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
  });

  it("accepts consecutive days at boundary 19", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "19" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
  });

  it("returns error for non-integer consecutive days", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "consecutive",
      consecutiveDays: "2.5",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for reversed date range", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-20",
      endDate: "2028-07-14",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for start date before Olympic period", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-11",
      endDate: "2028-07-14",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for end date after Olympic period", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-31",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("accepts dates at Olympic period boundaries", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-12",
      endDate: "2028-07-30",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
  });

  it("returns error for missing start date in specific mode", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "",
      endDate: "2028-07-18",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for missing end date in specific mode", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("returns error for invalid date mode", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "unknown" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBe("Invalid date mode.");
  });

  it("returns error for empty date mode", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toBe("Invalid date mode.");
  });

  it("returns error when db update fails for consecutive mode", async () => {
    mockOwner();
    mockTransaction.mockRejectedValue(new Error("DB error"));
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("Failed to update date configuration");
  });

  it("returns error when db update fails for specific mode", async () => {
    mockOwner();
    mockTransaction.mockRejectedValue(new Error("DB error"));
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("Failed to update date configuration");
  });

  it("recomputes window rankings when combos exist", async () => {
    mockOwner();

    // Track calls inside the transaction
    let insertValuesCalled = false;
    let deleteCalled = false;

    // Tx query queue:
    // 1. tx.select({scheduleGeneratedAt}).from(group).where().limit() → truthy
    // 2. tx.select({memberId,day,score,rank}).from(combo).where() → combo data
    const txQueryQueue: unknown[][] = [
      [{ scheduleGeneratedAt: "2028-01-01" }],
      [
        { memberId: "m1", day: "2028-07-12", score: 80, rank: "primary" },
        { memberId: "m1", day: "2028-07-13", score: 70, rank: "primary" },
        { memberId: "m1", day: "2028-07-12", score: 60, rank: "backup1" },
        { memberId: "m1", day: "2028-07-12", score: 40, rank: "backup2" },
      ],
    ];
    let qIdx = 0;

    mockComputeWindowRankings.mockReturnValue([
      { startDate: "2028-07-12", endDate: "2028-07-16", score: 150 },
    ]);

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeThenableWhere = () => {
          const res = () => txQueryQueue[qIdx++] ?? [];
          return {
            limit: vi.fn(() => {
              return res();
            }),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeThenableWhere),
            })),
          })),
          delete: vi.fn(() => {
            deleteCalled = true;
            return { where: vi.fn(() => Promise.resolve()) };
          }),
          insert: vi.fn(() => ({
            values: vi.fn(() => {
              insertValuesCalled = true;
              return Promise.resolve();
            }),
          })),
        };
        return cb(tx);
      }
    );

    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockComputeWindowRankings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateMode: "consecutive",
        consecutiveDays: 5,
      })
    );
    expect(deleteCalled).toBe(true);
    expect(insertValuesCalled).toBe(true);
  });

  it("skips window ranking computation when no combos exist", async () => {
    mockOwner();

    // Tx query queue:
    // 1. tx.select({scheduleGeneratedAt}).from(group).where().limit() → truthy
    // 2. tx.select({...}).from(combo).where() → empty array
    const txQueryQueue: unknown[][] = [
      [{ scheduleGeneratedAt: "2028-01-01" }],
      [], // no combos
    ];
    let qIdx = 0;

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeThenableWhere = () => {
          const res = () => txQueryQueue[qIdx++] ?? [];
          return {
            limit: vi.fn(() => {
              return res();
            }),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const tx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(makeThenableWhere),
            })),
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve()),
          })),
        };
        return cb(tx);
      }
    );

    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // computeWindowRankings should NOT be called since no combos
    expect(mockComputeWindowRankings).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeMemberTransaction — departure tracking & schedule preservation
// ─────────────────────────────────────────────────────────────────────────────

describe("removeMember — departure tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  /**
   * Builds a mock transaction that returns sequential query results.
   * txQueryResults is an array of arrays — each inner array is returned by the next
   * tx.select().from().where() / .innerJoin().where() / .limit() call (in order).
   */
  function buildTx(
    txQueryResults: unknown[][],
    opts?: { trackSets?: boolean; trackDeletes?: boolean }
  ) {
    const setCalls: Record<string, unknown>[] = [];
    let deleteCount = 0;
    let queryIndex = 0;

    const txDeleteWhere = vi.fn(() => Promise.resolve());
    const txUpdateWhere = vi.fn(() => Promise.resolve());

    const makeThenableWhere = () => {
      const res = () => txQueryResults[queryIndex++] ?? [];
      return {
        limit: vi.fn(() => ({
          then(r: (v: unknown) => void) {
            r(res());
          },
          for: vi.fn(() => ({
            then(r: (v: unknown) => void) {
              r(res());
            },
          })),
        })),
        for: vi.fn(() => ({
          then(r: (v: unknown) => void) {
            r(res());
          },
        })),
        then(r: (v: unknown) => void) {
          r(res());
        },
      };
    };

    const txFrom = vi.fn(() => ({
      where: vi.fn(makeThenableWhere),
      innerJoin: vi.fn(() => ({
        where: vi.fn(makeThenableWhere),
      })),
    }));

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({ from: txFrom })),
          delete: vi.fn(() => {
            deleteCount++;
            return { where: txDeleteWhere };
          }),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: txUpdateWhere };
            }),
          })),
        };
        return cb(tx);
      }
    );

    return { setCalls, getDeleteCount: () => deleteCount };
  }

  it("records departed member name when departing member was part of schedule", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      // 1. affectedBuddies query — none
      [],
      // 2. grpData query
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // 3. departingUser query (innerJoin)
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Should have set departedMembers with the name+timestamp, phase regression, affectedBuddyMembers, and cleared membersWithNoCombos
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        phase: "preferences",
        departedMembers: [
          {
            userId: "user-bob",
            name: "Bob Jones",
            departedAt: expect.any(String),
          },
        ],
        affectedBuddyMembers: {},
        membersWithNoCombos: [],
      })
    );
  });

  it("does NOT record departed member or delete combos when member joined after schedule generation", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      // 1. affectedBuddies — none
      [],
      // 2. grpData
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // 3. departingUser — joined AFTER schedule generation
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-02-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Should NOT record departed member name
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
    // Should NOT reset group phase
    expect(setCalls).not.toContainEqual({ phase: "preferences" });
    // Should only delete: buddy constraints, session prefs, member row (3 deletes)
    // NOT combo/comboSession/windowRanking
    expect(getDeleteCount()).toBe(3);
  });

  it("records affectedBuddyMembers when departing member has buddy connections in post-preferences phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      // 1. affectedBuddies — member-3 had departing member as buddy
      [{ memberId: "member-3" }],
      // 2. grpData
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // 3. departingUser
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Should record affected buddy mapping (values are arrays now)
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        affectedBuddyMembers: { "member-3": ["Bob Jones"] },
      })
    );
  });

  it("appends to existing departedMembers array", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      [],
      [
        {
          departedMembers: [
            {
              userId: "user-alice",
              name: "Alice Smith",
              departedAt: "2028-01-14T00:00:00Z",
            },
          ],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        departedMembers: [
          {
            userId: "user-alice",
            name: "Alice Smith",
            departedAt: "2028-01-14T00:00:00Z",
          },
          {
            userId: "user-bob",
            name: "Bob Jones",
            departedAt: expect.any(String),
          },
        ],
      })
    );
  });

  it("merges into existing affectedBuddyMembers map", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      // member-4 had departing member-2 as buddy
      [{ memberId: "member-4" }],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: { "member-3": ["Alice Smith"] },
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        affectedBuddyMembers: {
          "member-3": ["Alice Smith"],
          "member-4": ["Bob Jones"],
        },
      })
    );
  });

  it("persists affectedBuddyMembers cleanup even when no new affected buddies", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      // No affected buddies
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Combined update includes affectedBuddyMembers (cleaned) and departedMembers
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        departedMembers: [
          {
            userId: "user-bob",
            name: "Bob Jones",
            departedAt: expect.any(String),
          },
        ],
        affectedBuddyMembers: {},
      })
    );
  });

  it("deletes algorithm outputs and regresses phase to preferences when wasPartOfSchedule is true", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Should reset group phase to preferences
    expect(setCalls).toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // Should reset non-buddy member statuses to preferences_set with statusChangedAt
    expect(setCalls).toContainEqual({
      status: "preferences_set",
      statusChangedAt: expect.any(Date),
    });
    // Step 4 NOT triggered (no affected buddies)
    expect(setCalls).not.toContainEqual({
      status: "joined",
      preferenceStep: "buddies",
    });
  });

  it("does NOT delete combos when departing member has null joinedAt", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // departingUser has null joinedAt — wasPartOfSchedule should be false
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: null,
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // null joinedAt means wasPartOfSchedule is falsy — no combo deletion
    expect(getDeleteCount()).toBe(3); // only buddy constraints, session prefs, member
    expect(setCalls).not.toContainEqual({ phase: "preferences" });
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
  });

  it("does NOT delete combos when group has null scheduleGeneratedAt", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: null, // no schedule generated yet
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // null scheduleGeneratedAt means wasPartOfSchedule is falsy
    expect(getDeleteCount()).toBe(3);
    expect(setCalls).not.toContainEqual({ phase: "preferences" });
  });

  it("records affected buddies even when wasPartOfSchedule is false", async () => {
    // This tests that affectedBuddyMembers tracking is independent of wasPartOfSchedule
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      // member-3 had departing member as buddy
      [{ memberId: "member-3" }],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // departed AFTER schedule generation — wasPartOfSchedule = false
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-02-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // affectedBuddyMembers SHOULD still be recorded even though wasPartOfSchedule is false
    expect(setCalls).toContainEqual({
      affectedBuddyMembers: { "member-3": ["Bob Jones"] },
    });
    // But combos should NOT be deleted (only 3 base deletes + member)
    // and phase should NOT be reset
    expect(setCalls).not.toContainEqual({ phase: "preferences" });
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
  });

  it("cleans up departing member's own affectedBuddyMembers entry", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      [],
      [
        {
          departedMembers: [],
          // member-2 was previously affected by a departure — now they're also leaving
          affectedBuddyMembers: {
            "member-2": ["Alice Smith"],
            "member-3": ["Alice Smith"],
          },
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-02-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // member-2's entry should be cleaned up since they're departing
    expect(setCalls).toContainEqual({
      affectedBuddyMembers: { "member-3": ["Alice Smith"] },
    });
  });

  it("wasPartOfSchedule=true with buddy connections: all members→preferences_set, phase→preferences", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      // member-3 had departing member as buddy
      [{ memberId: "member-3" }],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // departed BEFORE schedule generation — wasPartOfSchedule = true
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Affected members are no longer reset to joined/buddies
    expect(setCalls).not.toContainEqual({
      status: "joined",
      preferenceStep: "buddies",
    });
    // All remaining active members (including affected) reset to preferences_set with statusChangedAt
    expect(setCalls).toContainEqual({
      status: "preferences_set",
      statusChangedAt: expect.any(Date),
    });
    // Phase regressed
    expect(setCalls).toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // Algorithm outputs deleted (buddy constraints + session prefs + combo_session + combo + window_ranking + member)
    expect(getDeleteCount()).toBeGreaterThanOrEqual(6);
    // affectedBuddyMembers recorded
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        affectedBuddyMembers: { "member-3": ["Bob Jones"] },
      })
    );
  });

  it("removeMember during preferences phase with buddy connections persists affectedBuddyMembers", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      // member-3 had departing member as buddy
      [{ memberId: "member-3" }],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: null, // no schedule generated
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: null,
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // affectedBuddyMembers persisted even without a schedule
    expect(setCalls).toContainEqual({
      affectedBuddyMembers: { "member-3": ["Bob Jones"] },
    });
    // No phase regression (was already preferences)
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // No departedMembers (no schedule to depart from)
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
    // Only base deletes (buddy constraints, session prefs, member)
    expect(getDeleteCount()).toBe(3);
  });

  it("schedule_review phase departure with wasPartOfSchedule=true triggers regression", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Algorithm outputs deleted
    expect(getDeleteCount()).toBeGreaterThanOrEqual(6);
    // Phase regressed to preferences
    expect(setCalls).toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // Non-buddy members reset with statusChangedAt
    expect(setCalls).toContainEqual({
      status: "preferences_set",
      statusChangedAt: expect.any(Date),
    });
    // Departed member recorded
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        departedMembers: [
          {
            userId: "user-bob",
            name: "Bob Jones",
            departedAt: expect.any(String),
          },
        ],
      })
    );
  });

  it("schedule_review phase departure with wasPartOfSchedule=false preserves schedules", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", role: "member", status: "joined", groupId: "group-1" },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      [],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // joined AFTER schedule generation
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-02-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Schedules preserved — only base deletes
    expect(getDeleteCount()).toBe(3);
    // Phase NOT regressed
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // No departed member recorded
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
    // No non-buddy status reset
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({
        status: "preferences_set",
        statusChangedAt: expect.any(Date),
      })
    );
  });

  it("wasPartOfSchedule=false with buddy connections: schedules preserved, buddies tracked, no joined/buddies reset", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls, getDeleteCount } = buildTx([
      [{ memberId: "member-3" }],
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // joined AFTER schedule generation
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-02-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // Affected members are no longer reset to joined/buddies
    expect(setCalls).not.toContainEqual({
      status: "joined",
      preferenceStep: "buddies",
    });
    // affectedBuddyMembers tracked
    expect(setCalls).toContainEqual({
      affectedBuddyMembers: { "member-3": ["Bob Jones"] },
    });
    // Schedules preserved — only base deletes (buddy constraints, session prefs, member)
    expect(getDeleteCount()).toBe(3);
    // Phase NOT regressed
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ phase: "preferences" })
    );
    // No departed member recorded
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ departedMembers: expect.anything() })
    );
    // No non-buddy status reset
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({
        status: "preferences_set",
        statusChangedAt: expect.any(Date),
      })
    );
  });

  it("appends to existing affected buddy names array for same member", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "preferences_set",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const { setCalls } = buildTx([
      [{ memberId: "member-3" }],
      [
        {
          departedMembers: [
            { name: "Alice Smith", departedAt: "2028-01-14T00:00:00Z" },
          ],
          // member-3 was already affected by Alice Smith's departure
          affectedBuddyMembers: { "member-3": ["Alice Smith"] },
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      [
        {
          firstName: "Bob",
          lastName: "Jones",
          joinedAt: new Date("2028-01-01"),
          userId: "user-bob",
        },
      ],
    ]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    // member-3 should now have both departed buddy names
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        affectedBuddyMembers: { "member-3": ["Alice Smith", "Bob Jones"] },
      })
    );
  });
});

describe("leaveGroup — departure tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("records affected buddy members and departed name when leaving in schedule_review phase", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]);

    const setCalls: Record<string, unknown>[] = [];
    let queryIndex = 0;
    const txQueryResults: unknown[][] = [
      // 1. affectedBuddies — member-3 had member-1 as buddy
      [{ memberId: "member-3" }],
      // 2. grpData
      [
        {
          departedMembers: [],
          affectedBuddyMembers: {},
          scheduleGeneratedAt: new Date("2028-01-15"),
        },
      ],
      // 3. departingUser
      [
        {
          firstName: "John",
          lastName: "Doe",
          joinedAt: new Date("2028-01-01"),
          userId: "user-john",
        },
      ],
    ];

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const makeThenableWhere = () => {
          const res = () => txQueryResults[queryIndex++] ?? [];
          return {
            limit: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
              for: vi.fn(() => ({
                then(r: (v: unknown) => void) {
                  r(res());
                },
              })),
            })),
            for: vi.fn(() => ({
              then(r: (v: unknown) => void) {
                r(res());
              },
            })),
            then(r: (v: unknown) => void) {
              r(res());
            },
          };
        };
        const txFrom = vi.fn(() => ({
          where: vi.fn(makeThenableWhere),
          innerJoin: vi.fn(() => ({ where: vi.fn(makeThenableWhere) })),
        }));
        const tx = {
          select: vi.fn(() => ({ from: txFrom })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
        };
        return cb(tx);
      }
    );

    const result = await leaveGroup("group-1");

    expect(result.success).toBe(true);
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        affectedBuddyMembers: { "member-3": ["John Doe"] },
      })
    );
    expect(setCalls).toContainEqual(
      expect.objectContaining({
        departedMembers: [
          {
            userId: "user-john",
            name: "John Doe",
            departedAt: expect.any(String),
          },
        ],
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSchedules
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    directFromResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns error when not the owner", async () => {
    mockNonOwner();

    const result = await generateSchedules("group-1");

    expect(result.error).toBe("Only the group owner can generate schedules.");
  });

  it("returns error when affectedBuddyMembers is non-empty", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        phase: "preferences",
        affectedBuddyMembers: { "member-2": ["Bob Jones"] },
      },
    ]);

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "All affected members must review their preferences before generating schedules."
    );
  });

  it("returns error when group not found", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([]); // group not found

    const result = await generateSchedules("group-1");

    expect(result.error).toBe("Group not found.");
  });

  it("returns error when group phase is invalid", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        phase: "invalid_phase",
        affectedBuddyMembers: {},
      },
    ]);

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "Schedules can only be generated during the preferences or schedule review phase."
    );
  });

  it("returns error when all members don't have preferences set", async () => {
    mockOwner();
    // Group data (via mockLimit)
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);
    // activeMembers query — one member has status "joined" (not preferences_set)
    directWhereResults.push([
      { id: "m1", status: "preferences_set", minBuddies: 0, sportRankings: [] },
      { id: "m2", status: "joined", minBuddies: 0, sportRankings: [] },
    ]);

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "All members must have their preferences set before generating schedules."
    );
  });

  it("generates schedules successfully and returns success", async () => {
    mockOwner();
    // 1. Group data (via mockLimit)
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers (via directWhereResults)
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["tennis"],
      },
      {
        id: "m2",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["swimming"],
      },
    ]);

    // 3. buddies (via directWhereResults)
    directWhereResults.push([]);

    // 4. sessionPrefs (innerJoin path — still goes through mockWhere via directWhereResults)
    directWhereResults.push([
      {
        memberId: "m1",
        sessionCode: "S001",
        sport: "tennis",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "09:00",
        endTime: "12:00",
        interest: "must_see",
      },
    ]);

    // 5. travelEntries (via directFromResults — no .where())
    directFromResults.push([
      {
        originZone: "Z1",
        destinationZone: "Z2",
        drivingMinutes: 30,
        transitMinutes: 45,
      },
    ]);

    // 6. soldOutSessions (via directWhereResults)
    directWhereResults.push([]);

    // 7. outOfBudgetSessions (via directWhereResults)
    directWhereResults.push([]);

    // 8. purchaseAssignees (innerJoin path — via directWhereResults)
    directWhereResults.push([]);

    // Mock algorithm result
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 100,
          sessionCodes: ["S001"],
        },
        {
          memberId: "m2",
          day: "2028-07-12",
          rank: "primary",
          score: 90,
          sessionCodes: [],
        },
      ],
      membersWithNoCombos: [],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    // Mock window rankings
    mockComputeWindowRankings.mockReturnValue([
      { startDate: "2028-07-12", endDate: "2028-07-16", score: 190 },
    ]);

    // Transaction mock for the write phase
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          // lock query: group phase re-check
          [{ phase: "preferences" }],
          // member count check
          [{ count: 2 }],
          // dateConfig query inside tx
          [
            {
              dateMode: "consecutive",
              consecutiveDays: 5,
              startDate: null,
              endDate: null,
            },
          ],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.success).toBe(true);
    expect(result.membersWithNoCombos).toBeUndefined();
    expect(mockRunScheduleGeneration).toHaveBeenCalledTimes(1);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockComputeWindowRankings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateMode: "consecutive",
        consecutiveDays: 5,
      })
    );
  });

  it("returns membersWithNoCombos when some members have no combos", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      { id: "m1", status: "preferences_set", minBuddies: 0, sportRankings: [] },
      { id: "m2", status: "preferences_set", minBuddies: 0, sportRankings: [] },
    ]);

    // 3. buddies
    directWhereResults.push([]);

    // 4. sessionPrefs (innerJoin)
    directWhereResults.push([]);

    // 5. travelEntries (no where)
    directFromResults.push([]);

    // 6. soldOutSessions
    directWhereResults.push([]);

    // 7. outOfBudgetSessions
    directWhereResults.push([]);

    // 8. purchaseAssignees (innerJoin)
    directWhereResults.push([]);

    // Algorithm returns some members with no combos
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 50,
          sessionCodes: [],
        },
      ],
      membersWithNoCombos: ["m2"],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    // Transaction — newPhase will be "preferences" since membersWithNoCombos is non-empty
    // So window rankings computation is skipped
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          // lock query: group phase re-check
          [{ phase: "preferences" }],
          // member count check
          [{ count: 2 }],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.success).toBe(true);
    expect(result.membersWithNoCombos).toEqual(["m2"]);
    expect(mockRunScheduleGeneration).toHaveBeenCalledTimes(1);
    // Window rankings NOT computed because newPhase is "preferences"
    expect(mockComputeWindowRankings).not.toHaveBeenCalled();
  });

  it("returns error when transaction fails", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      { id: "m1", status: "preferences_set", minBuddies: 0, sportRankings: [] },
    ]);

    // 3. buddies
    directWhereResults.push([]);

    // 4. sessionPrefs
    directWhereResults.push([]);

    // 5. travelEntries
    directFromResults.push([]);

    mockRunScheduleGeneration.mockReturnValue({
      combos: [],
      membersWithNoCombos: [],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    // Transaction rejects
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "Failed to generate schedules. Please try again."
    );
  });

  it("filters sold-out and out-of-budget sessions, injects locked sessions, and tracks excluded sessions", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["Swimming"],
      },
    ]);

    // 3. buddies — one hard, one soft
    directWhereResults.push([
      { memberId: "m1", buddyMemberId: "m2", type: "hard" },
      { memberId: "m1", buddyMemberId: "m3", type: "soft" },
    ]);

    // 4. sessionPrefs — S001 is normal, S002 will be sold-out, S003 will be OOB
    directWhereResults.push([
      {
        memberId: "m1",
        sessionCode: "S001",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "09:00",
        endTime: "12:00",
        interest: "high",
      },
      {
        memberId: "m1",
        sessionCode: "S002",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "13:00",
        endTime: "15:00",
        interest: "medium",
      },
      {
        memberId: "m1",
        sessionCode: "S003",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-13",
        startTime: "09:00",
        endTime: "12:00",
        interest: "low",
      },
    ]);

    // 5. travelEntries (no where — directFromResults)
    directFromResults.push([]);

    // 6. soldOutSessions — S002 is sold out
    directWhereResults.push([{ sessionId: "S002" }]);

    // 7. oobSessions — S003 is out of budget for m1
    directWhereResults.push([{ memberId: "m1", sessionId: "S003" }]);

    // 8. purchaseAssignees — m1 purchased S-LOCKED (not in preferences)
    directWhereResults.push([{ memberId: "m1", sessionId: "S-LOCKED" }]);

    // 9. missingLockedSessions query (for S-LOCKED, which is not in sessionPrefs)
    directWhereResults.push([
      {
        sessionCode: "S-LOCKED",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-14",
        startTime: "10:00",
        endTime: "12:00",
      },
    ]);

    // Mock algorithm
    mockRunScheduleGeneration.mockImplementation((membersData: unknown[]) => {
      // Verify membersData was assembled correctly
      const m = membersData as {
        memberId: string;
        hardBuddies: string[];
        softBuddies: string[];
        candidateSessions: { sessionCode: string }[];
        lockedSessionCodes?: string[];
      }[];
      const member = m[0];
      // Should have hard buddy m2 and soft buddy m3
      expect(member.hardBuddies).toEqual(["m2"]);
      expect(member.softBuddies).toEqual(["m3"]);
      // S002 (sold out) and S003 (OOB) should be excluded; S001 + S-LOCKED should remain
      const codes = member.candidateSessions.map((s) => s.sessionCode);
      expect(codes).toContain("S001");
      expect(codes).toContain("S-LOCKED");
      expect(codes).not.toContain("S002");
      expect(codes).not.toContain("S003");
      // lockedSessionCodes should include S-LOCKED
      expect(member.lockedSessionCodes).toEqual(["S-LOCKED"]);

      return {
        combos: [
          {
            memberId: "m1",
            day: "2028-07-12",
            rank: "primary",
            score: 100,
            sessionCodes: ["S001"],
          },
        ],
        membersWithNoCombos: [],
        convergence: { iterations: 1, converged: true, violations: [] },
      };
    });

    mockComputeWindowRankings.mockReturnValue([]);

    // Transaction mock
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          // lock query: group phase re-check
          [{ phase: "schedule_review" }],
          // member count check
          [{ count: 1 }],
          // dateConfig query inside tx
          [
            {
              dateMode: "consecutive",
              consecutiveDays: 3,
              startDate: null,
              endDate: null,
            },
          ],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.success).toBe(true);
    expect(mockRunScheduleGeneration).toHaveBeenCalledTimes(1);
  });

  it("stores nonConvergenceMembers when algorithm does not converge", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["Swimming"],
      },
    ]);

    // 3. buddies
    directWhereResults.push([]);
    // 4. sessionPrefs
    directWhereResults.push([
      {
        memberId: "m1",
        sessionCode: "S001",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "09:00",
        endTime: "12:00",
        interest: "high",
      },
    ]);
    // 5. travel
    directFromResults.push([]);
    // 6. soldOut
    directWhereResults.push([]);
    // 7. oob
    directWhereResults.push([]);
    // 8. purchaseAssignees
    directWhereResults.push([]);

    // Algorithm returns non-converged result with violations
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 100,
          sessionCodes: ["S001"],
        },
      ],
      membersWithNoCombos: [],
      convergence: {
        iterations: 5,
        converged: false,
        violations: [
          {
            memberId: "m1",
            sessionCode: "S001",
            day: "2028-07-12",
            type: "hardBuddies",
            detail: "test",
          },
        ],
      },
    });

    mockComputeWindowRankings.mockReturnValue([]);

    // Track group update values
    const setCalls: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          // lock query: group phase re-check
          [{ phase: "schedule_review" }],
          // member count check
          [{ count: 1 }],
          // dateConfig query inside tx
          [
            {
              dateMode: "consecutive",
              consecutiveDays: 3,
              startDate: null,
              endDate: null,
            },
          ],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.success).toBe(true);
    // Group update should include nonConvergenceMembers with the affected member
    const groupUpdate = setCalls.find(
      (call) => "nonConvergenceMembers" in call
    );
    expect(groupUpdate).toBeDefined();
    expect(groupUpdate!.nonConvergenceMembers).toEqual(["m1"]);
  });

  it("saves results when timeout occurs during convergence refinement (all members have combos)", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["Swimming"],
      },
    ]);

    // 3. buddies
    directWhereResults.push([]);
    // 4. sessionPrefs
    directWhereResults.push([
      {
        memberId: "m1",
        sessionCode: "S001",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "09:00",
        endTime: "12:00",
        interest: "high",
      },
    ]);
    // 5. travel
    directFromResults.push([]);
    // 6. soldOut
    directWhereResults.push([]);
    // 7. oob
    directWhereResults.push([]);
    // 8. purchaseAssignees
    directWhereResults.push([]);

    // Algorithm timed out during convergence refinement but all members have combos
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 100,
          sessionCodes: ["S001"],
        },
      ],
      membersWithNoCombos: [],
      convergence: {
        iterations: 2,
        converged: false,
        timedOut: true,
        violations: [
          {
            memberId: "m1",
            sessionCode: "S001",
            day: "2028-07-12",
            type: "hardBuddies",
            detail: "test",
          },
        ],
      },
    });

    mockComputeWindowRankings.mockReturnValue([]);

    // Track group update values
    const setCalls: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          [{ phase: "schedule_review" }],
          [{ count: 1 }],
          [
            {
              dateMode: "consecutive",
              consecutiveDays: 3,
              startDate: null,
              endDate: null,
            },
          ],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
              setCalls.push(vals);
              return { where: vi.fn(() => Promise.resolve()) };
            }),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    // Should succeed — not return a timeout error
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Should store nonConvergenceMembers (treated as non-convergence)
    const groupUpdate = setCalls.find(
      (call) => "nonConvergenceMembers" in call
    );
    expect(groupUpdate).toBeDefined();
    expect(groupUpdate!.nonConvergenceMembers).toEqual(["m1"]);
    // Phase should be schedule_review since all members have combos
    expect(groupUpdate!.phase).toBe("schedule_review");
  });

  it("returns error when timeout occurs and some members have no combos", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      { id: "m1", status: "preferences_set", minBuddies: 0, sportRankings: [] },
      { id: "m2", status: "preferences_set", minBuddies: 0, sportRankings: [] },
    ]);

    // 3. buddies
    directWhereResults.push([]);
    // 4. sessionPrefs
    directWhereResults.push([]);
    // 5. travel
    directFromResults.push([]);
    // 6. soldOut
    directWhereResults.push([]);
    // 7. oob
    directWhereResults.push([]);
    // 8. purchaseAssignees
    directWhereResults.push([]);

    // Algorithm timed out during first pass — m2 was never processed
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 50,
          sessionCodes: [],
        },
      ],
      membersWithNoCombos: ["m2"],
      convergence: {
        iterations: 1,
        converged: false,
        timedOut: true,
        violations: [],
      },
    });

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "Schedule generation timed out. Try reducing the number of session preferences or buddy constraints and try again."
    );
    // Should NOT write to database
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("computes window rankings with backup1 and backup2 combo scores", async () => {
    mockOwner();
    // 1. Group data
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);

    // 2. activeMembers
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: ["Swimming"],
      },
    ]);

    // 3. buddies
    directWhereResults.push([]);
    // 4. sessionPrefs
    directWhereResults.push([
      {
        memberId: "m1",
        sessionCode: "S001",
        sport: "Swimming",
        zone: "Z1",
        sessionDate: "2028-07-12",
        startTime: "09:00",
        endTime: "12:00",
        interest: "high",
      },
    ]);
    // 5. travel
    directFromResults.push([]);
    // 6. soldOut
    directWhereResults.push([]);
    // 7. oob
    directWhereResults.push([]);
    // 8. purchaseAssignees
    directWhereResults.push([]);

    // Algorithm returns combos with backup1 and backup2 ranks
    mockRunScheduleGeneration.mockReturnValue({
      combos: [
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "primary",
          score: 100,
          sessionCodes: ["S001"],
        },
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "backup1",
          score: 80,
          sessionCodes: ["S001"],
        },
        {
          memberId: "m1",
          day: "2028-07-12",
          rank: "backup2",
          score: 60,
          sessionCodes: ["S001"],
        },
      ],
      membersWithNoCombos: [],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    // Window rankings mock
    mockComputeWindowRankings.mockReturnValue([
      { startDate: "2028-07-12", endDate: "2028-07-14", score: 240 },
    ]);

    // Transaction mock
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          // lock query: group phase re-check
          [{ phase: "schedule_review" }],
          // member count check
          [{ count: 1 }],
          // dateConfig query inside tx
          [
            {
              dateMode: "consecutive",
              consecutiveDays: 3,
              startDate: null,
              endDate: null,
            },
          ],
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
              then(r: (v: unknown) => void) {
                r(txQueryQueue[qIdx++] ?? []);
              },
            })),
          })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "combo-1" }]),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.success).toBe(true);
    expect(mockComputeWindowRankings).toHaveBeenCalledTimes(1);
    // Verify that memberScores were built with backup scores
    const call = mockComputeWindowRankings.mock.calls[0][0];
    const scores = call.memberScores[0];
    expect(scores.dailyScores.get("2028-07-12")).toBe(100);
    expect(scores.dailyBackupScores.get("2028-07-12")).toEqual({
      b1: 80,
      b2: 60,
    });
  });

  it("returns error when group phase changed during generation", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: [],
      },
    ]);
    directWhereResults.push([]); // buddies
    directWhereResults.push([]); // sessionPrefs
    directFromResults.push([]); // travel
    directWhereResults.push([]); // soldOut
    directWhereResults.push([]); // oob
    directWhereResults.push([]); // purchaseAssignees

    mockRunScheduleGeneration.mockReturnValue({
      combos: [],
      membersWithNoCombos: [],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  for: vi.fn(() => [{ phase: "purchasing" }]),
                })),
              })),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.error).toBe("Group state changed during generation");
  });

  it("returns error when membership changed during generation", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { phase: "preferences", affectedBuddyMembers: {} },
    ]);
    directWhereResults.push([
      {
        id: "m1",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: [],
      },
      {
        id: "m2",
        status: "preferences_set",
        minBuddies: 0,
        sportRankings: [],
      },
    ]);
    directWhereResults.push([]); // buddies
    directWhereResults.push([]); // sessionPrefs
    directFromResults.push([]); // travel
    directWhereResults.push([]); // soldOut
    directWhereResults.push([]); // oob
    directWhereResults.push([]); // purchaseAssignees

    mockRunScheduleGeneration.mockReturnValue({
      combos: [],
      membersWithNoCombos: [],
      convergence: { iterations: 1, converged: true, violations: [] },
    });

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => {
        const txQueryQueue: unknown[][] = [
          [{ phase: "preferences" }], // phase OK
          [{ count: 3 }], // member count changed (was 2)
        ];
        let qIdx = 0;
        const makeLimitResult = () => {
          const val = txQueryQueue[qIdx++] ?? [];
          return {
            for: vi.fn(() => val),
            then(r: (v: unknown) => void) {
              r(val);
            },
          };
        };
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(makeLimitResult),
                then(r: (v: unknown) => void) {
                  r(txQueryQueue[qIdx++] ?? []);
                },
              })),
            })),
          })),
        };
        return cb(tx);
      }
    );

    const result = await generateSchedules("group-1");

    expect(result.error).toBe(
      "Group membership changed during schedule generation. Please try again."
    );
  });
});

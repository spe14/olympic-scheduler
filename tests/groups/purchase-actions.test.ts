import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTimeslot,
  saveTimeslot,
  updateTimeslotStatus,
  savePurchasePlanEntry,
  removePurchasePlanEntry,
  markAsPurchased,
  deletePurchase,
  removePurchaseAssignee,
  updatePurchaseAssigneePrice,
  markAsSoldOut,
  unmarkSoldOut,
  markAsOutOfBudget,
  unmarkOutOfBudget,
  reportSessionPrice,
  deleteOffScheduleSessionData,
  getPurchaseDataForSessions,
} from "@/app/(main)/groups/[groupId]/schedule/purchase-actions";

// ── Mock next/cache ─────────────────────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Mock auth ───────────────────────────────────────────────────────────────
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

// ── Mock DB ─────────────────────────────────────────────────────────────────
// Chainable mock: select().from().where().limit() / innerJoin().where()
let queryResults: unknown[][] = [];

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

// Insert mock
const mockOnConflictDoUpdate = vi.fn(() => ({
  returning: vi.fn(() => Promise.resolve([{ id: "new-id" }])),
  then: (resolve: (v: unknown) => void) => resolve(undefined),
}));
const mockOnConflictDoNothing = vi.fn(() => Promise.resolve());
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
  onConflictDoNothing: mockOnConflictDoNothing,
  returning: vi.fn(() => Promise.resolve([{ id: "new-id" }])),
  then: (resolve: (v: unknown) => void) => resolve(undefined),
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

// Update mock
const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

// Delete mock
const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

// Transaction mock
let txQueryResults: unknown[][] = [];
const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
  const txInsertOnConflictDoNothing = vi.fn(() => Promise.resolve());
  const txInsertReturning = vi.fn(() =>
    Promise.resolve([{ id: "purchase-id" }])
  );
  const txInsertValues = vi.fn(() => ({
    onConflictDoUpdate: vi.fn(() => Promise.resolve()),
    onConflictDoNothing: txInsertOnConflictDoNothing,
    returning: txInsertReturning,
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  }));
  const txInsert = vi.fn(() => ({ values: txInsertValues }));

  const txUpdateWhere = vi.fn(() => Promise.resolve());
  const txUpdateSet = vi.fn(() => ({ where: txUpdateWhere }));
  const txUpdate = vi.fn(() => ({ set: txUpdateSet }));

  const txDeleteWhere = vi.fn(() => Promise.resolve());
  const txDelete = vi.fn(() => ({ where: txDeleteWhere }));

  const txSelectLimit = vi.fn(() => {
    const r = txQueryResults.shift() ?? [];
    return { then: (resolve: (v: unknown) => void) => resolve(r) };
  });
  const txSelectWhere = vi.fn(() => ({
    limit: txSelectLimit,
    then: (resolve: (v: unknown) => void) =>
      resolve(txQueryResults.shift() ?? []),
  }));
  const txSelectFrom = vi.fn(() => ({
    where: txSelectWhere,
  }));
  const txSelect = vi.fn(() => ({ from: txSelectFrom }));

  const tx = {
    insert: txInsert,
    update: txUpdate,
    delete: txDelete,
    select: txSelect,
  };
  return cb(tx);
});

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...(args as [never])),
  },
}));

// ── Mock schema ─────────────────────────────────────────────────────────────
vi.mock("@/lib/db/schema", () => ({
  purchaseTimeslot: {
    id: "id",
    groupId: "group_id",
    memberId: "member_id",
    timeslotStart: "timeslot_start",
    timeslotEnd: "timeslot_end",
    status: "status",
  },
  purchasePlanEntry: {
    groupId: "group_id",
    memberId: "member_id",
    sessionId: "session_id",
    assigneeMemberId: "assignee_member_id",
    priceCeiling: "price_ceiling",
  },
  ticketPurchase: {
    id: "id",
    groupId: "group_id",
    sessionId: "session_id",
    purchasedByMemberId: "purchased_by_member_id",
    pricePerTicket: "price_per_ticket",
    createdAt: "created_at",
  },
  ticketPurchaseAssignee: {
    ticketPurchaseId: "ticket_purchase_id",
    memberId: "member_id",
    pricePaid: "price_paid",
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
  },
  reportedPrice: {
    groupId: "group_id",
    sessionId: "session_id",
    reportedByMemberId: "reported_by_member_id",
    minPrice: "min_price",
    maxPrice: "max_price",
    comments: "comments",
    createdAt: "created_at",
  },
  member: { id: "id", userId: "user_id" },
  user: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    avatarColor: "avatar_color",
  },
  group: { id: "id", purchaseDataChangedAt: "purchase_data_changed_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  groupBy: vi.fn(
    <T, K extends string | number, V = T>(
      items: T[],
      keyFn: (item: T) => K,
      valueFn?: (item: T) => V
    ): Map<K, (T | V)[]> => {
      const map = new Map<K, (T | V)[]>();
      for (const item of items) {
        const key = keyFn(item);
        const list = map.get(key) ?? [];
        list.push(valueFn ? valueFn(item) : item);
        map.set(key, list);
      }
      return map;
    }
  ),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const membership = { id: "member-1", userId: "user-1", groupId: "group-1" };

// ── Tests ───────────────────────────────────────────────────────────────────

describe("getTimeslot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await getTimeslot("group-1");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns null data when no timeslot exists", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[]];
    const result = await getTimeslot("group-1");
    expect(result).toEqual({ data: null });
  });

  it("returns timeslot data when found", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const timeslot = {
      id: "ts-1",
      timeslotStart: new Date("2028-07-15T10:00:00Z"),
      timeslotEnd: new Date("2028-07-15T12:00:00Z"),
      status: "upcoming" as const,
    };
    queryResults = [[timeslot]];
    const result = await getTimeslot("group-1");
    expect(result.data).toBeDefined();
    expect(result.data!.id).toBe("ts-1");
    expect(result.data!.status).toBe("upcoming");
  });
});

describe("saveTimeslot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await saveTimeslot("group-1", {
      start: "2028-07-15T10:00:00Z",
      end: "2028-07-15T12:00:00Z",
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error for invalid date format", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await saveTimeslot("group-1", {
      start: "not-a-date",
      end: "2028-07-15T12:00:00Z",
    });
    expect(result).toEqual({ error: "Invalid date format." });
  });

  it("returns error when end is before start", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await saveTimeslot("group-1", {
      start: "2028-07-15T14:00:00Z",
      end: "2028-07-15T10:00:00Z",
    });
    expect(result).toEqual({ error: "End time must be after start time." });
  });

  it("returns error when end equals start", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await saveTimeslot("group-1", {
      start: "2028-07-15T10:00:00Z",
      end: "2028-07-15T10:00:00Z",
    });
    expect(result).toEqual({ error: "End time must be after start time." });
  });

  it("saves timeslot and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await saveTimeslot("group-1", {
      start: "2028-07-15T10:00:00Z",
      end: "2028-07-15T12:00:00Z",
    });
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("updateTimeslotStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await updateTimeslotStatus("group-1", "in_progress");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error when no timeslot found", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[]];
    const result = await updateTimeslotStatus("group-1", "in_progress");
    expect(result).toEqual({ error: "No timeslot found." });
  });

  it("updates status successfully", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[{ id: "ts-1" }]];
    const result = await updateTimeslotStatus("group-1", "completed");
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("savePurchasePlanEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await savePurchasePlanEntry("group-1", {
      sessionId: "SES-001",
      assigneeMemberId: "member-2",
      priceCeiling: 100,
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("saves plan entry and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await savePurchasePlanEntry("group-1", {
      sessionId: "SES-001",
      assigneeMemberId: "member-2",
      priceCeiling: 150,
    });
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("saves plan entry with null price ceiling", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await savePurchasePlanEntry("group-1", {
      sessionId: "SES-001",
      assigneeMemberId: "member-2",
      priceCeiling: null,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("removePurchasePlanEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await removePurchasePlanEntry("group-1", {
      sessionId: "SES-001",
      assigneeMemberId: "member-2",
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("deletes plan entry and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await removePurchasePlanEntry("group-1", {
      sessionId: "SES-001",
      assigneeMemberId: "member-2",
    });
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("markAsPurchased", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await markAsPurchased("group-1", {
      sessionId: "SES-001",
      assignees: [{ memberId: "member-2" }],
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error when no assignees provided", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await markAsPurchased("group-1", {
      sessionId: "SES-001",
      assignees: [],
    });
    expect(result).toEqual({
      error: "Must select at least one member to buy for.",
    });
  });

  it("creates purchase with transaction and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await markAsPurchased("group-1", {
      sessionId: "SES-001",
      pricePerTicket: 200,
      assignees: [
        { memberId: "member-2", pricePaid: 200 },
        { memberId: "member-3", pricePaid: null },
      ],
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("deletePurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await deletePurchase("group-1", "purchase-1");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error when purchase not found", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[]];
    const result = await deletePurchase("group-1", "purchase-1");
    expect(result).toEqual({
      error: "Purchase not found or not yours.",
    });
  });

  it("returns error when purchase belongs to another member", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[{ purchasedByMemberId: "member-other" }]];
    const result = await deletePurchase("group-1", "purchase-1");
    expect(result).toEqual({
      error: "Purchase not found or not yours.",
    });
  });

  it("deletes purchase and returns success when owned by caller", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[{ purchasedByMemberId: "member-1" }]];
    const result = await deletePurchase("group-1", "purchase-1");
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("removePurchaseAssignee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await removePurchaseAssignee("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("deletes assignee and keeps purchase when other assignees remain", async () => {
    mockGetMembership.mockResolvedValue(membership);
    // tx query 1: purchase exists
    // tx query 2: remaining assignees exist (non-empty)
    txQueryResults = [[{ id: "p-1" }], [{ memberId: "member-3" }]];
    const result = await removePurchaseAssignee("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("deletes purchase when no assignees remain after removal", async () => {
    mockGetMembership.mockResolvedValue(membership);
    // tx query 1: purchase exists
    // tx query 2: no remaining assignees
    txQueryResults = [[{ id: "p-1" }], []];
    const result = await removePurchaseAssignee("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("does nothing inside transaction when purchase not found in group", async () => {
    mockGetMembership.mockResolvedValue(membership);
    // tx query 1: purchase not found
    txQueryResults = [[]];
    const result = await removePurchaseAssignee("group-1", {
      purchaseId: "nonexistent",
      memberId: "member-2",
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("updatePurchaseAssigneePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await updatePurchaseAssigneePrice("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
      pricePaid: 50,
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error when purchase not found", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[]];
    const result = await updatePurchaseAssigneePrice("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
      pricePaid: 50,
    });
    expect(result).toEqual({ error: "Purchase not found." });
  });

  it("updates price and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[{ id: "p-1" }]];
    const result = await updatePurchaseAssigneePrice("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
      pricePaid: 75,
    });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("allows setting price to null", async () => {
    mockGetMembership.mockResolvedValue(membership);
    queryResults = [[{ id: "p-1" }]];
    const result = await updatePurchaseAssigneePrice("group-1", {
      purchaseId: "p-1",
      memberId: "member-2",
      pricePaid: null,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("markAsSoldOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await markAsSoldOut("group-1", { sessionId: "SES-001" });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("marks session as sold out and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await markAsSoldOut("group-1", { sessionId: "SES-001" });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("unmarkSoldOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await unmarkSoldOut("group-1", { sessionId: "SES-001" });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("unmarks sold out and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await unmarkSoldOut("group-1", { sessionId: "SES-001" });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("markAsOutOfBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await markAsOutOfBudget("group-1", {
      sessionId: "SES-001",
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("marks session as out of budget and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await markAsOutOfBudget("group-1", {
      sessionId: "SES-001",
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("unmarkOutOfBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    txQueryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await unmarkOutOfBudget("group-1", {
      sessionId: "SES-001",
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("unmarks out of budget and returns success", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await unmarkOutOfBudget("group-1", {
      sessionId: "SES-001",
    });
    expect(result).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("reportSessionPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: 100,
      maxPrice: 200,
      comments: null,
    });
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("returns error when no price or comment provided", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: null,
      maxPrice: null,
      comments: null,
    });
    expect(result).toEqual({
      error: "At least one price or a comment is required.",
    });
  });

  it("returns error when comments is only whitespace", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: null,
      maxPrice: null,
      comments: "   ",
    });
    expect(result).toEqual({
      error: "At least one price or a comment is required.",
    });
  });

  it("returns error when min price is zero or negative", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: 0,
      maxPrice: null,
      comments: null,
    });
    expect(result).toEqual({ error: "Min price must be positive." });
  });

  it("returns error when max price is zero or negative", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: null,
      maxPrice: -5,
      comments: null,
    });
    expect(result).toEqual({ error: "Max price must be positive." });
  });

  it("returns error when min price exceeds max price", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: 300,
      maxPrice: 100,
      comments: null,
    });
    expect(result).toEqual({
      error: "Min price cannot exceed max price.",
    });
  });

  it("reports price with min and max", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: 100,
      maxPrice: 200,
      comments: "Good seats",
    });
    expect(result).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("reports price with only a comment", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: null,
      maxPrice: null,
      comments: "Check back tomorrow",
    });
    expect(result).toEqual({ success: true });
  });

  it("allows equal min and max prices", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await reportSessionPrice("group-1", {
      sessionId: "SES-001",
      minPrice: 150,
      maxPrice: 150,
      comments: null,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("deleteOffScheduleSessionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns error when not a member", async () => {
    mockGetMembership.mockResolvedValue(null);
    const result = await deleteOffScheduleSessionData("group-1", "SES-001");
    expect(result).toEqual({
      error: "You are not an active member of this group.",
    });
  });

  it("deletes purchases and reported prices for session", async () => {
    mockGetMembership.mockResolvedValue(membership);
    const result = await deleteOffScheduleSessionData("group-1", "SES-001");
    expect(result).toEqual({ success: true });
    // Deletes run inside a transaction
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("getPurchaseDataForSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
  });

  it("returns empty collections for empty session codes", async () => {
    const result = await getPurchaseDataForSessions("group-1", "member-1", []);
    expect(result.planEntries.size).toBe(0);
    expect(result.purchases.size).toBe(0);
    expect(result.soldOutSessions.size).toBe(0);
    expect(result.outOfBudgetSessions.size).toBe(0);
    expect(result.reportedPrices.size).toBe(0);
    // No DB queries should have been made
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns structured purchase data for given sessions", async () => {
    // Query 1: planRows
    const planRows = [
      {
        sessionId: "SES-001",
        assigneeMemberId: "member-2",
        priceCeiling: 200,
        assigneeFirstName: "Bob",
        assigneeLastName: "Jones",
        assigneeAvatarColor: "green",
      },
    ];

    // Query 2: purchaseRows
    const purchaseRows = [
      {
        purchaseId: "p-1",
        sessionId: "SES-001",
        buyerMemberId: "member-1",
        pricePerTicket: 150,
        buyerFirstName: "Alice",
        buyerLastName: "Smith",
        createdAt: new Date("2028-07-15T10:00:00Z"),
      },
    ];

    // Query 3: assigneeRows (for purchase p-1)
    const assigneeRows = [
      {
        ticketPurchaseId: "p-1",
        memberId: "member-2",
        pricePaid: 150,
        firstName: "Bob",
        lastName: "Jones",
        avatarColor: "green",
      },
    ];

    // Query 4: soldOutRows
    const soldOutRows = [{ sessionId: "SES-002" }];

    // Query 5: oobRows
    const oobRows = [{ sessionId: "SES-003" }];

    // Query 6: priceRows
    const priceRows = [
      {
        sessionId: "SES-001",
        minPrice: 100,
        maxPrice: 200,
        comments: null,
        createdAt: new Date("2028-07-14T10:00:00Z"),
        reporterFirstName: "Carol",
        reporterLastName: "White",
      },
    ];

    queryResults = [
      planRows,
      purchaseRows,
      assigneeRows,
      soldOutRows,
      oobRows,
      priceRows,
    ];

    const result = await getPurchaseDataForSessions("group-1", "member-1", [
      "SES-001",
      "SES-002",
      "SES-003",
    ]);

    expect(result.planEntries.size).toBeGreaterThan(0);
    expect(result.purchases.size).toBeGreaterThan(0);
    expect(result.soldOutSessions.has("SES-002")).toBe(true);
    expect(result.outOfBudgetSessions.has("SES-003")).toBe(true);
    expect(result.reportedPrices.size).toBeGreaterThan(0);
  });
});

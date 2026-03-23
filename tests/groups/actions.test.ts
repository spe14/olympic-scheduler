import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGroup, joinGroup, removeMembership } from "@/app/(main)/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// Mock DB — chainable select with thenable support for COUNT queries
const mockReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockLimit = vi.fn();
// Queue for direct-await queries (e.g. COUNT(*) without .limit())
let directWhereResults: unknown[][] = [];
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  for: vi.fn(() => directWhereResults.shift() ?? []),
  then(resolve: (v: unknown) => void) {
    resolve(directWhereResults.shift() ?? []);
  },
}));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  };
  return cb(tx);
});

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...(args as [never])),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: { id: "id", inviteCode: "invite_code" },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    status: "status",
  },
}));

// Mock crypto
vi.mock("crypto", () => ({
  default: { randomBytes: () => ({ toString: () => "abc12345" }) },
}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const mockUser = { id: "user-1", authId: "auth-123" };

describe("createGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    directWhereResults = [];
    mockGetCurrentUser.mockResolvedValue(mockUser);
    // Default: user group count under limit
    directWhereResults.push([{ count: 0 }]);
    // Default: successful group creation
    mockReturning.mockResolvedValue([{ id: "group-1" }]);
    // Second insert (member) returns a chainable mock
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals) => {
        if (vals.role) {
          // member insert - no returning
          return Promise.resolve();
        }
        return { returning: mockReturning };
      }),
    }));
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const fd = makeFormData({ name: "My Group" });
    const result = await createGroup(null, fd);

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns error for empty group name", async () => {
    const fd = makeFormData({ name: "" });
    const result = await createGroup(null, fd);

    expect(result.error).toContain("required");
  });

  it("returns error for group name over 50 characters", async () => {
    const fd = makeFormData({ name: "a".repeat(51) });
    const result = await createGroup(null, fd);

    expect(result.error).toContain("less than 50");
  });

  it("creates group with no date mode", async () => {
    const fd = makeFormData({ name: "My Group" });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("sets joinedAt on owner member insert", async () => {
    let insertedValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        if (vals.role) {
          insertedValues = vals;
          return Promise.resolve();
        }
        return { returning: mockReturning };
      }),
    }));

    const fd = makeFormData({ name: "My Group" });
    const before = new Date();
    await createGroup(null, fd);
    const after = new Date();

    expect(insertedValues).not.toBeNull();
    expect(insertedValues!.joinedAt).toBeInstanceOf(Date);
    expect((insertedValues!.joinedAt as Date).getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
    expect((insertedValues!.joinedAt as Date).getTime()).toBeLessThanOrEqual(
      after.getTime()
    );
  });

  it("creates group with consecutive date mode", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "5",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for invalid consecutive days", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "0",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("creates group with specific date mode", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for invalid date range", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "specific",
      startDate: "2028-07-18",
      endDate: "2028-07-14",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("returns error when db insert fails", async () => {
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockRejectedValue(new Error("DB error")),
      })),
    }));

    const fd = makeFormData({ name: "My Group" });
    const result = await createGroup(null, fd);

    expect(result.error).toContain("Failed to create group");
  });

  it("returns error for consecutive days over 19", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "20",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("returns error for consecutive days as non-integer", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "2.5",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("accepts consecutive days at boundary 1", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "1",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("accepts consecutive days at boundary 19", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "19",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for specific dates before Olympic period", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "specific",
      startDate: "2028-07-11",
      endDate: "2028-07-14",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("returns error for specific dates after Olympic period", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-31",
    });
    const result = await createGroup(null, fd);

    expect(result.success).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).not.toBe("You must be logged in.");
  });

  it("creates group with no date constraints when dateMode is unrecognized", async () => {
    const fd = makeFormData({ name: "My Group", dateMode: "unknown" });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("accepts group name at exactly 50 characters", async () => {
    const fd = makeFormData({ name: "a".repeat(50) });
    const result = await createGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for whitespace-only group name", async () => {
    const fd = makeFormData({ name: "   " });
    const result = await createGroup(null, fd);

    expect(result.error).toContain("required");
  });

  it("returns error when user has too many groups", async () => {
    directWhereResults = [[{ count: 10 }]];
    const fd = makeFormData({ name: "My Group" });
    const result = await createGroup(null, fd);

    expect(result.error).toContain("at most 10 groups");
  });
});

describe("joinGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    directWhereResults = [];
    mockGetCurrentUser.mockResolvedValue(mockUser);
    // Default: user group count under limit, group found, no existing membership, group not full
    directWhereResults.push([{ count: 0 }]); // user group count — not at limit
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group lookup
    mockLimit.mockResolvedValueOnce([]); // existing member check
    directWhereResults.push([{ id: "group-1" }]); // FOR UPDATE lock on group
    directWhereResults.push([{ count: 5 }]); // COUNT query — not full
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns error for empty invite code", async () => {
    const fd = makeFormData({ inviteCode: "" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("required");
  });

  it("returns error when no group found", async () => {
    mockLimit.mockReset();
    mockLimit.mockResolvedValueOnce([]); // no group found

    const fd = makeFormData({ inviteCode: "badcode1" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("No group found");
  });

  it("returns error when already a member (joined status)", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1", status: "joined" }]); // already member

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("already a member");
    expect(result.code).toBe("already_member");
  });

  it("returns error when already pending approval", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", status: "pending_approval" },
    ]);

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("pending join request");
    expect(result.code).toBe("pending_approval");
  });

  it("joins group successfully with correct member values", async () => {
    let insertedValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        insertedValues = vals;
        return Promise.resolve();
      }),
    }));

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockInsert).toHaveBeenCalled();
    expect(insertedValues).toMatchObject({
      userId: "user-1",
      groupId: "group-1",
      role: "member",
      status: "pending_approval",
    });
  });

  it("returns error when group is full", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([]); // no existing member
    directWhereResults.push([{ id: "group-1" }]); // FOR UPDATE lock
    directWhereResults.push([{ count: 12 }]); // COUNT = 12, full

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("full");
    expect(result.error).toContain("12 members");
  });

  it("returns 'already a member' over 'full' when both apply", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1", status: "joined" }]); // already member
    // COUNT query never reached

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("already a member");
    expect(result.code).toBe("already_member");
  });

  it("re-joins after being denied when group is not full", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1", status: "denied" }]); // denied member
    directWhereResults.push([{ id: "group-1" }]); // FOR UPDATE lock
    directWhereResults.push([{ count: 5 }]); // COUNT — not full
    mockUpdateWhere.mockResolvedValue(undefined);

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // Should update existing row, NOT insert a new one
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "pending_approval" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns full error when denied member tries to re-join full group", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1", status: "denied" }]); // denied member
    directWhereResults.push([{ id: "group-1" }]); // FOR UPDATE lock
    directWhereResults.push([{ count: 12 }]); // COUNT = 12, full

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("full");
  });

  it("returns error when db insert fails", async () => {
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockRejectedValue(new Error("DB error")),
    }));

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("Failed to join group");
  });

  it("returns error when denied re-join update fails", async () => {
    mockLimit.mockReset();
    directWhereResults = [];
    directWhereResults.push([{ count: 0 }]); // user group count
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1", status: "denied" }]);
    directWhereResults.push([{ id: "group-1" }]); // FOR UPDATE lock
    directWhereResults.push([{ count: 5 }]); // not full
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("Failed to join group");
  });

  it("trims whitespace from invite code", async () => {
    const fd = makeFormData({ inviteCode: "  abc123  " });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("lowercases invite code for case-insensitive matching", async () => {
    const fd = makeFormData({ inviteCode: "ABC123" });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for invite code over 50 characters", async () => {
    const fd = makeFormData({ inviteCode: "a".repeat(51) });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("less than 50");
  });

  it("returns error when user has too many groups", async () => {
    directWhereResults = [[{ count: 10 }]];
    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("at most 10 groups");
  });
});

describe("removeMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockDeleteWhere.mockReset();
    directWhereResults = [];
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await removeMembership("member-1");

    expect(result.error).toBe("You must be logged in.");
  });

  it("returns error when membership not found", async () => {
    mockLimit.mockResolvedValueOnce([]); // no membership

    const result = await removeMembership("member-1");

    expect(result.error).toBe("Membership not found.");
  });

  it("returns error when membership belongs to another user", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "other-user", status: "pending_approval" },
    ]);

    const result = await removeMembership("member-1");

    expect(result.error).toBe("Membership not found.");
  });

  it("removes pending_approval membership", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "user-1", status: "pending_approval" },
    ]);

    const result = await removeMembership("member-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("removes denied membership", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "user-1", status: "denied" },
    ]);

    const result = await removeMembership("member-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects removal of joined membership", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "user-1", status: "joined" },
    ]);

    const result = await removeMembership("member-1");

    expect(result.error).toBe("You must leave the group from the group page.");
  });

  it("rejects removal of preferences_set membership", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "user-1", status: "preferences_set" },
    ]);

    const result = await removeMembership("member-1");

    expect(result.error).toBe("You must leave the group from the group page.");
  });

  it("returns error when db delete fails", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "member-1", userId: "user-1", status: "pending_approval" },
    ]);
    mockDeleteWhere.mockRejectedValue(new Error("DB error"));

    const result = await removeMembership("member-1");

    expect(result.error).toContain("Failed to remove membership");
  });
});

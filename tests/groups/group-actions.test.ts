import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateGroupName,
  updateDateConfig,
  approveMember,
  denyMember,
  leaveGroup,
  removeMember,
  transferOwnership,
} from "@/app/(main)/groups/[groupId]/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
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
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockUpdateWhere = vi.fn(() => Promise.resolve());
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<void>) => {
  // Build a mock tx that mirrors the db shape
  const txSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
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
  group: { id: "id", name: "name", phase: "phase" },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
    preferenceStep: "preference_step",
  },
  buddyConstraint: { memberId: "member_id", buddyMemberId: "buddy_id" },
  sessionPreference: {
    memberId: "member_id",
    hardBuddyOverride: "hard_buddy_override",
    minBuddyOverride: "min_buddy_override",
    excluded: "excluded",
  },
  combo: { id: "id", groupId: "group_id" },
  comboSession: { comboId: "combo_id" },
  viableConfig: { id: "id", groupId: "group_id" },
  viableConfigMember: { viableConfigId: "viable_config_id" },
  conflict: { groupId: "group_id" },
  windowRanking: { groupId: "group_id" },
}));

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
  mockLimit.mockResolvedValueOnce([{ id: "owner-member-1", role: "owner" }]);
}

// Helper: set up getOwnerMembership to fail (not owner)
function mockNonOwner() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockLimit.mockResolvedValueOnce([{ id: "member-1", role: "member" }]);
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
    mockGetCurrentUser.mockResolvedValue(null);
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
    ]); // target
    directWhereResults.push([{ count: 5 }]); // not full

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "joined", joinedAt: expect.any(Date) })
    );
  });

  it("sets joinedAt to current time on approval", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    directWhereResults.push([{ count: 5 }]);

    const before = new Date();
    await approveMember("group-1", "member-2");
    const after = new Date();

    const calledWith = mockSet.mock.calls[0][0] as { joinedAt: Date };
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
    directWhereResults.push([{ count: 12 }]); // full

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("full");
    expect(result.error).toContain("12 members");
  });

  it("returns error when group is at capacity boundary", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    directWhereResults.push([{ count: 13 }]); // over capacity

    const result = await approveMember("group-1", "member-2");

    expect(result.error).toContain("full");
  });

  it("approves when group has 11 active members", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    directWhereResults.push([{ count: 11 }]); // one slot left

    const result = await approveMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error when db update fails", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      { id: "member-2", status: "pending_approval" },
    ]);
    directWhereResults.push([{ count: 5 }]);
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));

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
  mockLimit.mockResolvedValueOnce([
    { id: "member-1", role: "member", status: "joined" },
  ]);
}

// Helper: set up getMembership to return the owner
function mockActiveOwner() {
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockLimit.mockResolvedValueOnce([
    { id: "owner-member-1", role: "owner", status: "joined" },
  ]);
}

describe("leaveGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    mockTransaction.mockClear();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
    // Reset transaction to default (succeeds)
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => {
      const txSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
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
      };
      return cb(tx);
    });
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await leaveGroup("group-1");

    expect(result.error).toBe("You are not an active member of this group.");
  });

  it("returns error when user has no active membership", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockLimit.mockResolvedValueOnce([]); // no membership found

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

  it("returns error when transaction fails", async () => {
    mockActiveMember();
    mockLimit.mockResolvedValueOnce([{ phase: "preferences" }]);
    mockTransaction.mockRejectedValue(new Error("TX error"));

    const result = await leaveGroup("group-1");

    expect(result.error).toBe("Failed to leave group. Please try again.");
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
    // Reset transaction to default (succeeds)
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => {
      const txSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
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
      };
      return cb(tx);
    });
  });

  it("returns error when caller is not the owner", async () => {
    mockNonOwner();

    const result = await removeMember("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can remove members.");
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

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

  it("succeeds for target in conflict_resolution phase", async () => {
    mockOwner();
    mockLimit.mockResolvedValueOnce([
      {
        id: "member-2",
        role: "member",
        status: "conflict_resolution_pending",
        groupId: "group-1",
      },
    ]);
    mockLimit.mockResolvedValueOnce([{ phase: "conflict_resolution" }]);

    const result = await removeMember("group-1", "member-2");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
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
    mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => {
      const txUpdateWhere = vi.fn(() => Promise.resolve());
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: txUpdateWhere })),
        })),
      };
      return cb(tx);
    });
  });

  it("returns error when caller is not the owner", async () => {
    mockNonOwner();

    const result = await transferOwnership("group-1", "member-2");

    expect(result.error).toBe("Only the group owner can transfer ownership.");
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

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
});

describe("updateDateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockReset();
    mockUpdateWhere.mockReset();
    directWhereResults = [];
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns error when not logged in", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
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
    expect(mockSet).toHaveBeenCalledWith({
      dateMode: "consecutive",
      consecutiveDays: 5,
      startDate: null,
      endDate: null,
    });
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
    expect(mockSet).toHaveBeenCalledWith({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
      consecutiveDays: null,
    });
  });

  it("clears specific date fields when switching to consecutive", async () => {
    mockOwner();
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "3" });
    await updateDateConfig("group-1", fd);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: null, endDate: null })
    );
  });

  it("clears consecutive days when switching to specific", async () => {
    mockOwner();
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-12",
      endDate: "2028-07-20",
    });
    await updateDateConfig("group-1", fd);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveDays: null })
    );
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
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));
    const fd = makeFormData({ dateMode: "consecutive", consecutiveDays: "5" });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("Failed to update date configuration");
  });

  it("returns error when db update fails for specific mode", async () => {
    mockOwner();
    mockUpdateWhere.mockRejectedValue(new Error("DB error"));
    const fd = makeFormData({
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-18",
    });
    const result = await updateDateConfig("group-1", fd);

    expect(result.error).toContain("Failed to update date configuration");
  });
});

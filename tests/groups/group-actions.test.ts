import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateGroupName,
  approveMember,
  denyMember,
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

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: { id: "id", name: "name" },
  member: {
    id: "id",
    userId: "user_id",
    groupId: "group_id",
    role: "role",
    status: "status",
  },
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
    expect(mockSet).toHaveBeenCalledWith({ status: "joined" });
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGroup, joinGroup } from "@/app/(main)/actions";

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
const mockReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: { id: "id", inviteCode: "invite_code" },
  member: { id: "id", userId: "user_id", groupId: "group_id" },
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
    mockGetCurrentUser.mockResolvedValue(mockUser);
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

    expect(result.error).toBeDefined();
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

    expect(result.error).toBeDefined();
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

    expect(result.error).toBeDefined();
  });

  it("returns error for consecutive days as non-integer", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "consecutive",
      consecutiveDays: "2.5",
    });
    const result = await createGroup(null, fd);

    expect(result.error).toBeDefined();
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

    expect(result.error).toBeDefined();
  });

  it("returns error for specific dates after Olympic period", async () => {
    const fd = makeFormData({
      name: "My Group",
      dateMode: "specific",
      startDate: "2028-07-14",
      endDate: "2028-07-31",
    });
    const result = await createGroup(null, fd);

    expect(result.error).toBeDefined();
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
});

describe("joinGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    // Default: group found, no existing membership
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group lookup
    mockLimit.mockResolvedValueOnce([]); // existing member check
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

  it("returns error when already a member", async () => {
    mockLimit.mockReset();
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]); // group found
    mockLimit.mockResolvedValueOnce([{ id: "member-1" }]); // already member

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("already a member");
    expect(result.code).toBe("already_member");
  });

  it("joins group successfully", async () => {
    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error when db insert fails", async () => {
    mockInsert.mockImplementation(() => ({
      values: vi.fn().mockRejectedValue(new Error("DB error")),
    }));

    const fd = makeFormData({ inviteCode: "abc123" });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("Failed to join group");
  });

  it("trims whitespace from invite code", async () => {
    const fd = makeFormData({ inviteCode: "  abc123  " });
    const result = await joinGroup(null, fd);

    expect(result.success).toBe(true);
  });

  it("returns error for invite code over 50 characters", async () => {
    const fd = makeFormData({ inviteCode: "a".repeat(51) });
    const result = await joinGroup(null, fd);

    expect(result.error).toContain("less than 50");
  });
});

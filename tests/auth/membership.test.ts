import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMembership,
  getOwnerMembership,
  requireMembership,
  requireOwnerMembership,
} from "@/lib/auth";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: { authId: "auth_id" },
  member: {
    id: "id",
    role: "role",
    status: "status",
    preferenceStep: "preference_step",
    groupId: "group_id",
    userId: "user_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  notInArray: vi.fn((a, b) => ({ type: "notInArray", a, b })),
}));

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "auth-123" } },
    error: null,
  });
  // First db call (getCurrentUser) returns user
  mockLimit.mockResolvedValueOnce([{ id: "user-1", authId: "auth-123" }]);
}

describe("getMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await getMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns null when no app user found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    });
    mockLimit.mockResolvedValueOnce([]); // no app user

    const result = await getMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns membership when user is a member of the group", async () => {
    mockAuthenticatedUser();
    const membership = {
      id: "member-1",
      role: "member",
      status: "joined",
      preferenceStep: null,
    };
    // Second db call (getMembership) returns membership
    mockLimit.mockResolvedValueOnce([membership]);

    const result = await getMembership("group-1");
    expect(result).toEqual(membership);
  });

  it("returns null when user is not a member of the group", async () => {
    mockAuthenticatedUser();
    // Second db call returns empty array
    mockLimit.mockResolvedValueOnce([]);

    const result = await getMembership("group-1");
    expect(result).toBeNull();
  });
});

describe("getOwnerMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getOwnerMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns null when no app user found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    });
    mockLimit.mockResolvedValueOnce([]);

    const result = await getOwnerMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns null when user is not a member", async () => {
    mockAuthenticatedUser();
    // No membership found
    mockLimit.mockResolvedValueOnce([]);

    const result = await getOwnerMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns null when user is a member but not owner", async () => {
    mockAuthenticatedUser();
    mockLimit.mockResolvedValueOnce([{ id: "member-1", role: "member" }]);

    const result = await getOwnerMembership("group-1");
    expect(result).toBeNull();
  });

  it("returns membership when user is the owner", async () => {
    mockAuthenticatedUser();
    const ownership = { id: "member-1", role: "owner" };
    mockLimit.mockResolvedValueOnce([ownership]);

    const result = await getOwnerMembership("group-1");
    expect(result).toEqual(ownership);
  });
});

describe("requireMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns membership and null error when user is a member", async () => {
    mockAuthenticatedUser();
    const membership = {
      id: "member-1",
      role: "member",
      status: "joined",
      preferenceStep: null,
    };
    mockLimit.mockResolvedValueOnce([membership]);

    const result = await requireMembership("group-1");
    expect(result.membership).toEqual(membership);
    expect(result.error).toBeNull();
  });

  it("returns error when user is not a member", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await requireMembership("group-1");
    expect(result.error).toEqual({
      error: "You are not an active member of this group.",
    });
  });
});

describe("requireOwnerMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns membership and null error when user is the owner", async () => {
    mockAuthenticatedUser();
    const ownership = { id: "member-1", role: "owner" };
    mockLimit.mockResolvedValueOnce([ownership]);

    const result = await requireOwnerMembership("group-1", "do something");
    expect(result.membership).toEqual(ownership);
    expect(result.error).toBeNull();
  });

  it("returns error with action name when user is not the owner", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await requireOwnerMembership("group-1", "manage settings");
    expect(result.error).toEqual({
      error: "Only the group owner can manage settings.",
    });
  });

  it("returns error when user is a member but not owner", async () => {
    mockAuthenticatedUser();
    mockLimit.mockResolvedValueOnce([{ id: "member-1", role: "member" }]);

    const result = await requireOwnerMembership("group-1", "delete group");
    expect(result.error).toEqual({
      error: "Only the group owner can delete group.",
    });
  });
});

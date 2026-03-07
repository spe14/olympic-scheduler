import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/groups/route";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockOrderBy = vi.fn();
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  group: {
    id: "id",
    name: "name",
    phase: "phase",
    inviteCode: "invite_code",
    createdAt: "created_at",
  },
  member: {
    role: "role",
    status: "status",
    groupId: "group_id",
    userId: "user_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

describe("GET /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns groups for authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const groups = [
      { id: "g1", name: "Group 1", phase: "preferences", memberCount: 3 },
    ];
    mockOrderBy.mockResolvedValue(groups);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(groups);
  });

  it("returns empty array when user has no groups", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockOrderBy.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

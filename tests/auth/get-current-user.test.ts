import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";

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
    select: () => mockSelect(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: { authId: "auth_id" },
}));

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when supabase returns error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("returns null when supabase returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("returns null when no app user found in db", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    });
    mockLimit.mockResolvedValue([]);

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("returns app user when found", async () => {
    const appUser = { id: "user-1", authId: "auth-123", username: "janedoe" };
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    });
    mockLimit.mockResolvedValue([appUser]);

    const result = await getCurrentUser();
    expect(result).toEqual(appUser);
  });

  it("does not query db when auth fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "err" },
    });

    await getCurrentUser();
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

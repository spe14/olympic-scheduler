import { describe, it, expect, vi, beforeEach } from "vitest";
import { logout } from "@/app/(auth)/actions";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock Supabase client
const mockSignOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { signOut: mockSignOut },
  })),
}));

// Mock next/headers
const mockDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ delete: mockDelete })),
}));

// Mock DB (needed because actions.ts imports it at module level)
vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/db/schema", () => ({
  user: {},
}));

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("calls supabase signOut and redirects to login", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("deletes session cookies", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockDelete).toHaveBeenCalledWith("session_start_at");
    expect(mockDelete).toHaveBeenCalledWith("last_active_at");
  });

  it("redirects to /login", async () => {
    const { redirect } = await import("next/navigation");
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/auth/callback/route";
import { NextRequest } from "next/server";

const mockExchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to next URL on successful code exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      makeRequest("/api/auth/callback?code=abc123&next=/reset-password")
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/reset-password"
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it("redirects to / when next is not provided", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(makeRequest("/api/auth/callback?code=abc123"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });

  it("redirects to login when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "Invalid code" },
    });

    const response = await GET(makeRequest("/api/auth/callback?code=badcode"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects to login when no code is provided", async () => {
    const response = await GET(makeRequest("/api/auth/callback"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});

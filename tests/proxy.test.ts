import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_SESSION_DURATION, INACTIVITY_TIMEOUT } from "@/lib/constants";

// Mock @supabase/ssr
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }),
}));

// Mock NextResponse
const responseCookiesMap = new Map<
  string,
  { value: string; options?: object }
>();
const deletedCookies = new Set<string>();
const mockResponseCookies = {
  set: vi.fn((name: string, value: string, options?: object) => {
    responseCookiesMap.set(name, { value, options });
  }),
  delete: vi.fn((name: string) => {
    deletedCookies.add(name);
  }),
};
const mockNextResponse = {
  cookies: mockResponseCookies,
};
const mockRedirectResponse = {
  cookies: {
    set: vi.fn(),
    delete: vi.fn((name: string) => {
      deletedCookies.add(name);
    }),
  },
};

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => mockNextResponse),
    redirect: vi.fn(() => mockRedirectResponse),
  },
}));

// Build a mock NextRequest
function makeRequest(cookies: Record<string, string> = {}) {
  const cookieStore = new Map(Object.entries(cookies));
  return {
    cookies: {
      getAll: () =>
        Array.from(cookieStore.entries()).map(([name, value]) => ({
          name,
          value,
        })),
      get: (name: string) => {
        const val = cookieStore.get(name);
        return val !== undefined ? { value: val } : undefined;
      },
      has: (name: string) => cookieStore.has(name),
      set: vi.fn((name: string, value: string) => {
        cookieStore.set(name, value);
      }),
    },
    nextUrl: { clone: () => ({ pathname: "/" }) },
  };
}

// Import after mocks
import { updateSession } from "@/lib/supabase/proxy";

describe("updateSession (proxy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseCookiesMap.clear();
    deletedCookies.clear();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("passes through when no user is logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = makeRequest();
    const result = await updateSession(request as any);

    expect(result).toBe(mockNextResponse);
    // No session cookies should be set
    expect(responseCookiesMap.has("session_start_at")).toBe(false);
    expect(responseCookiesMap.has("last_active_at")).toBe(false);
  });

  it("sets session cookies on fresh login (no tracking cookies)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = makeRequest(); // no cookies
    await updateSession(request as any);

    // Should set session_start_at and last_active_at
    expect(responseCookiesMap.has("session_start_at")).toBe(true);
    expect(responseCookiesMap.has("last_active_at")).toBe(true);
  });

  it("updates last_active_at on active session", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    const request = makeRequest({
      session_start_at: String(now - 60), // started 1 min ago
      last_active_at: String(now - 10), // active 10s ago
    });

    await updateSession(request as any);

    // Should update last_active_at with a recent timestamp
    const activeCookie = responseCookiesMap.get("last_active_at");
    expect(activeCookie).toBeDefined();
    const cookieTime = Number(activeCookie!.value);
    expect(cookieTime).toBeGreaterThanOrEqual(now);
    expect(cookieTime).toBeLessThanOrEqual(now + 2);
    // Should NOT redirect
    expect(
      vi.mocked((await import("next/server")).NextResponse.redirect)
    ).not.toHaveBeenCalled();
    // Should NOT re-set session_start_at (already exists)
    expect(responseCookiesMap.has("session_start_at")).toBe(false);
  });

  it("redirects to /login when session exceeds MAX_SESSION_DURATION", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    const request = makeRequest({
      session_start_at: String(now - MAX_SESSION_DURATION - 1),
      last_active_at: String(now - 5),
    });

    const result = await updateSession(request as any);

    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toBe(mockRedirectResponse);
    expect(deletedCookies.has("session_start_at")).toBe(true);
    expect(deletedCookies.has("last_active_at")).toBe(true);
  });

  it("redirects to /login when inactivity timeout exceeded", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    const request = makeRequest({
      session_start_at: String(now - 3600), // started 1h ago
      last_active_at: String(now - INACTIVITY_TIMEOUT - 1), // stale
    });

    const result = await updateSession(request as any);

    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toBe(mockRedirectResponse);
  });

  it("redirects when last_active cookie has expired (missing)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    // session_start exists but last_active is gone (browser maxAge expired it)
    const request = makeRequest({
      session_start_at: String(now - 3600),
    });

    const result = await updateSession(request as any);

    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toBe(mockRedirectResponse);
  });

  it("does NOT redirect on fresh login even without tracking cookies", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // Neither cookie exists — fresh login, should NOT redirect
    const request = makeRequest();
    const result = await updateSession(request as any);

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);
  });

  it("sets session_start_at with maxAge of MAX_SESSION_DURATION", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = makeRequest();
    await updateSession(request as any);

    const sessionCookie = responseCookiesMap.get("session_start_at");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.options).toMatchObject({
      maxAge: MAX_SESSION_DURATION,
      httpOnly: true,
      sameSite: "lax",
    });
  });

  it("sets last_active_at with maxAge of INACTIVITY_TIMEOUT", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = makeRequest();
    await updateSession(request as any);

    const activeCookie = responseCookiesMap.get("last_active_at");
    expect(activeCookie).toBeDefined();
    expect(activeCookie!.options).toMatchObject({
      maxAge: INACTIVITY_TIMEOUT,
      httpOnly: true,
      sameSite: "lax",
    });
  });

  it("does not re-set session_start_at on subsequent requests", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    const request = makeRequest({
      session_start_at: String(now - 300),
      last_active_at: String(now - 10),
    });

    await updateSession(request as any);

    // session_start_at should NOT be re-set (already exists)
    expect(responseCookiesMap.has("session_start_at")).toBe(false);
    // last_active_at should be updated with correct options
    const activeCookie = responseCookiesMap.get("last_active_at");
    expect(activeCookie).toBeDefined();
    expect(activeCookie!.options).toMatchObject({
      maxAge: INACTIVITY_TIMEOUT,
      httpOnly: true,
      sameSite: "lax",
    });
  });

  it("session at exactly MAX_SESSION_DURATION does not redirect", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const now = Math.floor(Date.now() / 1000);
    const request = makeRequest({
      session_start_at: String(now - MAX_SESSION_DURATION), // exactly at boundary
      last_active_at: String(now - 5),
    });

    await updateSession(request as any);

    // > MAX_SESSION_DURATION triggers redirect, = does not
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

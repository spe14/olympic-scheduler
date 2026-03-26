import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MAX_SESSION_DURATION, INACTIVITY_TIMEOUT } from "@/lib/constants";

const LAST_ACTIVE_COOKIE = "last_active_at";
const SESSION_START_COOKIE = "session_start_at";

export async function updateSession(request: NextRequest) {
  // Start with a default "pass-through" response
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create a Supabase client that reads/writes cookies
  // from the request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First, update the request cookies (for Server Components
          // downstream in this same request)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Then create a new response with the updated request
          supabaseResponse = NextResponse.next({
            request,
          });
          // Finally, set the cookies on the response
          // (so the browser gets the refreshed token)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add any code between createServerClient
  // and supabase.auth.getUser().

  // This call refreshes the session if the token is expired
  // and triggers setAll with the new token cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const allCookies = request.cookies.getAll();
    const staleAuthCookies = allCookies.filter((c) => c.name.startsWith("sb-"));

    if (staleAuthCookies.length > 0) {
      for (const cookie of staleAuthCookies) {
        supabaseResponse.cookies.delete(cookie.name);
      }
      supabaseResponse.cookies.delete(SESSION_START_COOKIE);
      supabaseResponse.cookies.delete(LAST_ACTIVE_COOKIE);
    }

    return supabaseResponse;
  }

  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const sessionStart = Number(
      request.cookies.get(SESSION_START_COOKIE)?.value
    );
    const lastActive = Number(request.cookies.get(LAST_ACTIVE_COOKIE)?.value);

    const hasSessionStartCookie = request.cookies.has(SESSION_START_COOKIE);
    const hasLastActiveCookie = request.cookies.has(LAST_ACTIVE_COOKIE);

    const sessionExpired =
      hasSessionStartCookie && now - sessionStart > MAX_SESSION_DURATION;

    // Only check inactivity if the session has been initialized (has a
    // session_start cookie). On a fresh login, neither cookie exists yet —
    // they get set below. Once initialized, the user is only considered
    // active if the last_active cookie exists AND is within the timeout.
    // All other cases (cookie expired via maxAge, cookie stale, etc.) are
    // treated as inactivity timeout.
    const inactivityExpired = hasSessionStartCookie
      ? !(hasLastActiveCookie && now - lastActive <= INACTIVITY_TIMEOUT)
      : false;

    if (sessionExpired || inactivityExpired) {
      await supabase.auth.signOut();

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      const response = NextResponse.redirect(redirectUrl);

      for (const cookie of supabaseResponse.cookies.getAll()) {
        response.cookies.set(cookie);
      }

      // Clear session tracking cookies
      response.cookies.delete(SESSION_START_COOKIE);
      response.cookies.delete(LAST_ACTIVE_COOKIE);

      return response;
    }

    // Set session start cookie if not present (new login)
    if (!sessionStart) {
      supabaseResponse.cookies.set(SESSION_START_COOKIE, String(now), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: MAX_SESSION_DURATION,
      });
    }

    // Update last active timestamp on every request
    supabaseResponse.cookies.set(LAST_ACTIVE_COOKIE, String(now), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: INACTIVITY_TIMEOUT,
    });
  }

  return supabaseResponse;
}

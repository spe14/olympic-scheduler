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

  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const sessionStart = Number(
      request.cookies.get(SESSION_START_COOKIE)?.value
    );
    const lastActive = Number(request.cookies.get(LAST_ACTIVE_COOKIE)?.value);

    const sessionExpired =
      sessionStart && now - sessionStart > MAX_SESSION_DURATION;
    const inactivityExpired =
      lastActive && now - lastActive > INACTIVITY_TIMEOUT;

    if (sessionExpired || inactivityExpired) {
      await supabase.auth.signOut();

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      const response = NextResponse.redirect(redirectUrl);

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

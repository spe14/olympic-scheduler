import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Prevent open redirect — only allow relative paths on this origin
  const safePath = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      Sentry.captureException(
        new Error(`Auth code exchange failed: ${error.message}`),
        { extra: { safePath } }
      );
    } else {
      const response = NextResponse.redirect(new URL(safePath, request.url));

      // Mark recovery sessions so /reset-password can verify the flow
      if (safePath === "/reset-password") {
        response.cookies.set("password_reset", "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 5 * 60, // 5 minutes
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

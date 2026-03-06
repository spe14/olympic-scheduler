import { type NextRequest, NextResponse } from "next/server";

export function proxy(_request: NextRequest) {
  // TODO: Add Supabase auth session refresh
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

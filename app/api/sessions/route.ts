import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // TODO: Implement get sessions with filtering
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

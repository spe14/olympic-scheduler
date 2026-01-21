import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: Implement get group members
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

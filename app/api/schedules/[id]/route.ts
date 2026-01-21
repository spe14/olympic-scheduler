import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: Implement get schedule
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: Implement delete schedule
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}

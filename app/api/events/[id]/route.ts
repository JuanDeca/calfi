import { NextResponse } from "next/server";
import { deleteEvent } from "@/lib/events";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteEvent(Number(id));
  return NextResponse.json({ ok: true });
}

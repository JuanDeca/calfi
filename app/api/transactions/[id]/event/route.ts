import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { eventId } = (await request.json()) as { eventId: number | null };

  mutate((connection) => {
    connection.prepare("UPDATE transactions SET event_id = ? WHERE id = ?").run(eventId, id);
  });

  return NextResponse.json({ ok: true });
}

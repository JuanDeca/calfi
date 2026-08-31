import { NextResponse } from "next/server";
import { setTransactionNotes } from "@/lib/transactions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { notes } = (await request.json()) as { notes: string | null };
  setTransactionNotes(Number(id), notes?.trim() || null);
  return NextResponse.json({ ok: true });
}

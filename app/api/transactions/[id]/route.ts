import { NextResponse } from "next/server";
import { deleteManualTransaction } from "@/lib/transactions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = deleteManualTransaction(Number(id));
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

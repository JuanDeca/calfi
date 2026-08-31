import { NextResponse } from "next/server";
import { deleteDebtor } from "@/lib/debtors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteDebtor(Number(id));
  return NextResponse.json({ ok: true });
}

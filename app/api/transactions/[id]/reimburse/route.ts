import { NextResponse } from "next/server";
import { setReimbursementLink } from "@/lib/transactions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { expenseId } = (await request.json()) as { expenseId: number | null };

  setReimbursementLink(Number(id), expenseId);
  return NextResponse.json({ ok: true });
}

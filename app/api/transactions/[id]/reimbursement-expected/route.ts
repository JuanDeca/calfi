import { NextResponse } from "next/server";
import { setReimbursementExpected } from "@/lib/transactions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { amount } = (await request.json()) as { amount: number | null };

  setReimbursementExpected(Number(id), amount);
  return NextResponse.json({ ok: true });
}

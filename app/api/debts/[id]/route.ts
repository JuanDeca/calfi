import { NextResponse } from "next/server";
import { deleteDebt, toggleDebtIncluded, updateDebtValue } from "@/lib/patrimonio";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { currentValue?: number; includedInBalance?: boolean };

  if (body.currentValue !== undefined) {
    updateDebtValue(Number(id), Number(body.currentValue));
  }
  if (body.includedInBalance !== undefined) {
    toggleDebtIncluded(Number(id), body.includedInBalance);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteDebt(Number(id));
  return NextResponse.json({ ok: true });
}

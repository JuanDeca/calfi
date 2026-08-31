import { NextResponse } from "next/server";
import { setDebtorDebtStatus, deleteDebtorDebt } from "@/lib/debtors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = (await request.json()) as { status: "Pendiente" | "Pagado" };
  setDebtorDebtStatus(Number(id), status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteDebtorDebt(Number(id));
  return NextResponse.json({ ok: true });
}

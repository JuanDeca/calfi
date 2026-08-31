import { NextResponse } from "next/server";
import { createDebtorDebt } from "@/lib/debtors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { concept, amount } = (await request.json()) as { concept: string; amount: number };
  if (!concept?.trim() || !amount) {
    return NextResponse.json({ error: "Concepto y monto son obligatorios." }, { status: 400 });
  }
  const debtId = createDebtorDebt(Number(id), concept.trim(), amount);
  return NextResponse.json({ id: debtId });
}

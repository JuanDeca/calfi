import { NextResponse } from "next/server";
import { extractCounterparty } from "@/lib/categorization";
import { getTransactionById, getLastSplitTemplate } from "@/lib/transactions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transactionId = Number(id);

  const transaction = getTransactionById(transactionId);
  if (!transaction) {
    return NextResponse.json({ error: "Transacción no encontrada." }, { status: 404 });
  }

  const counterpartyKey = extractCounterparty(transaction.description);
  const template = getLastSplitTemplate(transactionId, counterpartyKey);
  return NextResponse.json({ template });
}

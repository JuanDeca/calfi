import { NextResponse } from "next/server";
import { generateRecurringMovement } from "@/lib/recurringMovements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { amount, originalAmountUsd, usdExchangeRate } = (await request.json()) as {
    amount: number;
    originalAmountUsd?: number | null;
    usdExchangeRate?: number | null;
  };
  if (!amount) {
    return NextResponse.json({ error: "El monto es obligatorio." }, { status: 400 });
  }
  const result = generateRecurringMovement(Number(id), amount, new Date(), {
    originalAmountUsd: originalAmountUsd ?? null,
    usdExchangeRate: usdExchangeRate ?? null,
  });
  return NextResponse.json(result);
}

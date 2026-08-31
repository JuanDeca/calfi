import { NextResponse } from "next/server";
import { getRecurringMovements, createRecurringMovement } from "@/lib/recurringMovements";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

interface CreateBody {
  description: string;
  defaultAmount: number;
  defaultAmountUsd?: number | null;
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  frequency: "mensual" | "anual";
  dayOfMonth: number;
  monthOfYear: number | null;
}

export async function GET() {
  return NextResponse.json({ movements: getRecurringMovements() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBody;
  if (!body.description?.trim() || !body.defaultAmount) {
    return NextResponse.json(
      { error: "Descripción y monto son obligatorios." },
      { status: 400 }
    );
  }
  const id = createRecurringMovement({
    description: body.description.trim(),
    defaultAmount: body.defaultAmount,
    defaultAmountUsd: body.defaultAmountUsd ?? null,
    categoryId: body.categoryId,
    subcategory: body.subcategory,
    expenseClass: body.expenseClass,
    impactsAnalysis: body.impactsAnalysis,
    frequency: body.frequency,
    dayOfMonth: body.dayOfMonth,
    monthOfYear: body.frequency === "anual" ? body.monthOfYear : null,
  });
  return NextResponse.json({ id });
}

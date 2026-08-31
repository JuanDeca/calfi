import { NextResponse } from "next/server";
import {
  setRecurringMovementActive,
  updateRecurringMovement,
  deleteRecurringMovement,
} from "@/lib/recurringMovements";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { active?: boolean; description?: string };
  if (typeof body.active === "boolean" && Object.keys(body).length === 1) {
    setRecurringMovementActive(Number(id), body.active);
    return NextResponse.json({ ok: true });
  }
  const {
    description,
    defaultAmount,
    defaultAmountUsd,
    categoryId,
    subcategory,
    expenseClass,
    impactsAnalysis,
    frequency,
    dayOfMonth,
    monthOfYear,
  } = body as {
    description: string;
    defaultAmount: number;
    defaultAmountUsd?: number | null;
    categoryId: number | null;
    subcategory: string | null;
    expenseClass: import("@/types/transaction").ExpenseClass;
    impactsAnalysis: "Sí" | "No";
    frequency: "mensual" | "anual";
    dayOfMonth: number;
    monthOfYear: number | null;
  };
  updateRecurringMovement(Number(id), {
    description,
    defaultAmount,
    defaultAmountUsd,
    categoryId,
    subcategory,
    expenseClass,
    impactsAnalysis,
    frequency,
    dayOfMonth,
    monthOfYear,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteRecurringMovement(Number(id));
  return NextResponse.json({ ok: true });
}

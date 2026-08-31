import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { isCategoryExcludedFromAnalysis, getCategoryLinkedAssetId } from "@/lib/categories";
import { bumpAssetValue } from "@/lib/patrimonio";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

const SOURCE_LABEL = "Carga manual";

interface ManualTransactionBody {
  date: string;
  description: string;
  amount: number;
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  originalAmountUsd?: number | null;
  usdExchangeRate?: number | null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ManualTransactionBody;

  if (!body.date || !body.description?.trim() || !body.amount) {
    return NextResponse.json(
      { error: "Fecha, descripción y monto son obligatorios." },
      { status: 400 }
    );
  }

  let impactsAnalysis = body.impactsAnalysis;
  if (isCategoryExcludedFromAnalysis(body.categoryId)) {
    impactsAnalysis = "No";
  }
  if (!body.categoryId && impactsAnalysis === "Sí") {
    return NextResponse.json(
      { error: "Elegí una categoría (o marcá que no impacta el análisis)." },
      { status: 400 }
    );
  }

  const isCountedExpense = impactsAnalysis === "Sí";
  const impactType = isCountedExpense
    ? body.amount > 0
      ? "Ingreso real"
      : "Gasto real"
    : "Transferencia interna";
  const impactReason = isCountedExpense
    ? body.amount > 0
      ? "Ingreso confirmado del período."
      : "Movimiento confirmado que representa consumo/gasto del período."
    : "Movimiento propio o entre cuentas; no representa gasto real.";

  const mpRawId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = mutate((connection) => {
    const info = connection
      .prepare(
        `
        INSERT INTO transactions (
          date, description, mp_reference, amount, running_balance,
          category_id, subcategory, rule_reason,
          impacts_analysis, impact_type, impact_reason, analysis_amount,
          expense_class, source_file, mp_raw_id, original_amount_usd, usd_exchange_rate
        ) VALUES (
          @date, @description, NULL, @amount, NULL,
          @categoryId, @subcategory, @ruleReason,
          @impactsAnalysis, @impactType, @impactReason, @analysisAmount,
          @expenseClass, @sourceFile, @mpRawId, @originalAmountUsd, @usdExchangeRate
        )
      `
      )
      .run({
        date: body.date,
        description: body.description.trim(),
        amount: body.amount,
        categoryId: body.categoryId,
        subcategory: body.subcategory,
        ruleReason: SOURCE_LABEL,
        impactsAnalysis,
        impactType,
        impactReason,
        analysisAmount: isCountedExpense ? Math.abs(body.amount) : 0,
        expenseClass: body.expenseClass,
        sourceFile: SOURCE_LABEL,
        mpRawId,
        originalAmountUsd: body.originalAmountUsd ?? null,
        usdExchangeRate: body.usdExchangeRate ?? null,
      });

    // Solo suma al activo vinculado si la carga es del día de hoy: una carga
    // con fecha pasada (poniéndose al día con meses atrasados) representa
    // plata que ya estaba adentro del valor actual del activo — sumarla de
    // nuevo la duplicaría (pasó dos veces ya, ver lib/patrimonio.ts).
    const today = new Date().toISOString().slice(0, 10);
    if (body.date === today) {
      const linkedAssetId = getCategoryLinkedAssetId(body.categoryId);
      if (linkedAssetId !== null) {
        bumpAssetValue(connection, linkedAssetId, Math.abs(body.amount), body.date);
      }
    }

    return { id: Number(info.lastInsertRowid) };
  });

  return NextResponse.json(result);
}

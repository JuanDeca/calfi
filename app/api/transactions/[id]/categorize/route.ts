import { NextResponse } from "next/server";
import { db, mutate } from "@/lib/db";
import {
  extractCounterparty,
  upsertCategorizationRule,
  applyRuleRetroactively,
  countAlreadyCategorized,
  countPendienteForCounterparty,
  getPreviousTransactionsForCounterparty,
} from "@/lib/categorization";
import { getTransactionById } from "@/lib/transactions";
import { isCategoryExcludedFromAnalysis } from "@/lib/categories";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

interface CategorizeBody {
  categoryId: number | null;
  subcategory: string | null;
  impactsAnalysis: Extract<ImpactsAnalysis, "Sí" | "No">;
  expenseClass: ExpenseClass;
  applyToFuture: boolean;
  applyToExisting: boolean;
}

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
  const alreadyCategorizedCount = countAlreadyCategorized(db, counterpartyKey, transactionId);
  const pendienteCount = countPendienteForCounterparty(db, counterpartyKey, transactionId);
  const previousTransactions = getPreviousTransactionsForCounterparty(
    db,
    counterpartyKey,
    transactionId
  );
  return NextResponse.json({
    counterpartyKey,
    alreadyCategorizedCount,
    pendienteCount,
    previousTransactions,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transactionId = Number(id);
  const body = (await request.json()) as CategorizeBody;

  const transaction = getTransactionById(transactionId);
  if (!transaction) {
    return NextResponse.json({ error: "Transacción no encontrada." }, { status: 404 });
  }

  // Una categoría marcada "no impacta el análisis" (ej. Reintegros) nunca debe
  // terminar contando como ingreso/gasto real, sin importar lo que mande el cliente.
  if (isCategoryExcludedFromAnalysis(body.categoryId)) {
    body.impactsAnalysis = "No";
  }

  const impactType =
    body.impactsAnalysis === "Sí"
      ? transaction.amount > 0
        ? "Ingreso real"
        : "Gasto real"
      : "Transferencia interna";
  const impactReason =
    body.impactsAnalysis === "Sí"
      ? transaction.amount > 0
        ? "Ingreso confirmado del período."
        : "Movimiento confirmado que representa consumo/gasto del período."
      : "Movimiento propio o entre cuentas; no representa gasto real.";
  const analysisAmount = body.impactsAnalysis === "Sí" ? Math.abs(transaction.amount) : 0;
  const counterpartyKey = extractCounterparty(transaction.description);

  const result = mutate((connection) => {
    connection
      .prepare(
        `
        UPDATE transactions SET
          category_id = @categoryId, subcategory = @subcategory,
          rule_reason = @ruleReason, impacts_analysis = @impactsAnalysis, impact_type = @impactType,
          impact_reason = @impactReason, analysis_amount = @analysisAmount, expense_class = @expenseClass
        WHERE id = @id
      `
      )
      .run({
        id: transactionId,
        categoryId: body.categoryId,
        subcategory: body.subcategory,
        ruleReason: "Categorización manual",
        impactsAnalysis: body.impactsAnalysis,
        impactType,
        impactReason,
        analysisAmount,
        expenseClass: body.expenseClass,
      });

    if (!body.applyToFuture) {
      return { appliedRetroactively: 0 };
    }

    const rule = {
      categoryId: body.categoryId,
      subcategory: body.subcategory,
      expenseClass: body.expenseClass,
      impactsAnalysis: body.impactsAnalysis,
    };

    upsertCategorizationRule(connection, counterpartyKey, rule);
    const appliedRetroactively = applyRuleRetroactively(
      connection,
      counterpartyKey,
      rule,
      transactionId,
      body.applyToExisting
    );

    return { appliedRetroactively };
  });

  return NextResponse.json(result);
}

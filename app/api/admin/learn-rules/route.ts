import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { extractCounterparty, upsertCategorizationRule } from "@/lib/categorization";
import type { ExpenseClass, ImpactsAnalysis } from "@/types/transaction";

interface SourceRow {
  id: number;
  date: string;
  description: string;
  category_id: number | null;
  subcategory: string | null;
  expense_class: ExpenseClass;
  impacts_analysis: ImpactsAnalysis;
}

export async function POST() {
  const result = mutate((connection) => {
    // Fuente: cualquier transacción ya resuelta (no Pendiente), sin contar
    // desgloses/ajustes puntuales — no son un patrón de contraparte estable.
    const rows = connection
      .prepare(
        `
        SELECT id, date, description, category_id, subcategory, expense_class, impacts_analysis
        FROM transactions
        WHERE impacts_analysis != 'Pendiente'
          AND category_id IS NOT NULL
          AND description NOT LIKE 'Desglose %'
          AND description NOT LIKE 'Ajuste %'
      `
      )
      .all() as SourceRow[];

    const byCounterparty = new Map<string, SourceRow[]>();
    for (const row of rows) {
      const key = extractCounterparty(row.description);
      if (!byCounterparty.has(key)) byCounterparty.set(key, []);
      byCounterparty.get(key)!.push(row);
    }

    let rulesCreated = 0;
    for (const [counterpartyKey, group] of byCounterparty) {
      const categoryIds = new Set(group.map((r) => r.category_id));
      if (categoryIds.size !== 1) continue; // inconsistente entre ocurrencias, no se puede inferir una regla confiable

      const mostRecent = group.reduce((a, b) => (a.date > b.date ? a : b));
      upsertCategorizationRule(connection, counterpartyKey, {
        categoryId: mostRecent.category_id,
        subcategory: mostRecent.subcategory,
        expenseClass: mostRecent.expense_class,
        impactsAnalysis: mostRecent.impacts_analysis,
      });
      rulesCreated += 1;
    }

    // Aplicar retroactivamente a lo que sigue Pendiente en toda la base.
    const pendientes = connection
      .prepare(
        "SELECT id, description, amount FROM transactions WHERE impacts_analysis = 'Pendiente'"
      )
      .all() as { id: number; description: string; amount: number }[];

    const update = connection.prepare(`
      UPDATE transactions SET
        category_id = @categoryId, subcategory = @subcategory,
        rule_reason = 'Regla aprendida', impacts_analysis = @impactsAnalysis, impact_type = @impactType,
        impact_reason = @impactReason, analysis_amount = @analysisAmount, expense_class = @expenseClass
      WHERE id = @id
    `);

    let transactionsUpdated = 0;
    for (const pendiente of pendientes) {
      const counterpartyKey = extractCounterparty(pendiente.description);
      const group = byCounterparty.get(counterpartyKey);
      if (!group) continue;
      const categoryIds = new Set(group.map((r) => r.category_id));
      if (categoryIds.size !== 1) continue;
      const mostRecent = group.reduce((a, b) => (a.date > b.date ? a : b));
      const isCountedExpense = mostRecent.impacts_analysis === "Sí";

      update.run({
        id: pendiente.id,
        categoryId: mostRecent.category_id,
        subcategory: mostRecent.subcategory,
        impactsAnalysis: mostRecent.impacts_analysis,
        impactType: isCountedExpense
          ? pendiente.amount > 0
            ? "Ingreso real"
            : "Gasto real"
          : "Transferencia interna",
        impactReason: isCountedExpense
          ? "Movimiento confirmado que representa consumo/gasto del período."
          : "Movimiento propio o entre cuentas; no representa gasto real.",
        analysisAmount: isCountedExpense ? Math.abs(pendiente.amount) : 0,
        expenseClass: mostRecent.expense_class,
      });
      transactionsUpdated += 1;
    }

    return { rulesCreated, transactionsUpdated };
  });

  return NextResponse.json(result);
}

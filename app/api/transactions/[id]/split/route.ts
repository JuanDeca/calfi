import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { getTransactionById, getSplitChildren } from "@/lib/transactions";
import type { ExpenseClass } from "@/types/transaction";

interface SplitPart {
  categoryId: number;
  subcategory: string | null;
  amount: number;
  expenseClass: ExpenseClass;
}

const SUFFIX_LETTERS = "ABCDEFGHIJ";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const children = getSplitChildren(Number(id));
  return NextResponse.json({ children });
}

/**
 * Crea o reemplaza el desglose de una transacción: si ya tenía partes de un
 * desglose anterior, se borran y se reinsertan con los valores nuevos (mismo
 * endpoint sirve para "Desglosar" y "Editar desglose").
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transactionId = Number(id);
  const { parts } = (await request.json()) as { parts: SplitPart[] };

  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "Agregá al menos una parte." }, { status: 400 });
  }

  const transaction = getTransactionById(transactionId);
  if (!transaction) {
    return NextResponse.json({ error: "Transacción no encontrada." }, { status: 404 });
  }

  const sign = transaction.amount < 0 ? -1 : 1;
  const baseReference = transaction.mpRawId ?? `local-${transaction.id}`;

  const result = mutate((connection) => {
    const getCategoryName = connection.prepare("SELECT name FROM categories WHERE id = ?");
    const deleteExistingChildren = connection.prepare(
      "DELETE FROM transactions WHERE parent_transaction_id = ?"
    );
    const insertPart = connection.prepare(`
      INSERT INTO transactions (
        date, description, mp_reference, amount, running_balance,
        category_id, subcategory, rule_reason,
        impacts_analysis, impact_type, impact_reason, analysis_amount,
        expense_class, parent_transaction_id, source_file, mp_raw_id
      ) VALUES (
        @date, @description, @mpReference, @amount, NULL,
        @categoryId, @subcategory, 'Desglose manual',
        'Sí', @impactType, @impactReason, @analysisAmount,
        @expenseClass, @parentTransactionId, @sourceFile, @mpRawId
      )
    `);
    const updateParent = connection.prepare(`
      UPDATE transactions SET
        category_id = NULL, impacts_analysis = 'No', impact_type = 'Movimiento desglosado',
        impact_reason = 'El movimiento original se excluye para evitar duplicar; se incluyen las filas de desglose.',
        analysis_amount = 0, rule_reason = 'Movimiento dividido según indicación del usuario'
      WHERE id = ?
    `);

    const doSplit = connection.transaction(() => {
      deleteExistingChildren.run(transactionId);
      parts.forEach((part, index) => {
        const category = getCategoryName.get(part.categoryId) as { name: string } | undefined;
        const suffix = SUFFIX_LETTERS[index] ?? String(index + 1);
        const amount = sign * Math.abs(part.amount);
        insertPart.run({
          date: transaction.date,
          description: `Desglose ${transaction.description} - ${category?.name ?? "otro"}`,
          mpReference: `${baseReference}-${suffix}`,
          amount,
          categoryId: part.categoryId,
          subcategory: part.subcategory,
          impactType: amount > 0 ? "Ingreso real" : "Gasto real",
          impactReason: "Movimiento confirmado que representa consumo/gasto del período.",
          analysisAmount: Math.abs(amount),
          expenseClass: part.expenseClass,
          parentTransactionId: transactionId,
          sourceFile: transaction.sourceFile,
          mpRawId: `${baseReference}-${suffix}`,
        });
      });
      updateParent.run(transactionId);
    });
    doSplit();

    return { created: parts.length };
  });

  return NextResponse.json(result);
}

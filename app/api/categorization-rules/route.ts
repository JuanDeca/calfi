import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { upsertCategorizationRule, applyRuleRetroactively } from "@/lib/categorization";
import type { ExpenseClass } from "@/types/transaction";

interface CreateRuleBody {
  counterpartyKey: string;
  categoryId: number | null;
  subcategory: string | null;
  expenseClass: ExpenseClass;
  impactsAnalysis: "Sí" | "No";
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRuleBody;
  const counterpartyKey = body.counterpartyKey?.trim();

  if (!counterpartyKey) {
    return NextResponse.json({ error: "La contraparte es obligatoria." }, { status: 400 });
  }
  if (!body.categoryId && body.impactsAnalysis === "Sí") {
    return NextResponse.json(
      { error: "Elegí una categoría (o marcá que no impacta el análisis)." },
      { status: 400 }
    );
  }

  const rule = {
    categoryId: body.categoryId,
    subcategory: body.subcategory,
    expenseClass: body.expenseClass,
    impactsAnalysis: body.impactsAnalysis,
  };

  const result = mutate((connection) => {
    upsertCategorizationRule(connection, counterpartyKey, rule);
    const appliedRetroactively = applyRuleRetroactively(connection, counterpartyKey, rule);
    return { appliedRetroactively };
  });

  return NextResponse.json(result);
}

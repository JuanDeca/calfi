import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { db, mutate } from "@/lib/db";
import { getOrCreateCategoryId } from "@/lib/categorization";

const execFileAsync = promisify(execFile);

const PYTHON_BIN = path.join(process.cwd(), "scripts", "venv", "bin", "python3");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "migrate_historical.py");
const SOURCE_XLSX = process.env.CALFI_MIGRATE_HISTORICAL_XLSX ?? "";
const SOURCE_FILE_LABEL = SOURCE_XLSX ? path.basename(SOURCE_XLSX) : "(no configurado)";

interface HistoricalRow {
  date: string;
  description: string;
  mpReference: string | null;
  amount: number;
  runningBalance: number | null;
  category: string | null;
  subcategory: string | null;
  ruleReason: string | null;
  impactsAnalysis: "Sí" | "No" | "Pendiente";
  impactType: string | null;
  impactReason: string | null;
  analysisAmount: number | null;
  expenseClass: "Fijo" | "Variable" | "Extraordinario" | "No aplica";
}

function dedupeReferences(rows: HistoricalRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = row.mpReference ?? "";
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 || !key ? key : `${key}-dup${count}`;
  });
}

export async function POST() {
  if (!SOURCE_XLSX) {
    return NextResponse.json(
      { error: "Falta configurar CALFI_MIGRATE_HISTORICAL_XLSX en el entorno." },
      { status: 400 }
    );
  }

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM transactions")
    .get() as { count: number };

  if (count > 0) {
    return NextResponse.json(
      { error: "La tabla transactions ya tiene datos; la migración histórica no se vuelve a correr." },
      { status: 409 }
    );
  }

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(PYTHON_BIN, [SCRIPT_PATH, SOURCE_XLSX]));
  } catch (execError) {
    stdout = (execError as { stdout?: string }).stdout ?? "";
    if (!stdout) {
      const message = execError instanceof Error ? execError.message : "Error inesperado.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  const parsed = JSON.parse(stdout) as HistoricalRow[] | { error: string };

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 500 });
  }

  const mpRawIds = dedupeReferences(parsed);

  const result = mutate((connection) => {
    const insert = connection.prepare(`
      INSERT INTO transactions (
        date, description, mp_reference, amount, running_balance,
        category_id, subcategory, rule_reason,
        impacts_analysis, impact_type, impact_reason, analysis_amount,
        expense_class, source_file, mp_raw_id
      ) VALUES (
        @date, @description, @mpReference, @amount, @runningBalance,
        @categoryId, @subcategory, @ruleReason,
        @impactsAnalysis, @impactType, @impactReason, @analysisAmount,
        @expenseClass, @sourceFile, @mpRawId
      )
    `);

    const idByReference = new Map<string, number>();

    const insertAll = connection.transaction(() => {
      parsed.forEach((row, index) => {
        const categoryId = row.category
          ? getOrCreateCategoryId(
              connection,
              row.category,
              row.category === "Ingresos" ? "ingreso" : "gasto"
            )
          : null;

        const mpRawId = mpRawIds[index];
        const info = insert.run({
          date: row.date,
          description: row.description,
          mpReference: row.mpReference,
          amount: row.amount,
          runningBalance: row.runningBalance,
          categoryId,
          subcategory: row.subcategory,
          ruleReason: row.ruleReason,
          impactsAnalysis: row.impactsAnalysis,
          impactType: row.impactType,
          impactReason: row.impactReason,
          analysisAmount: row.analysisAmount,
          expenseClass: row.expenseClass,
          sourceFile: SOURCE_FILE_LABEL,
          mpRawId: mpRawId || null,
        });

        if (mpRawId) idByReference.set(mpRawId, Number(info.lastInsertRowid));
      });
    });
    insertAll();

    const linkParent = connection.prepare(
      "UPDATE transactions SET parent_transaction_id = ? WHERE id = ?"
    );
    let linked = 0;
    for (const [mpRawId, id] of idByReference) {
      const prefix = mpRawId.split("-")[0];
      const parentId = idByReference.get(prefix);
      if (parentId && parentId !== id) {
        linkParent.run(parentId, id);
        linked += 1;
      }
    }

    return { inserted: parsed.length, linked };
  });

  return NextResponse.json(result);
}

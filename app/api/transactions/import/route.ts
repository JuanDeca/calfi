import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { resolveImportCategorization } from "@/lib/categorization";
import { getCategoryLinkedAssetId } from "@/lib/categories";
import { bumpAssetValue } from "@/lib/patrimonio";

const execFileAsync = promisify(execFile);

const PYTHON_BIN = path.join(process.cwd(), "scripts", "venv", "bin", "python3");
const SCRIPTS_BY_EXT: Record<string, string> = {
  ".xlsx": path.join(process.cwd(), "scripts", "parse_mercadopago_xlsx.py"),
  ".pdf": path.join(process.cwd(), "scripts", "parse_mercadopago_pdf.py"),
};

interface RawRow {
  date: string;
  description: string;
  mpReference: string;
  amount: number;
  runningBalance: number | null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo a importar." }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  const scriptPath = SCRIPTS_BY_EXT[ext];
  if (!scriptPath) {
    return NextResponse.json(
      { error: "Formato no soportado. Subí un .xlsx o un .pdf exportado de Mercado Pago." },
      { status: 400 }
    );
  }

  const tempPath = path.join(os.tmpdir(), `calfi-import-${Date.now()}${ext}`);
  await fs.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

  try {
    // execFile rechaza la promesa si el script sale con código != 0 (nuestros
    // scripts hacen sys.exit(1) en los casos de error), así que el JSON de
    // error impreso por stdout viaja en la excepción, no en un resultado normal.
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(PYTHON_BIN, [scriptPath, tempPath]));
    } catch (execError) {
      stdout = (execError as { stdout?: string }).stdout ?? "";
      if (!stdout) throw execError;
    }

    const parsed = JSON.parse(stdout) as RawRow[] | { error: string };

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const result = mutate((connection) => {
      const existing = new Set(
        (
          connection.prepare("SELECT mp_raw_id FROM transactions WHERE mp_raw_id IS NOT NULL").all() as {
            mp_raw_id: string;
          }[]
        ).map((row) => row.mp_raw_id)
      );

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

      let imported = 0;
      let skippedDuplicates = 0;

      const insertAll = connection.transaction((rows: RawRow[]) => {
        for (const row of rows) {
          // Chequeo contra lo ya visto (DB + filas de esta misma corrida) y,
          // como red de seguridad final, contra la constraint UNIQUE de
          // mp_raw_id por si dos importaciones corrieran en simultáneo.
          if (existing.has(row.mpReference)) {
            skippedDuplicates += 1;
            continue;
          }

          const resolution = resolveImportCategorization(connection, row.description);
          const isResolved = resolution.ruleReason !== null;
          const isCountedExpense = resolution.impactsAnalysis === "Sí";

          try {
            insert.run({
              date: row.date,
              description: row.description,
              mpReference: row.mpReference,
              amount: row.amount,
              runningBalance: row.runningBalance,
              categoryId: resolution.categoryId,
              subcategory: resolution.subcategory,
              ruleReason: resolution.ruleReason,
              impactsAnalysis: resolution.impactsAnalysis,
              impactType: isResolved
                ? isCountedExpense
                  ? row.amount > 0
                    ? "Ingreso real"
                    : "Gasto real"
                  : "Transferencia interna"
                : "Pendiente de categorizar",
              impactReason: isResolved
                ? isCountedExpense
                  ? "Movimiento confirmado que representa consumo/gasto del período."
                  : "Movimiento propio o entre cuentas; no representa gasto real."
                : "No se usa para conclusiones finales hasta confirmar categoría.",
              analysisAmount: isCountedExpense ? Math.abs(row.amount) : 0,
              expenseClass: resolution.expenseClass,
              sourceFile: file.name,
              mpRawId: row.mpReference,
            });
            existing.add(row.mpReference);
            imported += 1;

            // Igual que en la carga manual: solo suma al activo vinculado si
            // la fila es de hoy. Un resumen importado casi siempre trae
            // movimientos de días/semanas atrás, que ya están reflejados en
            // el valor actual del activo — sumarlos de nuevo lo duplicaría.
            if (row.date === today) {
              const linkedAssetId = getCategoryLinkedAssetId(resolution.categoryId);
              if (linkedAssetId !== null) {
                bumpAssetValue(connection, linkedAssetId, Math.abs(row.amount), row.date);
              }
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
              skippedDuplicates += 1;
              continue;
            }
            throw error;
          }
        }
      });
      insertAll(parsed);

      return { imported, skippedDuplicates, total: parsed.length };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al importar.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

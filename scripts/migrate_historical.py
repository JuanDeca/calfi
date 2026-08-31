"""
Lee la hoja "Movimientos" del Excel de referencia (sistema financiero manual
de Juan, ya categorizado) y la normaliza a JSON para sembrar la tabla
`transactions`. No escribe en la base de datos — eso lo hace el endpoint de
Node que invoca este script.
Uso: python3 migrate_historical.py <ruta.xlsx>
"""

import json
import sys

import openpyxl

PSEUDO_CATEGORIES = {"No aplica", "A revisar", "Desglosado"}


def parse_es_date(raw: str) -> str:
    day, month, year = raw.split("/")
    return f"{year}-{month}-{day}"


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta la ruta del archivo XLSX"}))
        sys.exit(1)

    path = sys.argv[1]

    try:
        workbook = openpyxl.load_workbook(path, data_only=True)
        sheet = workbook["Movimientos"]
        rows = list(sheet.iter_rows(min_row=2, values_only=True))

        transactions = []
        for row in rows:
            (
                row_id,
                fecha,
                _mes,
                descripcion,
                referencia,
                importe,
                saldo_parcial,
                categoria,
                subcategoria,
                confianza,
                motivo_regla,
                impacta_analisis,
                tipo_impacto,
                motivo_impacto,
                importe_analisis,
                clase_gasto,
                _evento_nota,
            ) = row[:17]

            if row_id is None or fecha is None:
                continue

            category = None if categoria in PSEUDO_CATEGORIES else categoria

            transactions.append(
                {
                    "date": parse_es_date(fecha),
                    "description": descripcion,
                    "mpReference": str(referencia) if referencia is not None else None,
                    "amount": importe,
                    "runningBalance": saldo_parcial,
                    "category": category,
                    "subcategory": subcategoria,
                    "ruleReason": motivo_regla,
                    "impactsAnalysis": impacta_analisis,
                    "impactType": tipo_impacto,
                    "impactReason": motivo_impacto,
                    "analysisAmount": importe_analisis,
                    "expenseClass": clase_gasto,
                }
            )

        print(json.dumps(transactions))
    except Exception as exc:  # noqa: BLE001 - reportar cualquier falla de parseo al caller
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

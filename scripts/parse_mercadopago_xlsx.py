"""
Parsea un XLSX crudo exportado desde Mercado Pago (sin categorización).
Formato esperado: una fila de resumen (INITIAL_BALANCE/CREDITS/DEBITS/FINAL_BALANCE),
una fila en blanco, una fila de headers (RELEASE_DATE/TRANSACTION_TYPE/REFERENCE_ID/
TRANSACTION_NET_AMOUNT/PARTIAL_BALANCE) y luego una fila por movimiento.
Uso: python3 parse_mercadopago_xlsx.py <ruta.xlsx>
Salida: JSON por stdout con la lista de movimientos normalizados.
"""

import json
import sys
import zipfile

import openpyxl

HEADER_MARKER = "RELEASE_DATE"


def parse_ar_number(raw: str) -> float:
    # Formato argentino: "." separador de miles, "," separador decimal.
    cleaned = raw.replace(".", "").replace(",", ".")
    return float(cleaned)


def parse_ar_date(raw: str) -> str:
    day, month, year = raw.split("-")
    return f"{year}-{month}-{day}"


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta la ruta del archivo XLSX"}))
        sys.exit(1)

    path = sys.argv[1]

    try:
        workbook = openpyxl.load_workbook(path, data_only=True)
        sheet = workbook.worksheets[0]
        rows = list(sheet.iter_rows(values_only=True))

        header_index = next(
            i for i, row in enumerate(rows) if row and row[0] == HEADER_MARKER
        )

        transactions = []
        for row in rows[header_index + 1 :]:
            if not row or row[0] is None:
                continue
            release_date, description, reference_id, net_amount, partial_balance = row[:5]
            transactions.append(
                {
                    "date": parse_ar_date(str(release_date)),
                    "description": str(description),
                    "mpReference": str(reference_id),
                    "amount": parse_ar_number(str(net_amount)),
                    "runningBalance": parse_ar_number(str(partial_balance))
                    if partial_balance is not None
                    else None,
                }
            )

        print(json.dumps(transactions))
    except StopIteration:
        print(
            json.dumps(
                {
                    "error": "El archivo no tiene el formato esperado de un export de Mercado Pago "
                    f"(no se encontró la fila de headers '{HEADER_MARKER}')."
                }
            )
        )
        sys.exit(1)
    except zipfile.BadZipFile:
        print(json.dumps({"error": "El archivo está dañado o no es un XLSX válido."}))
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - reportar cualquier falla de parseo al caller
        print(json.dumps({"error": f"No se pudo procesar el archivo: {exc}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()

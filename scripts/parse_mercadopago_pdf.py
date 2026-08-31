"""
Parsea un "Resumen de cuenta en pesos" de Mercado Pago exportado en PDF
(MP dejó de ofrecer export XLSX, ahora solo PDF). El PDF no tiene una grilla
real: cada movimiento se reconstruye a partir de las posiciones (x, top) de
las palabras, porque una descripción larga se parte en una línea antes y/o
después de la fila con fecha/ID/montos.

Uso: python3 parse_mercadopago_pdf.py <ruta.pdf>
Salida: JSON por stdout con la lista de movimientos normalizados (mismo
shape que parse_mercadopago_xlsx.py).
"""

import json
import re
import sys

import pdfplumber

DATE_RE = re.compile(r"^\d{2}-\d{2}-\d{4}$")
ID_RE = re.compile(r"^\d{9,}$")
# La columna de descripción arranca ~89 en la mayoría de los resúmenes, pero
# se vio un export real donde el x0 de la primera palabra renderiza en 88.9875
# (subpíxel por debajo de 89) — un límite estricto en 89 la excluía de
# `inline_desc`, dejando la descripción vacía para líneas de una sola palabra
# (ej. "Rendimientos") y arrastrando un corrimiento en cascada sobre todas las
# descripciones siguientes del documento (le robaban el prefijo pendiente a la
# transacción equivocada). Con margen hasta 80 alcanza para no confundirla con
# las columnas de fecha (x0 40.5) o ID de operación (x0 197.3).
DESC_COL_START = 80
DESC_COL_END = 195  # límite x0 de la columna de descripción


def parse_ar_number(raw: str) -> float:
    cleaned = raw.replace("$", "").replace("US$", "").strip()
    cleaned = cleaned.replace(".", "").replace(",", ".")
    return float(cleaned)


def parse_ar_date(raw: str) -> str:
    day, month, year = raw.split("-")
    return f"{year}-{month}-{day}"


def cluster_rows(words, tol=2.5):
    rows = []
    for w in sorted(words, key=lambda w: w["top"]):
        for row in rows:
            if abs(row[0]["top"] - w["top"]) <= tol:
                row.append(w)
                break
        else:
            rows.append([w])
    rows.sort(key=lambda r: r[0]["top"])
    return [sorted(r, key=lambda w: w["x0"]) for r in rows]


def has_date(row):
    return bool(DATE_RE.match(row[0]["text"]))


def is_desc_only(row):
    return not has_date(row) and all(w["x0"] < DESC_COL_END for w in row)


def parse_page(page):
    rows = cluster_rows(page.extract_words())
    transactions = []
    pending_prefix = None
    i = 0
    while i < len(rows):
        row = rows[i]
        if has_date(row):
            date = row[0]["text"]
            inline_desc = [w["text"] for w in row if DESC_COL_START <= w["x0"] < DESC_COL_END]
            if inline_desc:
                desc = " ".join(inline_desc)
            else:
                parts = [pending_prefix] if pending_prefix else []
                if i + 1 < len(rows) and is_desc_only(rows[i + 1]):
                    parts.append(" ".join(w["text"] for w in rows[i + 1]))
                    i += 1
                desc = " ".join(parts)
            pending_prefix = None

            id_words = [
                w["text"] for w in row if DESC_COL_END <= w["x0"] < 290 and ID_RE.match(w["text"])
            ]
            amount_tokens = [w["text"] for w in row if w["x0"] >= 290 and w["text"] != "$"]

            if len(amount_tokens) >= 2:
                transactions.append(
                    {
                        "date": parse_ar_date(date),
                        "description": desc.strip(),
                        "mpReference": id_words[0] if id_words else None,
                        "amount": parse_ar_number(amount_tokens[-2]),
                        "runningBalance": parse_ar_number(amount_tokens[-1]),
                    }
                )
        elif is_desc_only(row):
            pending_prefix = " ".join(w["text"] for w in row)
        i += 1
    return transactions


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta la ruta del archivo PDF"}))
        sys.exit(1)

    path = sys.argv[1]

    try:
        transactions = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if "TENENCIAS EN DÓLARES" in text or "RESUMEN DE INVERSIONES" in text:
                    continue
                if "DETALLE DE MOVIMIENTOS" not in text and "ID de la" not in text:
                    continue
                transactions.extend(parse_page(page))

        if not transactions:
            print(
                json.dumps(
                    {
                        "error": "No se encontraron movimientos en el PDF — puede que no sea "
                        "un resumen de cuenta en pesos de Mercado Pago."
                    }
                )
            )
            sys.exit(1)

        print(json.dumps(transactions))
    except Exception as exc:  # noqa: BLE001 - reportar cualquier falla de parseo al caller
        print(json.dumps({"error": f"No se pudo procesar el archivo: {exc}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()

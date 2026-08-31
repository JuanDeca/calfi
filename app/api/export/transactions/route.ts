import { NextResponse } from "next/server";
import { getTransactions } from "@/lib/transactions";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  "date",
  "description",
  "counterparty",
  "amount",
  "categoryName",
  "subcategory",
  "impactsAnalysis",
  "expenseClass",
  "mpRawId",
] as const;

export async function GET() {
  const transactions = getTransactions();

  const header = COLUMNS.join(",");
  const rows = transactions.map((transaction) =>
    COLUMNS.map((column) => csvEscape(transaction[column])).join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calfi_transacciones_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

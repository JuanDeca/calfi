import { NextResponse } from "next/server";
import { searchTransactionsForLink } from "@/lib/transactions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const sign = searchParams.get("sign") === "negative" ? "negative" : "positive";
  const excludeId = searchParams.get("excludeId");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results = searchTransactionsForLink(
    query,
    sign,
    excludeId ? Number(excludeId) : undefined
  );
  return NextResponse.json({ results });
}

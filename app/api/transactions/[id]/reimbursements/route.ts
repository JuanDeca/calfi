import { NextResponse } from "next/server";
import { getReimbursementsFor } from "@/lib/transactions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const results = getReimbursementsFor(Number(id));
  return NextResponse.json({ results });
}

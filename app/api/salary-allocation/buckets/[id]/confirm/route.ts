import { NextResponse } from "next/server";
import { getSalaryAllocationBuckets, recordPocketConfirmation } from "@/lib/salaryAllocation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { confirmedBalance } = (await request.json()) as { confirmedBalance: number };

  const bucket = getSalaryAllocationBuckets().find((b) => b.id === Number(id));
  if (!bucket) {
    return NextResponse.json({ error: "Sobre no encontrado." }, { status: 404 });
  }

  recordPocketConfirmation(bucket.key, confirmedBalance);
  return NextResponse.json({ ok: true });
}

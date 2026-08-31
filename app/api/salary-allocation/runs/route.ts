import { NextResponse } from "next/server";
import { computeAllocation, recordAllocationRun, getLastAllocationRun } from "@/lib/salaryAllocation";

export async function GET() {
  return NextResponse.json({ lastRun: getLastAllocationRun() });
}

export async function POST(request: Request) {
  const { grossAmount } = (await request.json()) as { grossAmount: number };
  const breakdown = computeAllocation(grossAmount);
  const id = recordAllocationRun(grossAmount, breakdown);
  return NextResponse.json({ id, breakdown });
}

import { NextResponse } from "next/server";
import { updateBucketPercentage } from "@/lib/salaryAllocation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { percentage } = (await request.json()) as { percentage: number };
  updateBucketPercentage(Number(id), percentage);
  return NextResponse.json({ ok: true });
}

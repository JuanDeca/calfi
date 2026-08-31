import { NextResponse } from "next/server";
import { getBucketsWithBalances } from "@/lib/salaryAllocation";

export async function GET() {
  return NextResponse.json({ buckets: getBucketsWithBalances() });
}

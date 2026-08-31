import { NextResponse } from "next/server";
import { getPlannedPurchases, createPlannedPurchase } from "@/lib/plannedPurchases";

export async function GET() {
  return NextResponse.json({ items: getPlannedPurchases() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name: string;
    notes: string | null;
    estimatedAmount: number | null;
    categoryId: number | null;
    targetMonth: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const id = createPlannedPurchase({
    name: body.name.trim(),
    notes: body.notes?.trim() || null,
    estimatedAmount: body.estimatedAmount ?? null,
    categoryId: body.categoryId ?? null,
    targetMonth: body.targetMonth || null,
  });
  return NextResponse.json({ id });
}

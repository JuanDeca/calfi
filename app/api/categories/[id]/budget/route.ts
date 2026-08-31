import { NextResponse } from "next/server";
import { setBudget, deleteBudget, getBudgetForCategory } from "@/lib/budgets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ budget: getBudgetForCategory(Number(id)) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { monthlyLimit } = (await request.json()) as { monthlyLimit: number };
  if (!monthlyLimit || monthlyLimit <= 0) {
    return NextResponse.json({ error: "El límite mensual debe ser mayor a cero." }, { status: 400 });
  }
  setBudget(Number(id), monthlyLimit);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteBudget(Number(id));
  return NextResponse.json({ ok: true });
}

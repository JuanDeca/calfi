import { NextResponse } from "next/server";
import { getDebtors, createDebtor } from "@/lib/debtors";

export async function GET() {
  return NextResponse.json({ debtors: getDebtors() });
}

export async function POST(request: Request) {
  const { name, notes } = (await request.json()) as { name: string; notes: string | null };
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  const id = createDebtor(name.trim(), notes?.trim() || null);
  return NextResponse.json({ id });
}

import { NextResponse } from "next/server";
import { createCategory } from "@/lib/categories";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name: string;
    type: "gasto" | "ingreso";
    excludedFromAnalysis?: boolean;
    icon?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  createCategory(
    body.name.trim(),
    body.type,
    body.excludedFromAnalysis ?? false,
    body.icon?.trim() || undefined
  );
  return NextResponse.json({ ok: true });
}

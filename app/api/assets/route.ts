import { NextResponse } from "next/server";
import { createAsset } from "@/lib/patrimonio";

export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; type: string; currentValue: number };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const id = createAsset(body.name.trim(), body.type.trim() || "Otro", Number(body.currentValue) || 0);
  return NextResponse.json({ id });
}

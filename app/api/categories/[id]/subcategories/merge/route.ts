import { NextResponse } from "next/server";
import { mergeSubcategories } from "@/lib/categories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { from, to } = (await request.json()) as { from: string; to: string };

  if (!from?.trim() || !to?.trim()) {
    return NextResponse.json(
      { error: "Elegí la subcategoría origen y destino." },
      { status: 400 }
    );
  }
  if (from.trim() === to.trim()) {
    return NextResponse.json(
      { error: "Origen y destino no pueden ser la misma subcategoría." },
      { status: 400 }
    );
  }

  const updated = mergeSubcategories(Number(id), from.trim(), to.trim());
  return NextResponse.json({ updated });
}

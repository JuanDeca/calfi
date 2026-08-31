import { NextResponse } from "next/server";
import { deleteCategorizationRule } from "@/lib/categories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  deleteCategorizationRule(decodeURIComponent(key));
  return NextResponse.json({ ok: true });
}

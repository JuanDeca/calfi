import { NextResponse } from "next/server";
import {
  deleteCategory,
  setCategoryExcludedFromAnalysis,
  setCategoryIcon,
  setCategoryLinkedAsset,
} from "@/lib/categories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteCategory(Number(id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    excludedFromAnalysis?: boolean;
    icon?: string;
    linkedAssetId?: number | null;
  };
  if (body.excludedFromAnalysis !== undefined) {
    setCategoryExcludedFromAnalysis(Number(id), body.excludedFromAnalysis);
  }
  if (body.icon !== undefined && body.icon.trim()) {
    setCategoryIcon(Number(id), body.icon.trim());
  }
  if (body.linkedAssetId !== undefined) {
    setCategoryLinkedAsset(Number(id), body.linkedAssetId);
  }
  return NextResponse.json({ ok: true });
}

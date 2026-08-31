import { NextResponse } from "next/server";
import { deleteAsset, toggleAssetIncluded, updateAssetValue } from "@/lib/patrimonio";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { currentValue?: number; includedInBalance?: boolean };

  if (body.currentValue !== undefined) {
    updateAssetValue(Number(id), Number(body.currentValue));
  }
  if (body.includedInBalance !== undefined) {
    toggleAssetIncluded(Number(id), body.includedInBalance);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteAsset(Number(id));
  return NextResponse.json({ ok: true });
}

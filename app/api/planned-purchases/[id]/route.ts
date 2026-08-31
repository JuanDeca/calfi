import { NextResponse } from "next/server";
import {
  updatePlannedPurchase,
  setPlannedPurchaseStatus,
  movePlannedPurchase,
  deletePlannedPurchase,
  type PlannedPurchaseStatus,
} from "@/lib/plannedPurchases";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    notes?: string | null;
    estimatedAmount?: number | null;
    categoryId?: number | null;
    targetMonth?: string | null;
    status?: PlannedPurchaseStatus;
    move?: "up" | "down";
  };

  if (body.move !== undefined) {
    movePlannedPurchase(Number(id), body.move);
  } else if (body.status !== undefined) {
    setPlannedPurchaseStatus(Number(id), body.status);
  } else if (body.name !== undefined) {
    updatePlannedPurchase(Number(id), {
      name: body.name.trim(),
      notes: body.notes?.trim() || null,
      estimatedAmount: body.estimatedAmount ?? null,
      categoryId: body.categoryId ?? null,
      targetMonth: body.targetMonth || null,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deletePlannedPurchase(Number(id));
  return NextResponse.json({ ok: true });
}

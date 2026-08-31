import { NextResponse } from "next/server";
import { getSubcategoriesForCategory } from "@/lib/categories";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const subcategories = getSubcategoriesForCategory(Number(id));
  return NextResponse.json({ subcategories });
}

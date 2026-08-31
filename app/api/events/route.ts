import { NextResponse } from "next/server";
import { createEvent } from "@/lib/events";

export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; description: string | null };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const id = createEvent(body.name.trim(), body.description?.trim() || null);
  return NextResponse.json({ id });
}

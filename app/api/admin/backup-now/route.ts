import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backupDatabase } from "@/lib/backup";

export async function POST() {
  backupDatabase(db);
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}

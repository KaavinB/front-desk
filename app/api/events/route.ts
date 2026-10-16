import { NextResponse } from "next/server";
import { clearEntries, listEntries } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: await listEntries() });
}

/** Reset the log (demo convenience; disabled in production). */
export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  await clearEntries();
  return NextResponse.json({ ok: true });
}

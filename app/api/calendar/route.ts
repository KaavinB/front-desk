import { NextResponse } from "next/server";
import { loadCalendar } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadCalendar());
}

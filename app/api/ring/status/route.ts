import { NextResponse } from "next/server";
import { cameraStatus } from "@/lib/ring/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await cameraStatus());
}

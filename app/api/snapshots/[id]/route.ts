import { promises as fs } from "node:fs";
import { snapshotFile } from "@/lib/snapshots";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("bad id", { status: 400 });
  try {
    const jpeg = await fs.readFile(snapshotFile(id));
    return new Response(jpeg, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { updateEntry } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({
  /** Appointment the host says this visitor is, or null for "not an appointment". */
  appointmentId: z.string().nullable(),
  by: z.string().default("host"),
});

/** The host's one-tap confirmation. This is what makes the visitor log trustworthy. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const updated = await updateEntry(id, {
    confirmation: { appointmentId: body.data.appointmentId, by: body.data.by, at: new Date().toISOString() },
  });
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, entry: updated });
}

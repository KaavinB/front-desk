import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifySignature } from "@/lib/ring/verify";
import { RingWebhookSchema } from "@/lib/ring/types";
import { loadCalendar } from "@/lib/calendar";
import { decide } from "@/lib/matcher";
import { appendEntry, updateEntry } from "@/lib/store";
import { composeMessage, notifySlack } from "@/lib/notify";
import { matchWindow, officeHours, officeName, verifySignatures } from "@/lib/config";
import { attachSnapshot } from "@/lib/snapshots";

export const runtime = "nodejs";

/**
 * Ring webhook receiver.
 * Contract: verify HMAC over the raw body, dedupe on meta.request_id, return 200
 * within 5 seconds. Anything slow (snapshot, Slack, Bedrock) runs after the ack.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  if (verifySignatures()) {
    const key = process.env.RING_WEBHOOK_SIGNING_KEY;
    if (!key) return NextResponse.json({ error: "signing key not configured" }, { status: 500 });
    if (!verifySignature(raw, req.headers.get("x-signature"), key)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  let parsed;
  try {
    parsed = RingWebhookSchema.parse(JSON.parse(raw));
  } catch (e) {
    return NextResponse.json({ error: "malformed payload", detail: String(e) }, { status: 400 });
  }

  const cal = await loadCalendar();
  const decision = decide(parsed, cal, { hours: officeHours(), window: matchWindow() });

  if (decision.lane === "ignored") {
    return NextResponse.json({ ok: true, lane: "ignored", reason: decision.reason });
  }

  const eventAt = new Date(parsed.data.attributes.timestamp ?? Date.now()).toISOString();
  const entry = {
    id: randomUUID(),
    requestId: parsed.meta.request_id,
    receivedAt: new Date().toISOString(),
    eventAt,
    deviceId: parsed.data.attributes.source,
    eventType: parsed.data.type,
    subType: parsed.data.attributes.sub_type,
    decision,
  };

  const fresh = await appendEntry(entry);
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  // Fire-and-forget: snapshot and notifications must not delay the 200.
  if (decision.lane !== "device") {
    void attachSnapshot(entry.id);
    void notifySlack(composeMessage(decision, officeName()))
      .then((sent) => {
        if (sent) return updateEntry(entry.id, { notified: [{ channel: "slack", at: new Date().toISOString() }] });
      })
      .catch((err) => console.error("slack notify failed", err));
  }

  return NextResponse.json({ ok: true, id: entry.id, lane: decision.lane, headline: decision.headline });
}

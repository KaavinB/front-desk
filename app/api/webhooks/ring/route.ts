import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { verifySignature } from "@/lib/ring/verify";
import { RingWebhookSchema } from "@/lib/ring/types";
import { loadCalendar } from "@/lib/calendar";
import { decide } from "@/lib/matcher";
import { appendEntry, updateEntry } from "@/lib/store";
import { composeNotice, notifySlack } from "@/lib/notify";
import { matchWindow, officeHours, officeName, verifySignatures } from "@/lib/config";
import { attachSnapshot } from "@/lib/snapshots";
import { greetVisitor } from "@/lib/ring/chime";

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

  // Snapshot, greeting and notifications run after the 200 is sent. `after` keeps
  // the serverless function alive until they finish instead of freezing it mid-task.
  if (decision.lane !== "device") {
    after(() => attachSnapshot(entry.id));
    // Greet expected visitors only: a courier or a stranger gets no "take a seat".
    if (decision.lane === "appointment") {
      after(() =>
        greetVisitor()
          .then((r) =>
            updateEntry(entry.id, {
              greeted: {
                played: r.played,
                detail: r.played ? `${r.clip} on ${r.chime}` : r.reason + (r.detail ? `: ${r.detail}` : ""),
                at: new Date().toISOString(),
              },
            }),
          )
          .catch((err) => console.error("greeting failed", err)),
      );
    }
    after(() =>
      composeNotice(decision, officeName())
        .then(async ({ text, writer }) => {
          await updateEntry(entry.id, { notice: { text, writer } });
          const sent = await notifySlack(text);
          if (sent) await updateEntry(entry.id, { notified: [{ channel: "slack", at: new Date().toISOString() }] });
        })
        .catch((err) => console.error("notify failed", err)),
    );
  }

  return NextResponse.json({ ok: true, id: entry.id, lane: decision.lane, headline: decision.headline });
}

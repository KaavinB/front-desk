/**
 * Fires HMAC-signed Ring webhook v1.1 payloads at the local receiver, the same way
 * Ring would. The Developers Playground does not deliver webhooks, so this is how
 * the demo exercises the real verify → decide → notify path.
 *
 *   npm run simulate                 # the "Tuesday at the office" scenario
 *   npm run simulate -- --speed 10   # faster
 *   npm run simulate -- --one button_press
 *   npm run simulate -- --one motion_detected --sub package_delivery
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { signBody } from "../lib/ring/verify";

const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/ring";
const key = process.env.RING_WEBHOOK_SIGNING_KEY ?? "dev-signing-key";
const device = process.env.SIM_DEVICE_ID ?? "ava1.ring.device.sim-doorbell-pro";

type Step = { offsetMin: number; type: string; sub?: string; label: string };

/** A Tuesday at a small therapy office. Times are offsets from 08:40 local. */
const tuesday: Step[] = [
  { offsetMin: 0, type: "motion_detected", sub: "vehicle", label: "car pulls in (ignored)" },
  { offsetMin: 12, type: "button_press", label: "Maria rings for her 9:00 (first visit)" },
  { offsetMin: 75, type: "motion_detected", sub: "package_delivery", label: "courier drops a package" },
  { offsetMin: 83, type: "button_press", label: "Tom rings for his 10:00" },
  { offsetMin: 170, type: "button_press", label: "someone rings at 11:30 — nothing booked" },
  { offsetMin: 318, type: "button_press", label: "1:58 — two people have a 2:00 (ambiguous)" },
  { offsetMin: 620, type: "button_press", label: "7:00 pm — after hours" },
];

function payload(type: string, sub: string | undefined, at: Date) {
  return {
    meta: {
      version: "1.1",
      time: new Date().toISOString(),
      request_id: randomUUID(),
      account_id: "sim-account",
    },
    data: {
      id: randomUUID(),
      type,
      attributes: {
        source: device,
        source_type: "devices",
        timestamp: at.getTime(),
        ...(sub ? { sub_type: sub } : {}),
      },
      relationships: { devices: { links: { self: `/v1/devices/${device}` } } },
    },
  };
}

async function send(type: string, sub: string | undefined, at: Date, label: string) {
  const body = JSON.stringify(payload(type, sub, at));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signBody(body, key) },
    body,
  });
  const json = await res.json().catch(() => ({}));
  const officeTime = at.toLocaleTimeString("en-US", { timeZone: process.env.OFFICE_TIMEZONE ?? "America/Los_Angeles" });
  console.log(`${officeTime}  ${label}\n   → ${res.status} ${JSON.stringify(json)}`);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const one = arg("one");
  if (one) {
    await send(one, arg("sub"), new Date(), `single ${one}`);
    return;
  }
  const speed = Number(arg("speed") ?? 50);
  // Anchor the scenario on the day the sample calendar uses.
  const base = new Date("2026-10-20T08:40:00-07:00");
  let prev = 0;
  for (const s of tuesday) {
    const waitMs = ((s.offsetMin - prev) * 60_000) / speed;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, Math.min(waitMs, 4000)));
    prev = s.offsetMin;
    await send(s.type, s.sub, new Date(base.getTime() + s.offsetMin * 60_000), s.label);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

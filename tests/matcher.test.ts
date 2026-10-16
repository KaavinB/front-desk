import { describe, expect, it } from "vitest";
import { decide } from "../lib/matcher";
import type { Calendar } from "../lib/calendar";
import type { RingWebhook } from "../lib/ring/types";

const hours = { open: "08:00", close: "18:00", timeZone: "America/Los_Angeles" };
const window = { earlyMin: 20, lateMin: 15 };

const cal: Calendar = {
  appointments: [
    { id: "a", visitor: "Maria Chen", host: "Dr. Lee", start: "2026-10-20T09:00:00-07:00", end: "2026-10-20T09:50:00-07:00" },
    { id: "b", visitor: "J. Lee", host: "Dr. Patel", start: "2026-10-20T14:00:00-07:00", end: "2026-10-20T14:50:00-07:00" },
    { id: "c", visitor: "Sam Rivera", host: "Dr. Lee", start: "2026-10-20T14:00:00-07:00", end: "2026-10-20T14:50:00-07:00" },
  ],
};

function evt(type: string, iso: string, sub?: string): RingWebhook {
  return {
    meta: { version: "1.1", time: iso, request_id: "r-" + iso },
    data: { id: "e", type, attributes: { source: "dev", timestamp: new Date(iso).getTime(), ...(sub ? { sub_type: sub } : {}) } },
  };
}

describe("decide", () => {
  it("matches a ring to the appointment in its window", () => {
    const d = decide(evt("button_press", "2026-10-20T08:52:00-07:00"), cal, { hours, window });
    expect(d.lane).toBe("appointment");
    expect(d.candidate?.id).toBe("a");
    expect(d.alternatives).toHaveLength(0);
    expect(d.headline).toBe("Your 9:00 AM, Maria Chen, rang the bell.");
  });

  it("shows ambiguity instead of guessing when two appointments share a slot", () => {
    const d = decide(evt("button_press", "2026-10-20T13:58:00-07:00"), cal, { hours, window });
    expect(d.lane).toBe("appointment");
    expect(d.alternatives).toHaveLength(1);
    expect(d.headline).toMatch(/\?/);
  });

  it("flags a ring with nothing on the calendar", () => {
    const d = decide(evt("button_press", "2026-10-20T11:30:00-07:00"), cal, { hours, window });
    expect(d.lane).toBe("unexpected");
  });

  it("routes package deliveries to the courier lane", () => {
    const d = decide(evt("motion_detected", "2026-10-20T09:55:00-07:00", "package_delivery"), cal, { hours, window });
    expect(d.lane).toBe("courier");
  });

  it("ignores vehicles and non-human motion", () => {
    expect(decide(evt("motion_detected", "2026-10-20T09:55:00-07:00", "vehicle"), cal, { hours, window }).lane).toBe("ignored");
    expect(decide(evt("motion_detected", "2026-10-20T09:55:00-07:00"), cal, { hours, window }).lane).toBe("ignored");
  });

  it("ignores human motion with no ring and no appointment", () => {
    expect(decide(evt("motion_detected", "2026-10-20T11:30:00-07:00", "human"), cal, { hours, window }).lane).toBe("ignored");
  });

  it("matches human motion (no ring) to an appointment window", () => {
    const d = decide(evt("motion_detected", "2026-10-20T08:55:00-07:00", "human"), cal, { hours, window });
    expect(d.lane).toBe("appointment");
    expect(d.headline).toContain("is at the door");
  });

  it("never pages anyone after hours", () => {
    const d = decide(evt("button_press", "2026-10-20T19:00:00-07:00"), cal, { hours, window });
    expect(d.lane).toBe("after_hours");
  });

  it("does not treat a ring 16 minutes late as the appointment", () => {
    const d = decide(evt("button_press", "2026-10-20T09:16:00-07:00"), cal, { hours, window });
    expect(d.lane).toBe("unexpected");
  });

  it("reports device offline/online in the device lane", () => {
    expect(decide(evt("device_offline", "2026-10-20T09:00:00-07:00"), cal, { hours, window }).lane).toBe("device");
  });
});

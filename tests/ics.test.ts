import { describe, expect, it } from "vitest";
import { parseIcs } from "../lib/ics";

const feed = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:a1",
  "DTSTART;TZID=America/Los_Angeles:20261020T090000",
  "DTEND;TZID=America/Los_Angeles:20261020T095000",
  "SUMMARY:Maria Chen",
  "DESCRIPTION:host: Dr. Lee\\nFirst visit\\, intake forms",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a2",
  "DTSTART:20261020T210000Z",
  "DTEND:20261020T215000Z",
  "SUMMARY:J. Lee",
  "ORGANIZER;CN=Dr. Patel:mailto:patel@example.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a3",
  "DTSTART;VALUE=DATE:20261021",
  "SUMMARY:Office closed",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  const appts = parseIcs(feed, { defaultTimeZone: "America/Los_Angeles" });

  it("reads TZID local times into UTC", () => {
    const a = appts.find((x) => x.id === "a1")!;
    expect(a.start).toBe("2026-10-20T16:00:00.000Z");
    expect(a.end).toBe("2026-10-20T16:50:00.000Z");
  });

  it("takes host from a 'host:' line and the rest as notes, unescaping commas", () => {
    const a = appts.find((x) => x.id === "a1")!;
    expect(a.visitor).toBe("Maria Chen");
    expect(a.host).toBe("Dr. Lee");
    expect(a.notes).toBe("First visit, intake forms");
  });

  it("falls back to ORGANIZER CN for the host and handles Z times", () => {
    const a = appts.find((x) => x.id === "a2")!;
    expect(a.host).toBe("Dr. Patel");
    expect(a.start).toBe("2026-10-20T21:00:00.000Z");
  });

  it("keeps all-day events with a default duration", () => {
    const a = appts.find((x) => x.id === "a3")!;
    expect(a.start).toBe("2026-10-21T07:00:00.000Z");
  });

  it("handles folded lines", () => {
    const folded = "BEGIN:VEVENT\r\nDTSTART:20261020T160000Z\r\nSUMMARY:Very long\r\n  name here\r\nEND:VEVENT";
    expect(parseIcs(folded, { defaultTimeZone: "UTC" })[0].visitor).toBe("Very long name here");
  });
});

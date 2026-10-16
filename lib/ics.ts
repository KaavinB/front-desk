import type { Appointment } from "./calendar";

/**
 * Minimal iCalendar (RFC 5545) reader: enough to turn a Google Calendar, Outlook,
 * Calendly, or practice-management ICS feed into appointments. Handles line folding,
 * DTSTART/DTEND in UTC, floating, or TZID form, and all-day dates. Recurring events
 * (RRULE) are not expanded; feeds from the big providers already expand them.
 *
 * Conventions for the office calendar:
 *   SUMMARY      → visitor name ("Maria Chen")
 *   DESCRIPTION  → optional "host: Dr. Lee" line; the rest becomes notes
 *   ORGANIZER CN → host, when DESCRIPTION has no host line
 */

type Props = Record<string, { value: string; params: Record<string, string> }[]>;

function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter(Boolean);
}

function parseProps(lines: string[]): Props {
  const props: Props = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const [name, ...paramParts] = line.slice(0, i).split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v] = p.split("=");
      if (k && v !== undefined) params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
    }
    const key = name.toUpperCase();
    (props[key] ??= []).push({ value: unescapeText(line.slice(i + 1)), params });
  }
  return props;
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Wall-clock parts of `d` in `timeZone`, as a UTC epoch (i.e. what the clock there reads). */
function wallClockUtc(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/** Interpret Y-M-D h:m:s as local time in `timeZone`, returning a UTC Date. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Two passes handle the DST edge where the first guess lands on the wrong side.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) guess = asUtc - (wallClockUtc(new Date(guess), timeZone) - guess);
  return new Date(guess);
}

export function parseIcsDate(value: string, params: Record<string, string>, defaultTz: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  const n = (x: string) => Number(x);
  if (z) return new Date(Date.UTC(n(y), n(mo) - 1, n(d), n(h), n(mi), n(s)));
  const tz = params.TZID ?? defaultTz;
  return zonedToUtc(n(y), n(mo), n(d), n(h), n(mi), n(s), tz);
}

export function parseIcs(text: string, opts: { defaultTimeZone: string; defaultHost?: string }): Appointment[] {
  const lines = unfold(text);
  const out: Appointment[] = [];
  let block: string[] | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      block = [];
      continue;
    }
    if (line === "END:VEVENT" && block) {
      const appt = toAppointment(parseProps(block), opts);
      if (appt) out.push(appt);
      block = null;
      continue;
    }
    block?.push(line);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function toAppointment(p: Props, opts: { defaultTimeZone: string; defaultHost?: string }): Appointment | null {
  const ds = p.DTSTART?.[0];
  if (!ds) return null;
  const start = parseIcsDate(ds.value, ds.params, opts.defaultTimeZone);
  if (!start) return null;
  const de = p.DTEND?.[0];
  const end = (de && parseIcsDate(de.value, de.params, opts.defaultTimeZone)) ?? new Date(start.getTime() + 50 * 60_000);

  const summary = p.SUMMARY?.[0]?.value?.trim() ?? "Visitor";
  const description = p.DESCRIPTION?.[0]?.value ?? "";
  const hostLine = description.split("\n").find((l) => /^host\s*:/i.test(l));
  const host =
    hostLine?.replace(/^host\s*:/i, "").trim() ||
    p.ORGANIZER?.[0]?.params.CN ||
    opts.defaultHost ||
    "Front desk";
  const notes = description
    .split("\n")
    .filter((l) => l.trim() && !/^host\s*:/i.test(l))
    .join(" ")
    .trim();

  return {
    id: p.UID?.[0]?.value ?? `${summary}-${start.toISOString()}`,
    visitor: summary,
    host,
    start: start.toISOString(),
    end: end.toISOString(),
    ...(notes ? { notes } : {}),
  };
}

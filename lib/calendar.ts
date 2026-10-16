import { promises as fs } from "node:fs";
import path from "node:path";
import { parseIcs } from "./ics";
import bundledCalendar from "../data/appointments.json";

/** One appointment on the office calendar. Times are ISO strings with offset. */
export type Appointment = {
  id: string;
  visitor: string;
  host: string;
  /** Slack user id or channel for the host, e.g. "@dr.lee" or "#front-desk". */
  hostContact?: string;
  start: string;
  end: string;
  notes?: string;
};

export type Calendar = { appointments: Appointment[] };

let icsCache: { url: string; at: number; value: Calendar } | null = null;
const ICS_TTL_MS = 60_000;

/**
 * The office calendar. With CALENDAR_ICS_URL set, it is the ICS feed every major
 * calendar publishes (Google Calendar "secret address", Outlook, Calendly,
 * practice-management tools), refreshed every minute. Otherwise CALENDAR_FILE
 * (default data/appointments.json), and if that file isn't on disk (serverless
 * deploys), the copy bundled into the build. A broken feed falls back to the
 * last good copy, then to the file, so a calendar outage never silences the door.
 */
export async function loadCalendar(): Promise<Calendar> {
  const url = process.env.CALENDAR_ICS_URL;
  if (url) {
    if (icsCache && icsCache.url === url && Date.now() - icsCache.at < ICS_TTL_MS) return icsCache.value;
    try {
      const value = await loadIcs(url);
      icsCache = { url, at: Date.now(), value };
      return value;
    } catch (e) {
      console.error("calendar feed failed:", e instanceof Error ? e.message : e);
      if (icsCache?.url === url) return icsCache.value;
    }
  }
  const file = process.env.CALENDAR_FILE ?? path.join("data", "appointments.json");
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Calendar;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return bundledCalendar as Calendar;
  }
}

async function loadIcs(source: string): Promise<Calendar> {
  const timeZone = process.env.OFFICE_TIMEZONE ?? "America/Los_Angeles";
  const text = /^https?:\/\//.test(source)
    ? await (async () => {
        const res = await fetch(source, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`ICS feed ${res.status}`);
        return res.text();
      })()
    : await fs.readFile(source, "utf8");
  return { appointments: parseIcs(text, { defaultTimeZone: timeZone }) };
}

export type MatchWindow = { earlyMin: number; lateMin: number };

/**
 * Appointments whose [start - early, start + late] window contains `at`.
 * Returns all candidates, nearest start first, so the caller can show ambiguity
 * instead of guessing.
 */
export function findCandidates(
  cal: Calendar,
  at: Date,
  win: MatchWindow,
): Appointment[] {
  const t = at.getTime();
  return cal.appointments
    .filter((a) => {
      const s = new Date(a.start).getTime();
      return t >= s - win.earlyMin * 60_000 && t <= s + win.lateMin * 60_000;
    })
    .sort(
      (a, b) =>
        Math.abs(new Date(a.start).getTime() - t) - Math.abs(new Date(b.start).getTime() - t),
    );
}

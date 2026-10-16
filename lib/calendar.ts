import { promises as fs } from "node:fs";
import path from "node:path";

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

/**
 * Loads appointments from data/appointments.json. This is the seam where a
 * Google Calendar / Calendly / practice-management sync plugs in later.
 */
export async function loadCalendar(dataDir = process.env.DATA_DIR ?? "./data"): Promise<Calendar> {
  const file = path.join(dataDir, "appointments.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as Calendar;
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

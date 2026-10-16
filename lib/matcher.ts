import type { Appointment, Calendar, MatchWindow } from "./calendar";
import { findCandidates } from "./calendar";
import type { RingWebhook } from "./ring/types";

export type Lane = "appointment" | "courier" | "unexpected" | "after_hours" | "device" | "ignored";

export type Decision = {
  lane: Lane;
  /** Best guess, if any. Never asserted as certain; the host confirms. */
  candidate?: Appointment;
  /** Other appointments in the same window, shown so nobody guesses wrong. */
  alternatives: Appointment[];
  /** One plain sentence for the host. Bedrock may rewrite it; this is the fallback. */
  headline: string;
  reason: string;
};

export type OfficeHours = { open: string; close: string; timeZone: string };

/** "HH:MM" in the office time zone for a Date. */
export function localHHMM(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function isOpen(d: Date, hours: OfficeHours): boolean {
  const now = localHHMM(d, hours.timeZone);
  return now >= hours.open && now < hours.close;
}

function clock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * Pure function: (event, calendar, now) -> decision. No I/O, so it's unit-testable
 * and the escalation policy is covered by tests rather than hope.
 */
export function decide(
  evt: RingWebhook,
  cal: Calendar,
  opts: { hours: OfficeHours; window: MatchWindow; now?: Date },
): Decision {
  const at = new Date(evt.data.attributes.timestamp ?? opts.now?.getTime() ?? Date.now());
  const type = evt.data.type;
  const sub = evt.data.attributes.sub_type;
  const tz = opts.hours.timeZone;

  if (type === "device_online" || type === "device_offline") {
    return {
      lane: "device",
      alternatives: [],
      headline: type === "device_offline" ? "The front door camera went offline." : "The front door camera is back online.",
      reason: type,
    };
  }

  if (type === "motion_detected" && sub === "package_delivery") {
    return {
      lane: "courier",
      alternatives: [],
      headline: `A package was left at the front door at ${clock(at, tz)}.`,
      reason: "motion_detected.package_delivery",
    };
  }

  // Vehicles and non-human motion are context, not visitors.
  if (type === "motion_detected" && sub !== "human") {
    return { lane: "ignored", alternatives: [], headline: "", reason: `motion_detected.${sub ?? "motion"}` };
  }

  const isRing = type === "button_press";
  const verb = isRing ? "rang the bell" : "is at the door";

  if (!isOpen(at, opts.hours)) {
    return {
      lane: "after_hours",
      alternatives: [],
      headline: `Someone ${verb} after hours at ${clock(at, tz)}.`,
      reason: `${type} outside ${opts.hours.open}-${opts.hours.close}`,
    };
  }

  const candidates = findCandidates(cal, at, opts.window);
  if (candidates.length === 0) {
    // Human motion with no ring and no appointment is just foot traffic.
    if (!isRing) {
      return { lane: "ignored", alternatives: [], headline: "", reason: "human motion, no ring, no appointment" };
    }
    return {
      lane: "unexpected",
      alternatives: [],
      headline: `Someone rang the bell at ${clock(at, tz)}. Nothing is on the calendar.`,
      reason: "button_press with no appointment in window",
    };
  }

  const [best, ...rest] = candidates;
  const when = clock(new Date(best.start), tz);
  const headline =
    rest.length === 0
      ? `Your ${when}, ${best.visitor}, ${verb}.`
      : `Someone ${verb} for the ${when} slot. ${best.visitor}? (${rest.map((a) => a.visitor).join(", ")} also booked.)`;

  return {
    lane: "appointment",
    candidate: best,
    alternatives: rest,
    headline,
    reason: `${type} within window of ${candidates.length} appointment(s)`,
  };
}

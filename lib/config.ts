import type { OfficeHours } from "./matcher";
import type { MatchWindow } from "./calendar";

export function officeHours(): OfficeHours {
  return {
    open: process.env.OFFICE_OPEN ?? "08:00",
    close: process.env.OFFICE_CLOSE ?? "18:00",
    timeZone: process.env.OFFICE_TIMEZONE ?? "America/Los_Angeles",
  };
}

export function matchWindow(): MatchWindow {
  return {
    earlyMin: Number(process.env.MATCH_EARLY_MIN ?? 20),
    lateMin: Number(process.env.MATCH_LATE_MIN ?? 15),
  };
}

export function officeName(): string {
  return process.env.OFFICE_NAME ?? "Front Desk";
}

export function verifySignatures(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.RING_VERIFY_SIGNATURES !== "false";
}

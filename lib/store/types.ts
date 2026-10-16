import type { Decision } from "../matcher";

/** A visitor-log entry. One per Ring event that reached a lane. */
export type LogEntry = {
  id: string;
  requestId: string;
  receivedAt: string;
  eventAt: string;
  deviceId?: string;
  eventType: string;
  subType?: string;
  decision: Decision;
  /** Host feedback: confirmed the guess, picked another appointment, or said "not them". */
  confirmation?: { appointmentId: string | null; by: string; at: string };
  snapshotPath?: string;
  /** The sentence the host received, and who wrote it. */
  notice?: { text: string; writer: "bedrock" | "template" };
  notified?: { channel: string; at: string }[];
  /** Whether the chime greeting played for this visit. */
  greeted?: { played: boolean; detail: string; at: string };
};

/** The four operations every backend provides. */
export interface Store {
  listEntries(): Promise<LogEntry[]>;
  hasRequestId(requestId: string): Promise<boolean>;
  /** Returns false (and stores nothing) when requestId was already seen. */
  appendEntry(entry: LogEntry): Promise<boolean>;
  updateEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry | null>;
  clearEntries(): Promise<void>;
}

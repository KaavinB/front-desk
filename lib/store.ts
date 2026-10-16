import { promises as fs } from "node:fs";
import path from "node:path";
import type { Decision } from "./matcher";

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
};

/**
 * JSON-file store. Good enough for the demo; swap for DynamoDB behind the same
 * four functions when deploying (AWS Builder mini-challenge).
 */
const dataDir = () => process.env.DATA_DIR ?? "./data";
const file = () => path.join(dataDir(), "events.json");

let writing: Promise<void> = Promise.resolve();

async function readAll(): Promise<LogEntry[]> {
  try {
    return JSON.parse(await fs.readFile(file(), "utf8")) as LogEntry[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(entries: LogEntry[]): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${file()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2));
  await fs.rename(tmp, file());
}

/** Serialize writes so concurrent webhooks don't clobber each other. */
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const p = writing.then(fn, fn);
  writing = p.then(() => undefined, () => undefined);
  return p;
}

export async function listEntries(): Promise<LogEntry[]> {
  const all = await readAll();
  return all.sort((a, b) => b.eventAt.localeCompare(a.eventAt));
}

export async function hasRequestId(requestId: string): Promise<boolean> {
  return (await readAll()).some((e) => e.requestId === requestId);
}

export async function appendEntry(entry: LogEntry): Promise<boolean> {
  return serialized(async () => {
    const all = await readAll();
    if (all.some((e) => e.requestId === entry.requestId)) return false;
    all.push(entry);
    await writeAll(all);
    return true;
  });
}

export async function updateEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry | null> {
  return serialized(async () => {
    const all = await readAll();
    const i = all.findIndex((e) => e.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch };
    await writeAll(all);
    return all[i];
  });
}

export async function clearEntries(): Promise<void> {
  return serialized(() => writeAll([]));
}

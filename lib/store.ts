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
const lockDir = () => `${file()}.lock`;

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
  const tmp = `${file()}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2));
  await fs.rename(tmp, file());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOCK_STALE_MS = 5000;

/**
 * Cross-instance lock via an atomic mkdir. The Next dev server loads this module
 * once per route bundle, so an in-process mutex alone is not enough: two route
 * handlers can read-modify-write the same file at once and lose entries.
 */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(dataDir(), { recursive: true });
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      await fs.mkdir(lockDir());
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const age = Date.now() - (await fs.stat(lockDir()).then((s) => s.mtimeMs, () => Date.now()));
      if (age > LOCK_STALE_MS) await fs.rmdir(lockDir()).catch(() => undefined);
      if (Date.now() > deadline) throw new Error("store lock timeout");
      await sleep(15 + Math.random() * 30);
    }
  }
  try {
    return await fn();
  } finally {
    await fs.rmdir(lockDir()).catch(() => undefined);
  }
}

/** Serialize writes in-process, then across module instances/processes. */
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => withLock(fn);
  const p = writing.then(run, run);
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

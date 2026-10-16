import { promises as fs } from "node:fs";
import path from "node:path";
import type { LogEntry, Store } from "./types";

/**
 * JSON-file backend for local development and the demo. Writes are serialized
 * in-process and across module instances (the Next dev server loads this module
 * once per route bundle) with an atomic mkdir lock.
 */
export function fileStore(dataDir = process.env.DATA_DIR ?? "./data"): Store {
  const file = path.join(dataDir, "events.json");
  const lockDir = `${file}.lock`;
  let writing: Promise<void> = Promise.resolve();

  async function readAll(): Promise<LogEntry[]> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as LogEntry[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async function writeAll(entries: LogEntry[]): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(entries, null, 2));
    await fs.rename(tmp, file);
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const LOCK_STALE_MS = 5000;

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    await fs.mkdir(dataDir, { recursive: true });
    const deadline = Date.now() + 10_000;
    for (;;) {
      try {
        await fs.mkdir(lockDir);
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        const age = Date.now() - (await fs.stat(lockDir).then((s) => s.mtimeMs, () => Date.now()));
        if (age > LOCK_STALE_MS) await fs.rmdir(lockDir).catch(() => undefined);
        if (Date.now() > deadline) throw new Error("store lock timeout");
        await sleep(15 + Math.random() * 30);
      }
    }
    try {
      return await fn();
    } finally {
      await fs.rmdir(lockDir).catch(() => undefined);
    }
  }

  function serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = () => withLock(fn);
    const p = writing.then(run, run);
    writing = p.then(() => undefined, () => undefined);
    return p;
  }

  return {
    async listEntries() {
      return (await readAll()).sort((a, b) => b.eventAt.localeCompare(a.eventAt));
    },
    async hasRequestId(requestId) {
      return (await readAll()).some((e) => e.requestId === requestId);
    },
    appendEntry(entry) {
      return serialized(async () => {
        const all = await readAll();
        if (all.some((e) => e.requestId === entry.requestId)) return false;
        all.push(entry);
        await writeAll(all);
        return true;
      });
    },
    updateEntry(id, patch) {
      return serialized(async () => {
        const all = await readAll();
        const i = all.findIndex((e) => e.id === id);
        if (i < 0) return null;
        all[i] = { ...all[i], ...patch };
        await writeAll(all);
        return all[i];
      });
    },
    clearEntries() {
      return serialized(() => writeAll([]));
    },
  };
}

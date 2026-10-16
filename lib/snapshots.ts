import { promises as fs } from "node:fs";
import path from "node:path";
import { downloadSnapshot, RingApiError, startWhepSession, stopWhepSession } from "./ring/client";
import { liveDeviceId } from "./ring/status";
import { updateEntry } from "./store";

const dir = () => path.join(process.env.DATA_DIR ?? "./data", "snapshots");

export function snapshotFile(entryId: string): string {
  return path.join(dir(), `${entryId}.jpg`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isNoMedia = (e: unknown) => e instanceof RingApiError && e.status === 416;

/**
 * A frame from right now. Snapshots only exist where the device recorded media
 * (416 MEDIA_NOT_FOUND otherwise). A real doorbell records on every ring; the
 * Playground device records only around a live view, and media shows up some
 * seconds after the session opens. So on 416 we open a WHEP session, poll for
 * the frame for up to ~45 s, and close the session.
 */
async function frameNow(deviceId: string): Promise<Buffer> {
  try {
    return await downloadSnapshot(deviceId, Date.now());
  } catch (e) {
    if (!isNoMedia(e)) throw e;
  }
  const { sessionUrl } = await startWhepSession(deviceId);
  try {
    for (let attempt = 0; attempt < 15; attempt++) {
      await sleep(3000);
      try {
        return await downloadSnapshot(deviceId, Date.now());
      } catch (e) {
        if (!isNoMedia(e)) throw e;
      }
    }
    throw new Error("no media from the device within 45 s of opening a live view");
  } finally {
    if (sessionUrl) void stopWhepSession(sessionUrl);
  }
}

// One snapshot at a time: a burst of rings must not open a pile of live-view sessions.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Pull a frame from the live Ring API for a visitor-log entry and record it.
 * Runs after the webhook has been acknowledged; failures are logged, never thrown.
 * One frame per visit, nothing continuous.
 */
export function attachSnapshot(entryId: string): Promise<boolean> {
  const run = () => attachSnapshotNow(entryId);
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

async function attachSnapshotNow(entryId: string): Promise<boolean> {
  try {
    const deviceId = await liveDeviceId();
    if (!deviceId) return false;
    const jpeg = await frameNow(deviceId);
    await fs.mkdir(dir(), { recursive: true });
    await fs.writeFile(snapshotFile(entryId), jpeg);
    await updateEntry(entryId, { snapshotPath: `/api/snapshots/${entryId}` });
    return true;
  } catch (e) {
    console.error(`snapshot for ${entryId} failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

import { getDeviceStatus, listDevices, RingApiError } from "./client";

export type CameraStatus =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | { configured: true; ok: true; deviceId: string; name: string; online: boolean; reportedAt?: string };

let cache: { at: number; value: CameraStatus } | null = null;
const TTL_MS = 20_000;

/** First camera on the linked account, with its online state. Cached briefly; never throws. */
export async function cameraStatus(): Promise<CameraStatus> {
  if (!process.env.RING_ACCESS_TOKEN) return { configured: false };
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let value: CameraStatus;
  try {
    const [device] = await listDevices();
    if (!device) {
      value = { configured: true, ok: false, error: "no devices on this account" };
    } else {
      const status = (await getDeviceStatus(device.id)) as {
        data?: { attributes?: { online?: boolean; reported_at?: string } };
      };
      value = {
        configured: true,
        ok: true,
        deviceId: device.id,
        name: device.attributes.name ?? "Ring device",
        online: status.data?.attributes?.online ?? false,
        reportedAt: status.data?.attributes?.reported_at,
      };
    }
  } catch (e) {
    const msg =
      e instanceof RingApiError && e.status === 401
        ? "token expired — generate a new one in the Playground"
        : e instanceof Error
          ? e.message
          : String(e);
    value = { configured: true, ok: false, error: msg };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** The real device to pull snapshots from, if the API is reachable. */
export async function liveDeviceId(): Promise<string | null> {
  const s = await cameraStatus();
  return s.configured && s.ok ? s.deviceId : null;
}

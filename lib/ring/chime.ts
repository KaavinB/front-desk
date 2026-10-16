import {
  getDeviceCapabilities,
  getDeviceConfigurations,
  listDevices,
  playChimeAudio,
  type ChimeSlot,
} from "./client";

/**
 * The greeting: when an expected visitor rings, the office's Ring Chime plays a
 * short "welcome, someone will be right with you" clip so the visitor stops
 * re-ringing and staff aren't interrupted twice.
 *
 * Ring exposes chimes as ordinary devices; the tell is a capabilities block with
 * `audio.customizable_slots > 0`. The clip itself lives in one of the chime's
 * "Ring Appstore" audio slots (configurations → audio.customizable_slots), which
 * the customer fills in the Ring app. We only play; the API has no way to upload
 * or change audio, and that's the right boundary for a third-party app.
 *
 * Playground note: the virtual Doorbell Pro has no audio slots and the sandbox has
 * no chime, so on the Playground this resolves to "no chime" and is skipped.
 */

export type ChimeTarget = { deviceId: string; name: string; slot: ChimeSlot };

let cache: { at: number; value: ChimeTarget | null } | null = null;
const TTL_MS = 5 * 60_000;

export async function findChime(): Promise<ChimeTarget | null> {
  if (!process.env.RING_ACCESS_TOKEN) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let value: ChimeTarget | null = null;
  try {
    const devices = await listDevices();
    const preferred = process.env.CHIME_DEVICE_ID;
    const ordered = preferred ? devices.sort((a) => (a.id === preferred ? -1 : 1)) : devices;
    for (const d of ordered) {
      const caps = await getDeviceCapabilities(d.id);
      if (!(caps.data?.attributes?.audio?.customizable_slots ?? 0)) continue;
      const cfg = await getDeviceConfigurations(d.id);
      const slots = (cfg.data?.attributes?.audio?.customizable_slots ?? []).filter((s) => !s.disabled);
      const wanted = process.env.CHIME_GREETING_EVENT;
      const slot = (wanted && slots.find((s) => s.event === wanted)) || slots[0];
      if (slot) {
        value = { deviceId: d.id, name: d.attributes.name ?? "Ring Chime", slot };
        break;
      }
    }
  } catch (e) {
    console.error("chime discovery failed:", e instanceof Error ? e.message : e);
  }
  cache = { at: Date.now(), value };
  return value;
}

export type GreetResult =
  | { played: true; chime: string; clip: string }
  | { played: false; reason: "no_chime" | "disabled" | "error"; detail?: string };

/** Play the greeting. Never throws; the webhook has already been acknowledged. */
export async function greetVisitor(): Promise<GreetResult> {
  if (process.env.CHIME_GREETING !== "true") return { played: false, reason: "disabled" };
  const chime = await findChime();
  if (!chime) return { played: false, reason: "no_chime" };
  try {
    const status = await playChimeAudio(chime.deviceId, chime.slot.audio_ref);
    if (status !== "completed") return { played: false, reason: "error", detail: `status ${status}` };
    return { played: true, chime: chime.name, clip: chime.slot.audio_name ?? chime.slot.event };
  } catch (e) {
    return { played: false, reason: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

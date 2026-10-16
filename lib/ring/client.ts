/**
 * Thin client for the Ring Partner API (https://api.amazonvision.com).
 * Only the calls Front Desk needs. Works with a Developers Playground token.
 */
const BASE = "https://api.amazonvision.com";

export class RingApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public retryAfter?: number,
  ) {
    super(`Ring API ${status}: ${body.slice(0, 200)}`);
  }
}

function token(): string {
  const t = process.env.RING_ACCESS_TOKEN;
  if (!t) throw new Error("RING_ACCESS_TOKEN is not set");
  return t;
}

const TIMEOUT_MS = 15_000;

async function ringFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const redirectExpected = init.redirect === "manual" && res.status >= 300 && res.status < 400;
  if (!res.ok && !redirectExpected) {
    const retry = res.headers.get("Retry-After");
    throw new RingApiError(res.status, await res.text(), retry ? Number(retry) : undefined);
  }
  return res;
}

export type RingDevice = {
  id: string;
  type: string;
  attributes: Record<string, unknown> & { name?: string; kind?: string };
};

export async function listDevices(): Promise<RingDevice[]> {
  const res = await ringFetch("/v1/devices?include=status");
  const json = (await res.json()) as { data: RingDevice[] };
  return json.data;
}

export async function getDeviceStatus(deviceId: string): Promise<Record<string, unknown>> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/status`);
  return (await res.json()) as Record<string, unknown>;
}

export type HistoryEvent = {
  type: "history-events";
  id: string;
  attributes: {
    event_type: "motion" | "ding" | "on_demand" | (string & {});
    is_third_party_reviewed: boolean;
    start: number;
    end: number;
  };
};

/**
 * Event History is newest-first and cursor-paginated via links.next.
 * Only events after the user granted consent to the app are returned.
 */
export async function getEventHistory(
  deviceId: string,
  opts: { eventTypes?: string[]; maxPages?: number } = {},
): Promise<HistoryEvent[]> {
  const out: HistoryEvent[] = [];
  const params = new URLSearchParams();
  if (opts.eventTypes?.length) params.set("event_types", opts.eventTypes.join(","));
  let next: string | undefined =
    `/v1/history/devices/${encodeURIComponent(deviceId)}/events` +
    (params.size ? `?${params}` : "");
  let pages = 0;
  while (next && pages < (opts.maxPages ?? 5)) {
    const res = await ringFetch(next);
    const json = (await res.json()) as { data: HistoryEvent[]; links?: { next?: string } };
    out.push(...json.data);
    next = json.links?.next;
    pages++;
  }
  return out;
}

/**
 * Snapshot (JPEG) from the device at a moment in time.
 * Body must be `{ type: "at_timestamp", timestamp: <epoch ms> }`; the API answers 303 to a
 * pre-signed URL (valid 15 min), which fetch follows. Timestamps before the app was
 * authorized are rejected with "not within authorized boundaries". Works on the Playground.
 */
export async function downloadSnapshot(deviceId: string, atMs = Date.now()): Promise<Buffer> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "at_timestamp", timestamp: atMs }),
    redirect: "manual",
  });
  // The pre-signed URL carries its own auth; fetch it bare, without the bearer token.
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    const file = await fetch(location, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!file.ok) throw new RingApiError(file.status, await file.text());
    return Buffer.from(await file.arrayBuffer());
  }
  if (res.status >= 300) throw new RingApiError(res.status, await res.text());
  return Buffer.from(await res.arrayBuffer());
}

/** A minimal recvonly H.264 offer. Enough to open a session so the device produces media. */
const PROBE_SDP_OFFER = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=msid-semantic: WMS",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "c=IN IP4 0.0.0.0",
  "a=rtcp:9 IN IP4 0.0.0.0",
  "a=ice-ufrag:frnt",
  "a=ice-pwd:frontdeskfrontdeskfrontdesk",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF",
  "a=setup:actpass",
  "a=mid:0",
  "a=recvonly",
  "a=rtcp-mux",
  "a=rtpmap:96 H264/90000",
  "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
  "",
].join("\r\n");

/**
 * Open a WHEP live-view session. Returns the session URL (from the Location header)
 * and the SDP answer. A browser would feed the answer to an RTCPeerConnection; the
 * server uses this only to make the device produce media for a snapshot.
 */
export async function startWhepSession(
  deviceId: string,
  sdpOffer: string = PROBE_SDP_OFFER,
): Promise<{ sessionUrl: string | null; answer: string }> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/media/streaming/whep/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
    body: sdpOffer,
  });
  return { sessionUrl: res.headers.get("location"), answer: await res.text() };
}

export async function stopWhepSession(sessionUrl: string): Promise<void> {
  const path = sessionUrl.startsWith(BASE) ? sessionUrl.slice(BASE.length) : sessionUrl;
  await ringFetch(path, { method: "DELETE" }).catch(() => undefined);
}

export type DeviceCapabilities = {
  data?: { attributes?: { audio?: { customizable_slots?: number | null } | null } };
};

export async function getDeviceCapabilities(deviceId: string): Promise<DeviceCapabilities> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/capabilities`);
  return (await res.json()) as DeviceCapabilities;
}

export type ChimeSlot = {
  event: string;
  disabled: boolean;
  audio_ref: string;
  audio_url?: string;
  audio_name?: string;
};

export type DeviceConfigurations = {
  data?: { attributes?: { audio?: { customizable_slots?: ChimeSlot[] | null; volume?: number } | null } };
};

export async function getDeviceConfigurations(deviceId: string): Promise<DeviceConfigurations> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/configurations`);
  return (await res.json()) as DeviceConfigurations;
}

/**
 * Play one of a Ring Chime's audio slots. Requires the Chime Controls capability.
 * `audioRef` comes from configurations → audio.customizable_slots[].audio_ref.
 * The call is synchronous: a 200 with status "completed" means the chime played it.
 */
export async function playChimeAudio(chimeId: string, audioRef: string): Promise<"completed" | string> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(chimeId)}/media/audio/playback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { type: "audio", attributes: { audio_ref: audioRef } } }),
  });
  const json = (await res.json()) as { data?: { attributes?: { status?: string } } };
  return json.data?.attributes?.status ?? "unknown";
}

/**
 * Records the Front Desk demo video, narrated, as one MP4.
 *
 *   npm run dev                  # in another terminal (port 3001)
 *   npm run video                # → video/out/front-desk-demo.mp4
 *
 * How it works: each scene has a narration line (macOS `say`) and an action
 * (show a slide, ring the doorbell through the signed simulator, click a
 * button). Playwright records the browser; every narration clip is placed at
 * the moment its scene started, then ffmpeg muxes picture and voice.
 *
 * Env: BASE (default http://localhost:3001), VOICE (default Samantha),
 * RATE (words per minute, default 172), HEADLESS=false to watch it run.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { signBody } from "../lib/ring/verify";
import { listDevices, startWhepSession, stopWhepSession } from "../lib/ring/client";
import { slides } from "./slides";

const BASE = process.env.BASE ?? "http://localhost:3001";
const VOICE = process.env.VOICE ?? "Samantha";
const RATE = process.env.RATE ?? "172";
const KEY = process.env.RING_WEBHOOK_SIGNING_KEY ?? "dev-signing-key";
const OUT = path.resolve("video/out");
const W = 1920;
const H = 1080;
const ZOOM = 1.4; // dashboard is laid out for ~1370px; zoom keeps text crisp at 1080p

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- narration ---------------- */

type Scene = {
  id: string;
  /** What's on screen during this line (for the recording script). */
  screen: string;
  say: string;
  /** Runs when the scene starts, while the narration plays. */
  act: (page: Page, dur: number) => Promise<void>;
  /** Extra hold after the narration ends, seconds. */
  hold?: number;
};

const MY_VOICE = path.resolve("video/voice");
const AUDIO_EXT = [".m4a", ".wav", ".mp3", ".aiff", ".caf", ".aac"];

const probe = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

/**
 * Your own recording of a line wins: drop `video/voice/<scene id>.m4a` (or .wav,
 * .mp3…) and the scene is timed to it. It's cleaned up first: leading/trailing
 * silence trimmed, rumble filtered, loudness evened out. Lines without a
 * recording fall back to the macOS voice.
 */
function synth(id: string, text: string): { file: string; dur: number; mine: boolean } {
  const own = AUDIO_EXT.map((e) => path.join(MY_VOICE, `${id}${e}`)).find(existsSync);
  const file = path.join(OUT, "voice", `${id}.wav`);
  if (own) {
    const trim = "silenceremove=start_periods=1:start_silence=0.08:start_threshold=-42dB";
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", own,
      "-af", `${trim},areverse,${trim},areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11`,
      "-ar", "48000", "-ac", "1", file,
    ]);
    return { file, dur: probe(file), mine: true };
  }
  const aiff = path.join(OUT, "voice", `${id}.aiff`);
  execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, text]);
  return { file: aiff, dur: probe(aiff), mine: false };
}

const tc = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};
const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/* ---------------- doorbell ---------------- */

const day = "2026-10-20";
const at = (hhmm: string) => new Date(`${day}T${hhmm}:00-07:00`).getTime();
const device = process.env.SIM_DEVICE_ID ?? "ava1.ring.device.sim-doorbell-pro";

async function ring(type: string, ts: number, sub?: string) {
  const body = JSON.stringify({
    meta: { version: "1.1", time: new Date().toISOString(), request_id: randomUUID(), account_id: "sim-account" },
    data: {
      id: randomUUID(),
      type,
      attributes: { source: device, source_type: "devices", timestamp: ts, ...(sub ? { sub_type: sub } : {}) },
      relationships: { devices: { links: { self: `/v1/devices/${device}` } } },
    },
  });
  const res = await fetch(`${BASE}/api/webhooks/ring`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signBody(body, KEY) },
    body,
  });
  if (!res.ok) throw new Error(`ring ${type} → ${res.status} ${await res.text()}`);
}

/* ---------------- page helpers ---------------- */

async function showSlide(page: Page, url: string) {
  await page.goto(url);
}

async function showDashboard(page: Page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `html { zoom: ${ZOOM}; } nextjs-portal { display: none !important; }`,
  });
  await page.waitForSelector(".pill");
}

/** Wait until a card whose headline contains `text` is on screen. */
async function waitForCard(page: Page, text: string) {
  await page.locator(".headline", { hasText: text }).first().waitFor({ timeout: 15_000 });
}

/* ---------------- the script ---------------- */

const scenes: Scene[] = [
  {
    id: "01-title",
    screen: "Title slide: “Every small office has a doorbell.”",
    say: "Every small office has a doorbell. Almost none of them has a receptionist.",
    act: (p) => showSlide(p, slides.title),
    hold: 0.6,
  },
  {
    id: "02-problem",
    screen: "Problem slide: three numbered pains and the kiosk price",
    say:
      "Therapists, dentists, law firms. A locked front door, and nobody watching it. Clients wait outside, couriers give up, " +
      "and staff get pulled out of sessions to check a camera. The kiosk systems built for this cost hundreds of dollars a month, " +
      "and need a lobby and an iPad.",
    act: (p) => showSlide(p, slides.problem),
    hold: 0.4,
  },
  {
    id: "03-intro",
    screen: "The dashboard appears, empty, with the live Ring status in the top right",
    say:
      "Front Desk turns the Ring doorbell an office already has into its receptionist. It reads today's appointment calendar, " +
      "and when the bell rings, it tells the right person who is there.",
    act: (p) => showDashboard(p),
  },
  {
    id: "04-maria",
    screen: "Maria Chen's card appears at the top",
    say:
      "Nine o'clock. Maria rings. Front Desk matches her booking, pulls a frame from the door through the Ring API, " +
      "and tells Doctor Lee in Slack: your nine o'clock, Maria Chen, rang the bell.",
    act: async (p) => {
      await ring("motion_detected", at("08:40"), "vehicle"); // a car pulls in: ignored
      await ring("button_press", at("08:52"));
      await waitForCard(p, "Maria Chen");
    },
    hold: 0.6,
  },
  {
    id: "05-courier",
    screen: "A Delivery card appears",
    say: "A package is dropped off. Ring tags it as a delivery, so it's logged, and nobody is interrupted.",
    act: async (p) => {
      await ring("motion_detected", at("09:55"), "package_delivery");
      await waitForCard(p, "package");
    },
  },
  {
    id: "06-tom",
    screen: "Tom Okafor's card appears",
    say: "Ten o'clock. Tom. Same thing.",
    act: async (p) => {
      await ring("button_press", at("10:03"));
      await waitForCard(p, "Tom Okafor");
    },
    hold: 0.8,
  },
  {
    id: "07-unexpected",
    screen: "A red-outlined “Not on the calendar” card appears",
    say:
      "Eleven thirty. Someone rings, and nothing is on the calendar. That one is flagged, with the frame, " +
      "so staff can decide before they open the door.",
    act: async (p) => {
      await ring("button_press", at("11:30"));
      await waitForCard(p, "Nothing is on the calendar");
    },
    hold: 0.4,
  },
  {
    id: "08-double",
    screen: "The 2:00 double-booking card appears; about 5 s later “It's J. Lee” is clicked",
    say:
      "Two o'clock is double booked. Front Desk doesn't pretend to know who it is. It shows both names, " +
      "and the host confirms with one tap. That keeps the visitor log honest, and it means no facial recognition, which Ring prohibits.",
    act: async (p, dur) => {
      await ring("button_press", at("13:58"));
      await waitForCard(p, "2:00 PM slot");
      await sleep(Math.max(2500, dur * 0.42 * 1000)); // around "the host confirms with one tap"
      const btn = p.getByRole("button", { name: "It's J. Lee" });
      await btn.hover();
      await sleep(500);
      await btn.click();
    },
    hold: 0.6,
  },
  {
    id: "09-after",
    screen: "A purple After hours card appears",
    say: "And a ring at seven in the evening is logged quietly. Nobody is woken up.",
    act: async (p) => {
      await ring("button_press", at("19:00"));
      await waitForCard(p, "after hours");
    },
    hold: 0.6,
  },
  {
    id: "10-sidebar",
    screen: "Hold on the dashboard; the sidebar shows who has arrived",
    say:
      "On the right, today's appointments update as people arrive, and the latest frame from the front door is always one glance away.",
    act: async (p) => {
      await p.locator(".side").hover();
    },
    hold: 0.8,
  },
  {
    id: "11-arch",
    screen: "How-it-works slide: four boxes",
    say:
      "Under the hood, Ring sends a signed webhook. We verify the signature, drop duplicates, and reply in milliseconds. " +
      "A small, unit tested matcher checks the calendar. No AI model ever decides who is at the door. " +
      "The visitor log lives in Amazon DynamoDB, with conditional writes, so a re-delivered webhook can never create a second card.",
    act: (p) => showSlide(p, slides.architecture),
    hold: 0.6,
  },
  {
    id: "12-honest",
    screen: "“What's live, and what's simulated” slide",
    say:
      "One honest note. Ring's developer Playground gives us a real virtual doorbell for the API, but no way to press it. " +
      "So the rings in this demo come from our own simulator, signed exactly like Ring's webhooks, and sent to the same endpoint. " +
      "The device status and every door frame you saw came from the live Ring Partner API.",
    act: (p) => showSlide(p, slides.honest),
    hold: 0.6,
  },
  {
    id: "13-close",
    screen: "Closing slide with the live URL and repo",
    say: "Front Desk. Your Ring doorbell already knows your two o'clock is here. Now it can say so.",
    act: (p) => showSlide(p, slides.close),
    hold: 2.5,
  },
];

/* ---------------- run ---------------- */

/** The recording script: one line per clip, with what's on screen. */
async function writeScript() {
  const parts = [
    "# Front Desk demo: narration script",
    "",
    "Record each line as its own clip and save it in `video/voice/` with the file name shown",
    "(`.m4a` from QuickTime or Voice Memos is fine; `.wav` and `.mp3` work too). Then run",
    "`npm run video`. The video is re-timed to your clips, so speak naturally: pauses and pace are yours.",
    "",
    "Tips: quiet room, laptop mic about a forearm's length away, one or two takes per line,",
    "a beat of silence before and after is fine (it's trimmed). Any line you skip uses the computer voice.",
    "Rephrase freely, but keep the facts.",
    "",
  ];
  scenes.forEach((s, i) => {
    parts.push(`## ${i + 1}. \`${s.id}.m4a\``, "", `*On screen:* ${s.screen}`, "", `> ${s.say}`, "");
  });
  await writeFile(path.resolve("video/NARRATION.md"), parts.join("\n"));
}

async function main() {
  if (process.argv.includes("--script")) {
    await writeScript();
    console.log("Wrote video/NARRATION.md");
    return;
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(path.join(OUT, "voice"), { recursive: true });
  mkdirSync(path.join(OUT, "raw"), { recursive: true });
  mkdirSync(MY_VOICE, { recursive: true });

  const voice = scenes.map((s) => ({ ...s, ...synth(s.id, s.say) }));
  const mine = voice.filter((v) => v.mine).length;
  const spoken = voice.reduce((a, s) => a + s.dur + (s.hold ?? 0.3), 0);
  console.log(
    `Narration: ${mine} of ${voice.length} lines in your voice` +
      (mine < voice.length ? `, ${voice.length - mine} by ${VOICE}` : "") +
      ` · ~${spoken.toFixed(0)} s`,
  );
  if (spoken > 175) console.warn(`  ⚠ ${spoken.toFixed(0)} s is close to the 3:00 limit; tighten a few lines.`);

  console.log("Warming up the app…");
  for (const p of ["/", "/api/events", "/api/calendar", "/api/ring/status"]) await fetch(`${BASE}${p}`);
  await ring("button_press", at("12:00")); // compiles the webhook route
  await sleep(1500);
  const reset = await fetch(`${BASE}/api/events`, { method: "DELETE" });
  if (!reset.ok) throw new Error(`could not clear the visitor log (${reset.status}); run against the local dev server`);

  // Keep a live view open so every ring's snapshot is ready immediately.
  let whep: string | null = null;
  if (process.env.RING_ACCESS_TOKEN) {
    try {
      const [dev] = await listDevices();
      whep = (await startWhepSession(dev.id)).sessionUrl;
      console.log("Live view open on", dev.attributes.name ?? dev.id);
      await sleep(4000);
    } catch (e) {
      console.warn("Ring API unavailable, recording without door frames:", e instanceof Error ? e.message : e);
    }
  } else {
    console.warn("No RING_ACCESS_TOKEN: recording without door frames.");
  }

  const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADLESS !== "false" });
  const context = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "dark" });
  const page = await context.newPage();

  // Capture frames straight from Chrome (DevTools screencast). Frames arrive only
  // when the screen changes, each with a timestamp; ffmpeg's concat demuxer turns
  // them into constant-frame-rate video with each frame held for its real duration.
  const cdp = await context.newCDPSession(page);
  const frames: { file: string; at: number }[] = [];
  let pending: Promise<unknown> = Promise.resolve();
  cdp.on("Page.screencastFrame", (f) => {
    const file = path.join(OUT, "raw", `f${String(frames.length).padStart(6, "0")}.jpg`);
    frames.push({ file, at: Date.now() });
    pending = pending.then(() => writeFile(file, Buffer.from(f.data, "base64")));
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

  const t0 = Date.now();
  const cues: { file: string; at: number }[] = [];

  for (const s of voice) {
    const start = (Date.now() - t0) / 1000;
    cues.push({ file: s.file, at: start });
    process.stdout.write(`  ${s.id.padEnd(14)} @ ${start.toFixed(1)} s\n`);
    await s.act(page, s.dur);
    const end = start + s.dur + (s.hold ?? 0.3);
    const wait = end * 1000 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
  }
  const endAt = Date.now();
  const total = (endAt - t0) / 1000;
  await cdp.send("Page.stopScreencast").catch(() => undefined);
  await pending;
  await context.close();
  await browser.close();
  if (whep) await stopWhepSession(whep);
  if (frames.length === 0) throw new Error("no frames captured");

  // Build the frame list: start at the first frame on or after the title slide,
  // hold each frame until the next one arrives, hold the last until the end.
  const titleAt = t0 + cues[0].at * 1000 + 350;
  let first = frames.findIndex((f) => f.at >= titleAt);
  if (first < 0) first = frames.length - 1;
  const start = frames[first].at;
  const kept = frames.slice(first);
  const lines: string[] = [];
  kept.forEach((f, i) => {
    const next = i + 1 < kept.length ? kept[i + 1].at : endAt;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, (next - f.at) / 1000).toFixed(3)}`);
  });
  lines.push(`file '${kept[kept.length - 1].file}'`); // concat demuxer needs the last file twice
  const list = path.join(OUT, "raw", "frames.txt");
  await writeFile(list, lines.join("\n"));

  const trim = (start - t0) / 1000;
  const outFile = path.join(OUT, "front-desk-demo.mp4");
  console.log(`Encoding ${kept.length} frames, ${(total - trim).toFixed(1)} s → ${path.relative(process.cwd(), outFile)}`);

  const inputs = cues.flatMap((c) => ["-i", c.file]);
  const delays = cues
    .map((c, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(Math.max(0, c.at - trim) * 1000)}:all=1[a${i}]`)
    .join(";");
  const mix = `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0,volume=1.5,alimiter=limit=0.89[aout]`;

  execFileSync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", list,
      ...inputs,
      "-filter_complex", `${delays};${mix}`,
      "-map", "0:v", "-map", "[aout]",
      "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=30`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", (total - trim).toFixed(2),
      "-movflags", "+faststart",
      outFile,
    ],
    { stdio: "inherit" },
  );

  if (!existsSync(outFile)) throw new Error("ffmpeg produced no file");

  // Extras for editing by hand: a picture-only cut and subtitles at the final timings.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", outFile, "-an", "-c:v", "copy", path.join(OUT, "front-desk-demo-silent.mp4")]);
  const srt = voice
    .map((s, i) => {
      const a = Math.max(0, cues[i].at - trim);
      return `${i + 1}\n${srtTime(a)} --> ${srtTime(a + s.dur)}\n${s.say}\n`;
    })
    .join("\n");
  await writeFile(path.join(OUT, "front-desk-demo.srt"), srt);
  console.log("Timings:");
  voice.forEach((s, i) => console.log(`  ${tc(Math.max(0, cues[i].at - trim)).padStart(7)}  ${s.id}${s.mine ? "  (you)" : ""}`));
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outFile]).toString().trim();
  console.log(`Done: ${outFile} (${Number(dur).toFixed(1)} s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

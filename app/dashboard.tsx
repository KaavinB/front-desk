"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LogEntry } from "@/lib/store";
import type { Appointment } from "@/lib/calendar";
import type { CameraStatus } from "@/lib/ring/status";
import { AlertIcon, BellIcon, CameraIcon, CheckIcon, DoorIcon, MoonIcon, PackageIcon, SlackIcon, UserIcon } from "./icons";

type Lane = LogEntry["decision"]["lane"];

const LANE: Record<string, { label: string; Icon: (p: { size?: number }) => React.ReactNode }> = {
  appointment: { label: "Appointment", Icon: BellIcon },
  courier: { label: "Delivery", Icon: PackageIcon },
  unexpected: { label: "Not on the calendar", Icon: AlertIcon },
  after_hours: { label: "After hours", Icon: MoonIcon },
  device: { label: "Camera", Icon: CameraIcon },
};

/* ---------- time helpers (always in the office's time zone) ---------- */

const dayKey = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));

function clockParts(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).formatToParts(
    new Date(iso),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { time: `${get("hour")}:${get("minute")}`, period: get("dayPeriod") };
}

const clock = (iso: string, tz: string) => {
  const { time, period } = clockParts(iso, tz);
  return `${time} ${period}`;
};

const longDay = (key: string, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(
    new Date(`${key}T12:00:00Z`),
  );

/* ---------- derived state ---------- */

function needsLook(e: LogEntry) {
  if (e.confirmation) return false;
  return e.decision.lane === "unexpected" || (e.decision.lane === "appointment" && e.decision.alternatives.length > 0);
}

type ApptStatus = "arrived" | "unclear" | "expected";

function appointmentStatus(a: Appointment, entries: LogEntry[]): ApptStatus {
  for (const e of entries) {
    if (e.confirmation?.appointmentId === a.id) return "arrived";
  }
  for (const e of entries) {
    if (e.confirmation) continue;
    const d = e.decision;
    if (d.candidate?.id === a.id && d.alternatives.length === 0) return "arrived";
    if (d.candidate?.id === a.id || d.alternatives.some((x) => x.id === a.id)) return "unclear";
  }
  return "expected";
}

/* ---------- component ---------- */

export function Dashboard({ timeZone, officeName }: { timeZone: string; officeName: string }) {
  const [events, setEvents] = useState<LogEntry[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [camera, setCamera] = useState<CameraStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      setEvents(((await res.json()) as { events: LogEntry[] }).events);
    } catch {
      /* keep the last good state */
    }
  }, []);

  useEffect(() => {
    void refreshEvents();
    const t = setInterval(refreshEvents, 2500);
    return () => clearInterval(t);
  }, [refreshEvents]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [cal, cam] = await Promise.all([
          fetch("/api/calendar", { cache: "no-store" }).then((r) => r.json() as Promise<{ appointments: Appointment[] }>),
          fetch("/api/ring/status", { cache: "no-store" }).then((r) => r.json() as Promise<CameraStatus>),
        ]);
        if (!alive) return;
        setAppointments(cal.appointments);
        setCamera(cam);
      } catch {
        /* keep the last good state */
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function confirm(id: string, appointmentId: string | null) {
    setBusy(id);
    try {
      await fetch(`/api/events/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      await refreshEvents();
    } finally {
      setBusy(null);
    }
  }

  // The day on screen: the day of the latest door event, else the next booked day, else today.
  const focusDay = useMemo(() => {
    if (events?.length) return dayKey(events[0].eventAt, timeZone);
    const first = [...appointments].sort((a, b) => a.start.localeCompare(b.start))[0];
    return dayKey(first?.start ?? new Date().toISOString(), timeZone);
  }, [events, appointments, timeZone]);

  const dayEvents = useMemo(
    () => (events ?? []).filter((e) => dayKey(e.eventAt, timeZone) === focusDay && e.decision.lane !== "ignored"),
    [events, focusDay, timeZone],
  );
  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => dayKey(a.start, timeZone) === focusDay)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [appointments, focusDay, timeZone],
  );

  const stats = {
    visitors: dayEvents.filter((e) => e.decision.lane === "appointment").length,
    look: dayEvents.filter(needsLook).length,
    deliveries: dayEvents.filter((e) => e.decision.lane === "courier").length,
    afterHours: dayEvents.filter((e) => e.decision.lane === "after_hours").length,
  };
  const latestFrame = dayEvents.find((e) => e.snapshotPath);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <DoorIcon size={20} />
          </span>
          <div>
            <div className="brand-name">Front Desk</div>
            <div className="brand-office">{officeName}</div>
          </div>
        </div>
        <CameraPill status={camera} />
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{longDay(focusDay, timeZone)}</p>
          <h1>Who&apos;s at the door</h1>
        </div>
        <dl className="stats">
          <Stat label="Visitors" value={stats.visitors} tone="appointment" />
          <Stat label="Needs a look" value={stats.look} tone={stats.look ? "unexpected" : "quiet"} />
          <Stat label="Deliveries" value={stats.deliveries} tone="courier" />
          <Stat label="After hours" value={stats.afterHours} tone="after_hours" />
        </dl>
      </section>

      <div className="grid">
        <section aria-label="Door activity">
          {events === null ? (
            <div className="empty">Loading the door log…</div>
          ) : dayEvents.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">
                <BellIcon size={22} />
              </span>
              <p className="empty-title">Quiet so far</p>
              <p className="empty-sub">When someone rings the bell, they&apos;ll appear here with a frame from the door.</p>
            </div>
          ) : (
            <ol className="timeline">
              {dayEvents.map((e) => (
                <EventRow key={e.id} e={e} tz={timeZone} busy={busy === e.id} onConfirm={confirm} />
              ))}
            </ol>
          )}
        </section>

        <aside className="side">
          <div className="panel">
            <div className="panel-head">
              <h2>Front door</h2>
              {latestFrame ? <span className="panel-note">{clock(latestFrame.eventAt, timeZone)}</span> : null}
            </div>
            {latestFrame?.snapshotPath ? (
              <Frame src={latestFrame.snapshotPath} className="frame" />
            ) : (
              <div className="frame frame-empty">
                <CameraIcon size={22} />
                <span>No frame yet</span>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Appointments</h2>
              <span className="panel-note">
                {dayAppointments.filter((a) => appointmentStatus(a, dayEvents) === "arrived").length} of{" "}
                {dayAppointments.length} arrived
              </span>
            </div>
            {dayAppointments.length === 0 ? (
              <p className="panel-empty">Nothing booked.</p>
            ) : (
              <ul className="appts">
                {dayAppointments.map((a) => {
                  const s = appointmentStatus(a, dayEvents);
                  return (
                    <li key={a.id} className="appt" data-status={s}>
                      <span className="appt-time">{clock(a.start, timeZone)}</span>
                      <span className="appt-who">
                        <span className="appt-name">{a.visitor}</span>
                        <span className="appt-host">with {a.host}</span>
                      </span>
                      <span className="appt-status">
                        {s === "arrived" ? (
                          <>
                            <CheckIcon size={13} /> Here
                          </>
                        ) : s === "unclear" ? (
                          "Confirm"
                        ) : (
                          "Expected"
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function Stat({ label, value, tone }: { label: string; value: number; tone: Lane | "quiet" }) {
  return (
    <div className="stat" data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CameraPill({ status }: { status: CameraStatus | null }) {
  if (!status) return <span className="pill">Connecting…</span>;
  if (!status.configured)
    return (
      <span className="pill" data-state="idle">
        <span className="dot" /> Simulator mode
      </span>
    );
  if (!status.ok)
    return (
      <span className="pill" data-state="warn" title={status.error}>
        <span className="dot" /> Ring API needs a new token
      </span>
    );
  return (
    <span className="pill" data-state={status.online ? "live" : "warn"} title={status.deviceId}>
      <span className="dot" /> {status.name} · {status.online ? "online" : "offline"}
      <span className="pill-tag">Live Ring API</span>
    </span>
  );
}

function Frame({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt="Front door at the time of the visit" onError={() => setBroken(true)} />;
}

function EventRow({
  e,
  tz,
  busy,
  onConfirm,
}: {
  e: LogEntry;
  tz: string;
  busy: boolean;
  onConfirm: (id: string, appointmentId: string | null) => void;
}) {
  const d = e.decision;
  const lane = LANE[d.lane] ?? LANE.device;
  const { time, period } = clockParts(e.eventAt, tz);
  const options = d.candidate ? [d.candidate, ...d.alternatives] : [];
  const pending = needsLook(e);
  const headline = (e.notice?.text ?? d.headline).split("\n")[0];
  const confirmedName =
    e.confirmation &&
    (e.confirmation.appointmentId
      ? (options.find((a) => a.id === e.confirmation!.appointmentId)?.visitor ?? "an appointment")
      : "not an appointment");

  return (
    <li className="row" data-lane={d.lane} data-pending={pending || undefined}>
      <div className="when">
        <span className="when-time">{time}</span>
        <span className="when-period">{period}</span>
      </div>
      <span className="node" aria-hidden="true">
        <lane.Icon size={14} />
      </span>
      <article className="card">
        <div className="card-main">
          <div className="card-top">
            <span className="chip">{lane.label}</span>
            {pending ? <span className="chip chip-attn">Needs a look</span> : null}
          </div>
          <h3 className="headline">{headline}</h3>
          <div className="meta">
            {d.candidate ? (
              <span>
                <UserIcon size={13} /> {d.candidate.host}
              </span>
            ) : null}
            {d.candidate?.notes ? <span>{d.candidate.notes}</span> : null}
            {e.notified?.length ? (
              <span>
                <SlackIcon size={13} /> Sent to Slack
              </span>
            ) : null}
            {e.greeted?.played ? (
              <span>
                <BellIcon size={13} /> Greeted
              </span>
            ) : null}
            {e.notice?.writer === "bedrock" ? <span>Written by Bedrock</span> : null}
          </div>

          {e.confirmation ? (
            <div className="confirmed">
              <CheckIcon size={14} /> Confirmed: {confirmedName}
            </div>
          ) : options.length === 1 ? (
            <div className="actions">
              <button className="btn btn-link" disabled={busy} onClick={() => onConfirm(e.id, null)}>
                Not {options[0].visitor}?
              </button>
            </div>
          ) : options.length > 1 ? (
            <div className="actions">
              {options.map((a, i) => (
                <button
                  key={a.id}
                  className={i === 0 ? "btn btn-primary" : "btn"}
                  disabled={busy}
                  onClick={() => onConfirm(e.id, a.id)}
                >
                  It&apos;s {a.visitor}
                </button>
              ))}
              <button className="btn btn-ghost" disabled={busy} onClick={() => onConfirm(e.id, null)}>
                Not them
              </button>
            </div>
          ) : d.lane === "unexpected" ? (
            <div className="actions">
              <button className="btn" disabled={busy} onClick={() => onConfirm(e.id, null)}>
                Handled
              </button>
            </div>
          ) : null}
        </div>
        {e.snapshotPath ? <Frame src={e.snapshotPath} className="card-snap" /> : null}
      </article>
    </li>
  );
}

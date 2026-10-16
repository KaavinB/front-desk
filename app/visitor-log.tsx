"use client";

import { useEffect, useState } from "react";
import type { LogEntry } from "@/lib/store";

const LANE_LABEL: Record<string, string> = {
  appointment: "Appointment",
  courier: "Delivery",
  unexpected: "Unexpected visitor",
  after_hours: "After hours",
  device: "Device",
};

function fmt(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Times are shown in the office's time zone, not the viewer's, so the log reads like the office's day. */
export function VisitorLog({ timeZone }: { timeZone: string }) {
  const [events, setEvents] = useState<LogEntry[] | null>(null);

  async function refresh() {
    const res = await fetch("/api/events", { cache: "no-store" });
    const json = (await res.json()) as { events: LogEntry[] };
    setEvents(json.events);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, []);

  async function confirm(id: string, appointmentId: string | null) {
    await fetch(`/api/events/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    });
    await refresh();
  }

  if (events === null) return <div className="empty">Loading…</div>;
  if (events.length === 0) return <div className="empty">Quiet so far. Nobody has rung the bell.</div>;

  return (
    <>
      {events.map((e) => {
        const d = e.decision;
        const options = d.candidate ? [d.candidate, ...d.alternatives] : [];
        const confirmedName =
          e.confirmation &&
          (e.confirmation.appointmentId
            ? options.find((a) => a.id === e.confirmation!.appointmentId)?.visitor ?? "an appointment"
            : "not an appointment");
        return (
          <article key={e.id} className="card" data-lane={d.lane}>
            <div className="row">
              <span className="lane">{LANE_LABEL[d.lane] ?? d.lane}</span>
              <span className="meta">{fmt(e.eventAt, timeZone)}</span>
            </div>
            <div className="headline">{d.headline}</div>
            <div className="meta">
              {e.eventType}
              {e.subType ? `.${e.subType}` : ""}
              {d.candidate ? ` · host ${d.candidate.host}` : ""}
              {e.notified?.length ? ` · sent to ${e.notified.map((n) => n.channel).join(", ")}` : ""}
            </div>
            {e.snapshotPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="snap" src={e.snapshotPath} alt="Front door at the time of the visit" />
            ) : null}
            {e.confirmation ? (
              <div className="confirmed">✓ Confirmed: {confirmedName}</div>
            ) : options.length > 0 ? (
              <div className="actions">
                {options.map((a, i) => (
                  <button key={a.id} className={i === 0 ? "primary" : ""} onClick={() => confirm(e.id, a.id)}>
                    It&apos;s {a.visitor}
                  </button>
                ))}
                <button onClick={() => confirm(e.id, null)}>Not them</button>
              </div>
            ) : d.lane === "unexpected" ? (
              <div className="actions">
                <button onClick={() => confirm(e.id, null)}>Logged, handled</button>
              </div>
            ) : null}
          </article>
        );
      })}
    </>
  );
}

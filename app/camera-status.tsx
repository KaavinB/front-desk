"use client";

import { useEffect, useState } from "react";
import type { CameraStatus } from "@/lib/ring/status";

export function CameraStatusBadge() {
  const [status, setStatus] = useState<CameraStatus | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/ring/status", { cache: "no-store" });
      if (alive) setStatus((await res.json()) as CameraStatus);
    }
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!status) return <span className="badge">Front door camera · …</span>;
  if (!status.configured) return <span className="badge">Front door camera · simulator only</span>;
  if (!status.ok) return <span className="badge off" title={status.error}>Front door camera · unreachable</span>;
  return (
    <span className={`badge ${status.online ? "on" : "off"}`} title={status.deviceId}>
      {status.name} · {status.online ? "online" : "offline"} · live Ring API
    </span>
  );
}

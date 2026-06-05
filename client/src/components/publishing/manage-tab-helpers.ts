import { useState, useEffect, useRef } from "react";

export type AppStatus = "running" | "stopped" | "error" | "restarting";

export function useUptime(running: boolean): string {
  const [secs, setSecs] = useState(0);
  const startRef = useRef(Date.now() - 7_240_000);

  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

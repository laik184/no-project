/**
 * IQ 2000 — Console · useConsoleStream
 *
 * SSE hook that connects to /api/console/stream?projectId=<n>.
 * Delivers typed log lines and runtime state events to the caller.
 * Handles exponential-backoff reconnection automatically.
 */

import { useEffect, useRef, useState } from "react";
import type { LogLine, RuntimeStateEvent } from "@/types/console";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useConsoleStream(
  projectId: number,
  onLine:  (line: LogLine) => void,
  onState: (ev: RuntimeStateEvent) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const onLineRef  = useRef(onLine);
  const onStateRef = useRef(onState);
  onLineRef.current  = onLine;
  onStateRef.current = onState;

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let alive = true;

    function connect() {
      if (!alive) return;

      const es = new EventSource(`/api/console/stream?projectId=${projectId}`);

      es.addEventListener("connected", () => {
        setConnected(true);
        retryDelay = 1000;
      });

      es.addEventListener("console", (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as {
            id?: string; kind?: string; stream?: string;
            line?: string; ts?: string; meta?: unknown;
          };
          if (!data.line) return;
          const kind = (data.kind as LogLine["kind"]) ??
            (data.stream === "stderr" ? "stderr" : "stdout");
          onLineRef.current({
            id:   data.id ?? uid(),
            kind,
            text: data.line,
            ts:   data.ts ?? new Date().toISOString(),
            meta: data.meta as LogLine["meta"],
          });
        } catch {}
      });

      es.addEventListener("runtime.state", (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as RuntimeStateEvent;
          onStateRef.current(data);
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (alive) {
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 1.5, 15_000);
            connect();
          }, retryDelay);
        }
      };
    }

    connect();

    return () => {
      alive = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [projectId]);

  return connected;
}

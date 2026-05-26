/**
 * useRuntimeHealth.ts — polls /api/preview/metrics/:projectId for live runtime data.
 *
 * Returns: port, uptime, restartCount, healthy, pid
 * Polling interval: 5s (lightweight, no SSE needed for metrics)
 * Stops polling when no projectId is provided.
 */

import { useState, useEffect, useRef } from "react";

export interface RuntimeHealth {
  projectId:    number;
  pid?:         number;
  port?:        number;
  status:       string;
  lifecycleState: string;
  uptimeMs:     number;
  uptimeFmt:    string;
  restartCount: number;
  healthy:      boolean;
}

interface UseRuntimeHealthOptions {
  projectId?: number;
  intervalMs?: number;
}

export function useRuntimeHealth({ projectId, intervalMs = 5_000 }: UseRuntimeHealthOptions = {}) {
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = async () => {
    const url = projectId != null
      ? `/api/preview/metrics/${projectId}`
      : `/api/preview/metrics`;

    try {
      const res = await fetch(url);
      if (!res.ok) { setHealth(null); return; }
      const data = await res.json();

      if (projectId != null && data.ok && data.metrics) {
        setHealth(data.metrics as RuntimeHealth);
      } else if (data.ok && Array.isArray(data.metrics) && data.metrics.length > 0) {
        // Pick the first running/healthy process
        const running = data.metrics.find((m: RuntimeHealth) => m.healthy) ?? data.metrics[0];
        setHealth(running ?? null);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHealth();

    intervalRef.current = setInterval(fetchHealth, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, intervalMs]);

  return { health, loading };
}

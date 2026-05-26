/**
 * useRunRecovery.ts — C6 stream recovery hook
 *
 * Checks on mount whether there is an active agent run for the current
 * project.  If one is found, returns its runId so the caller can rehydrate
 * UI state and reattach event subscriptions.
 *
 * Called by useAgentRunner.ts.  Safe to call on every render — the fetch
 * is only initiated once on mount (cancelled on unmount).
 *
 * Returns:
 *   activeRunId   — runId of the currently running run, or null
 *   isRecovering  — true while the fetch is in flight
 */

import { useEffect, useState } from "react";

interface RecoveryState {
  activeRunId:  string | null;
  isRecovering: boolean;
}

export function useRunRecovery(projectId: number): RecoveryState {
  const [activeRunId,  setActiveRunId]  = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    setIsRecovering(true);

    (async () => {
      try {
        const r = await fetch(`/api/run/active?projectId=${projectId}`);
        if (!r.ok || cancelled) return;
        const body = await r.json() as { ok: boolean; run?: { runId: string } | null };
        if (!cancelled && body.ok && body.run?.runId) {
          setActiveRunId(body.run.runId);
        }
      } catch {
        // Network error — no recovery, silent fail
      } finally {
        if (!cancelled) setIsRecovering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  return { activeRunId, isRecovering };
}

/**
 * runtime-sync.ts (orchestration layer)
 *
 * Keeps orchestration state synchronized with the infrastructure RuntimeStore.
 * When the runtime transitions (starting→ready, etc.) orchestration reacts.
 */

import { bus }          from "../../infrastructure/events/bus.ts";
import { runtimeStore } from "../../infrastructure/runtime/runtime-store/runtime-store.ts";
import { incrementCounter } from "../telemetry/orchestration-metrics.ts";

// ── Active sync watchers ──────────────────────────────────────────────────────

type RuntimeSyncHandler = (opts: {
  projectId: number;
  phase:     string;
  healthy:   boolean;
  port?:     number;
}) => void;

const _handlers = new Map<number, RuntimeSyncHandler[]>();

export function watchRuntimeSync(projectId: number, handler: RuntimeSyncHandler): () => void {
  const list = _handlers.get(projectId) ?? [];
  list.push(handler);
  _handlers.set(projectId, list);

  return () => {
    const current = _handlers.get(projectId) ?? [];
    _handlers.set(projectId, current.filter(h => h !== handler));
  };
}

// ── Bus integration ───────────────────────────────────────────────────────────

let _initialized = false;

export function initRuntimeSync(): void {
  if (_initialized) return;
  _initialized = true;

  bus.subscribe("runtime.sync", (e) => {
    const handlers = _handlers.get(e.projectId) ?? [];
    const { phase, healthy, port } = e.snapshot;

    for (const h of handlers) {
      try { h({ projectId: e.projectId, phase, healthy, port }); }
      catch (err) { console.warn("[runtime-sync] Handler error:", err); }
    }

    // Track transitions as metrics
    incrementCounter(`runtime.transition.${e.transition.to}`, {
      projectId: String(e.projectId),
    });
  });

  bus.subscribe("runtime.observation", (e) => {
    incrementCounter(`runtime.observation.${e.status}`, {
      projectId: String(e.projectId),
    });
  });

  console.log("[orchestration/runtime-sync] Runtime sync wiring active.");
}

// ── One-shot runtime readiness wait ──────────────────────────────────────────

export function waitForRuntimeReady(
  projectId: number,
  timeoutMs: number = 60_000,
): Promise<{ port?: number }> {
  return new Promise((resolve, reject) => {
    // Check if already ready
    const current = runtimeStore.get(projectId);
    if (current.healthy && current.phase === "ready") {
      return resolve({ port: current.port });
    }

    const deadline = setTimeout(() => {
      unsub();
      reject(new Error(`[runtime-sync] Runtime for project ${projectId} not ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const unsub = watchRuntimeSync(projectId, ({ phase, healthy, port }) => {
      if (healthy && phase === "ready") {
        clearTimeout(deadline);
        unsub();
        resolve({ port });
      }
      if (phase === "crashed" || phase === "failed") {
        clearTimeout(deadline);
        unsub();
        reject(new Error(`[runtime-sync] Runtime crashed for project ${projectId}`));
      }
    });
  });
}

// ── Snapshot accessor ─────────────────────────────────────────────────────────

export function getRuntimeSnapshot(projectId: number) {
  return runtimeStore.get(projectId);
}

/**
 * server/preview/run-scoped-preview-fabric.ts
 *
 * RunScopedPreviewFabric — isolated preview lifecycle per run.
 *
 * Responsibilities:
 *   - Create and manage isolated preview instances per runId
 *   - Maintain isolated WebSocket channels per preview
 *   - Prevent preview state leakage across runs
 *   - Synchronize preview lifecycle with runtime events
 *   - Emit telemetry on all preview lifecycle transitions
 *
 * Single responsibility: preview instance registry. No runtime spawning logic.
 */

import { bus }  from "../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PreviewStatus = "initializing" | "ready" | "error" | "destroyed";

export interface PreviewInstance {
  readonly runId:        string;
  readonly projectId:    number;
  readonly channel:      string;      // `preview:${runId}`
  readonly wsChannel:    string;      // `ws:preview:${runId}`
  readonly createdAt:    number;
  port?:                 number;
  url?:                  string;
  status:                PreviewStatus;
  lastSyncAt:            number | null;
  errorMessage?:         string;
}

export interface PreviewFabricSnapshot {
  active:      number;
  destroyed:   number;
  byStatus:    Record<PreviewStatus, number>;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _instances    = new Map<string, PreviewInstance>(); // runId → instance
let   _destroyedCnt = 0;

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "preview-fabric",
    agentName: "run-scoped-preview-fabric",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register an isolated preview instance for a run.
 * Idempotent — returns existing instance if already registered.
 */
export function registerPreview(runId: string, projectId: number): PreviewInstance {
  const existing = _instances.get(runId);
  if (existing && existing.status !== "destroyed") return existing;

  const instance: PreviewInstance = {
    runId, projectId,
    channel:    `preview:${runId}`,
    wsChannel:  `ws:preview:${runId}`,
    createdAt:  Date.now(),
    status:     "initializing",
    lastSyncAt: null,
  };
  _instances.set(runId, instance);
  emit(runId, projectId, "preview.started", { channel: instance.channel });
  return instance;
}

/** Mark a preview as ready with its port and URL. */
export function markPreviewReady(runId: string, port: number, url: string): void {
  const inst = _instances.get(runId);
  if (!inst || inst.status === "destroyed") return;
  inst.port       = port;
  inst.url        = url;
  inst.status     = "ready";
  inst.lastSyncAt = Date.now();
  emit(runId, inst.projectId, "verification.started", { port, url });
}

/** Mark a preview as errored. */
export function markPreviewError(runId: string, errorMessage: string): void {
  const inst = _instances.get(runId);
  if (!inst || inst.status === "destroyed") return;
  inst.status       = "error";
  inst.errorMessage = errorMessage;
  emit(runId, inst.projectId, "runtime.failed", { reason: "preview-error", errorMessage });
}

/** Sync a preview — update lastSyncAt timestamp and re-confirm ready. */
export function syncPreview(runId: string): void {
  const inst = _instances.get(runId);
  if (!inst || inst.status !== "ready") return;
  inst.lastSyncAt = Date.now();
  emit(runId, inst.projectId, "preview.started", { sync: true, lastSyncAt: inst.lastSyncAt });
}

/** Destroy a preview instance and free its resources. */
export function destroyPreview(runId: string): void {
  const inst = _instances.get(runId);
  if (!inst || inst.status === "destroyed") return;
  inst.status = "destroyed";
  _destroyedCnt++;
  emit(runId, inst.projectId, "run.completed", {
    lifetimeMs: Date.now() - inst.createdAt,
    channel:    inst.channel,
  });
  // Keep tombstone for 2 min, then evict
  setTimeout(() => _instances.delete(runId), 120_000);
}

/** Get a preview instance by runId (read-only). */
export function getPreview(runId: string): PreviewInstance | undefined {
  return _instances.get(runId);
}

/** List all active (non-destroyed) previews. */
export function listActivePreviews(): PreviewInstance[] {
  return Array.from(_instances.values()).filter(i => i.status !== "destroyed");
}

/** Snapshot stats. */
export function snapshot(): PreviewFabricSnapshot {
  const instances = Array.from(_instances.values());
  return {
    active:    instances.filter(i => i.status !== "destroyed").length,
    destroyed: _destroyedCnt,
    byStatus: {
      initializing: instances.filter(i => i.status === "initializing").length,
      ready:        instances.filter(i => i.status === "ready").length,
      error:        instances.filter(i => i.status === "error").length,
      destroyed:    instances.filter(i => i.status === "destroyed").length,
    },
  };
}

// ── Runtime event bridge ──────────────────────────────────────────────────────
// Auto-destroy previews when their owning run completes/fails

bus.on("agent.event", (payload: any) => {
  if (!payload?.runId || !payload?.eventType) return;
  if (payload.eventType === "run.completed" && payload.agentName !== "run-scoped-preview-fabric") {
    destroyPreview(payload.runId);
  }
});

/**
 * server/distributed/isolation/run-isolation-fabric.ts
 *
 * RunIsolationFabric — top-level coordinator for per-run execution environments.
 *
 * Responsibilities:
 *   - Creates fully isolated execution envelopes per runId
 *   - Assigns and tracks isolated resources (sandbox, ports, telemetry, memory lane)
 *   - Prevents cross-run resource leakage
 *   - Emits lifecycle telemetry on all transitions
 *   - Enforces cleanup on run termination
 *
 * Single responsibility: resource envelope lifecycle. No agent/orchestration logic.
 */

import { bus }                   from "../../infrastructure/events/bus.ts";
import crypto                    from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunEnvelope {
  readonly runId:        string;
  readonly projectId:    number;
  readonly scopeToken:   string;   // cryptographically unique per envelope
  readonly createdAt:    number;
  sandboxRoot:           string;   // isolated filesystem root
  tmpDir:                string;   // isolated tmp directory
  ports:                 Set<number>;
  telemetryChannel:      string;   // `run:${runId}` SSE channel
  memoryLane:            string;   // `lane:${runId}` memory namespace
  previewChannel:        string;   // `preview:${runId}`
  lockNamespace:         string;   // `lock:${runId}` distributed lock prefix
  status:                EnvelopeStatus;
  terminatedAt?:         number;
}

export type EnvelopeStatus = "active" | "terminating" | "terminated";

export interface FabricStats {
  activeEnvelopes:     number;
  terminatedEnvelopes: number;
  totalPortsAllocated: number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _envelopes = new Map<string, RunEnvelope>();   // runId → envelope
let _terminatedCount = 0;
let _totalPorts      = 0;

// ── Telemetry helpers ─────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "isolation-fabric",
    agentName: "run-isolation-fabric",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create an isolated execution envelope for a run.
 * Idempotent — returns existing envelope if runId is already active.
 */
export function createEnvelope(runId: string, projectId: number, sandboxBase = ".sandbox"): RunEnvelope {
  const existing = _envelopes.get(runId);
  if (existing && existing.status === "active") return existing;

  const scopeToken = crypto.randomBytes(12).toString("hex");
  const envelope: RunEnvelope = {
    runId,
    projectId,
    scopeToken,
    createdAt:       Date.now(),
    sandboxRoot:     `${sandboxBase}/projects/${projectId}/runs/${runId}`,
    tmpDir:          `${sandboxBase}/.tmp/${runId}`,
    ports:           new Set(),
    telemetryChannel: `run:${runId}`,
    memoryLane:       `lane:${runId}`,
    previewChannel:   `preview:${runId}`,
    lockNamespace:    `lock:${runId}`,
    status:           "active",
  };

  _envelopes.set(runId, envelope);
  emit(runId, projectId, "run.isolated", {
    scopeToken,
    sandboxRoot: envelope.sandboxRoot,
    memoryLane:  envelope.memoryLane,
    activeEnvelopes: _envelopes.size,
  });
  return envelope;
}

/** Register a port as owned by this run envelope. */
export function registerPort(runId: string, port: number): void {
  const env = _envelopes.get(runId);
  if (!env || env.status !== "active") return;
  env.ports.add(port);
  _totalPorts++;
  emit(runId, env.projectId, "lock.acquired", { resource: "port", port });
}

/** Release a specific port from a run envelope. */
export function releasePort(runId: string, port: number): void {
  const env = _envelopes.get(runId);
  if (!env) return;
  env.ports.delete(port);
  emit(runId, env.projectId, "lock.released", { resource: "port", port });
}

/** Retrieve an active envelope (read-only). */
export function getEnvelope(runId: string): RunEnvelope | undefined {
  return _envelopes.get(runId);
}

/** Check whether a run envelope is active. */
export function isEnvelopeActive(runId: string): boolean {
  return _envelopes.get(runId)?.status === "active";
}

/**
 * Terminate an envelope — marks it as terminating, clears resources,
 * then sets terminated. Idempotent.
 */
export function terminateEnvelope(runId: string): void {
  const env = _envelopes.get(runId);
  if (!env || env.status === "terminated") return;

  env.status = "terminating";
  emit(runId, env.projectId, "run.completed", {
    scopeToken:    env.scopeToken,
    lifetimeMs:    Date.now() - env.createdAt,
    portsReleased: env.ports.size,
  });

  env.ports.clear();
  env.status        = "terminated";
  env.terminatedAt  = Date.now();
  _terminatedCount++;

  // Keep tombstone for 5 min for replay/audit, then evict
  setTimeout(() => _envelopes.delete(runId), 300_000);
}

/** List all active envelopes (diagnostic). */
export function listActiveEnvelopes(): RunEnvelope[] {
  return Array.from(_envelopes.values()).filter(e => e.status === "active");
}

/** Detect envelopes older than maxAgeMs that are still active (leak detection). */
export function detectLeakedEnvelopes(maxAgeMs = 600_000): RunEnvelope[] {
  const now = Date.now();
  return Array.from(_envelopes.values()).filter(
    e => e.status === "active" && (now - e.createdAt) > maxAgeMs,
  );
}

/** Snapshot stats for monitoring. */
export function fabricStats(): FabricStats {
  return {
    activeEnvelopes:     Array.from(_envelopes.values()).filter(e => e.status === "active").length,
    terminatedEnvelopes: _terminatedCount,
    totalPortsAllocated: _totalPorts,
  };
}

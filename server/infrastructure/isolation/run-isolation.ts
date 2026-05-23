/**
 * server/infrastructure/isolation/run-isolation.ts  — P7 Cross-Run Isolation
 *
 * Ensures that agent runs cannot leak state, file handles, or shared memory
 * into each other. Each run gets a clean namespace.
 *
 * Features:
 *   - RunContext — scoped per-run registry (files, processes, timers)
 *   - createRunContext(runId, projectId) — allocates a fresh isolated context
 *   - withRunContext(ctx, fn)            — executes fn in isolated scope
 *   - destroyRunContext(ctx)             — tears down all registered resources
 *   - leakDetector                       — warns on context leak at shutdown
 *
 * Single responsibility: resource lifecycle + isolation per run. No domain logic.
 */

import { bus }   from "../events/bus.ts";
import crypto    from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunContext {
  readonly runId:     string;
  readonly projectId: number;
  readonly createdAt: number;
  readonly scopeId:   string;                // unique per instance even if runId is reused
  readonly env:       Map<string, string>;   // isolated env vars for this run
  readonly files:     Set<string>;           // open file paths tracked for cleanup
  readonly timers:    Set<NodeJS.Timeout>;   // active timers tracked for cleanup
  readonly meta:      Map<string, unknown>;  // arbitrary scoped state
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _active = new Map<string, RunContext>();  // scopeId → RunContext

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "isolation",
    agentName: "run-isolation",
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Allocate a fresh, isolated run context. */
export function createRunContext(runId: string, projectId: number): RunContext {
  const scopeId = crypto.randomBytes(8).toString("hex");
  const ctx: RunContext = {
    runId, projectId,
    createdAt: Date.now(),
    scopeId,
    env:   new Map(),
    files: new Set(),
    timers: new Set(),
    meta:  new Map(),
  };
  _active.set(scopeId, ctx);
  emit(runId, projectId, "run.context.created", { scopeId, activeContexts: _active.size });
  return ctx;
}

/** Register a file path as owned by this run context (for cleanup). */
export function trackFile(ctx: RunContext, filePath: string): void {
  ctx.files.add(filePath);
}

/** Register a timer as owned by this run context (for cleanup). */
export function trackTimer(ctx: RunContext, timer: NodeJS.Timeout): void {
  ctx.timers.add(timer);
}

/** Store arbitrary scoped state that doesn't escape the run boundary. */
export function setScopedMeta(ctx: RunContext, key: string, value: unknown): void {
  ctx.meta.set(key, value);
}

/** Read scoped state. */
export function getScopedMeta<T = unknown>(ctx: RunContext, key: string): T | undefined {
  return ctx.meta.get(key) as T | undefined;
}

/** Tear down all registered resources for this run. */
export async function destroyRunContext(ctx: RunContext, fs?: typeof import("fs/promises")): Promise<void> {
  const start = Date.now();

  // Clear all timers
  for (const timer of ctx.timers) {
    try { clearTimeout(timer); } catch {}
  }
  ctx.timers.clear();

  // Remove tracked temp files (best-effort)
  if (fs) {
    const removals = Array.from(ctx.files).map(f =>
      fs.rm(f, { recursive: true, force: true }).catch(() => {}),
    );
    await Promise.all(removals);
  }
  ctx.files.clear();
  ctx.env.clear();
  ctx.meta.clear();

  _active.delete(ctx.scopeId);

  emit(ctx.runId, ctx.projectId, "run.context.destroyed", {
    scopeId:        ctx.scopeId,
    lifetimeMs:     Date.now() - ctx.createdAt,
    durationMs:     Date.now() - start,
    activeContexts: _active.size,
  });
}

/** Execute `fn` with a run context, guaranteed to destroy on exit. */
export async function withRunContext<T>(
  runId:     string,
  projectId: number,
  fn:        (ctx: RunContext) => Promise<T>,
  fs?:       typeof import("fs/promises"),
): Promise<T> {
  const ctx = createRunContext(runId, projectId);
  try {
    return await fn(ctx);
  } finally {
    await destroyRunContext(ctx, fs);
  }
}

/** List all active contexts (diagnostic). */
export function listActiveContexts(): RunContext[] {
  return Array.from(_active.values());
}

/** Detect and warn on leaked contexts older than maxAgeMs. */
export function detectLeaks(maxAgeMs: number = 300_000): RunContext[] {
  const now    = Date.now();
  const leaked = Array.from(_active.values()).filter(c => now - c.createdAt > maxAgeMs);
  for (const ctx of leaked) {
    emit(ctx.runId, ctx.projectId, "run.context.leaked", {
      scopeId:  ctx.scopeId,
      ageMs:    now - ctx.createdAt,
      maxAgeMs,
    });
  }
  return leaked;
}

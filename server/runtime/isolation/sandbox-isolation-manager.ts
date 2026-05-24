/**
 * server/runtime/isolation/sandbox-isolation-manager.ts
 *
 * SandboxIsolationManager — per-run filesystem and environment isolation.
 *
 * Responsibilities:
 *   - Provision isolated project directories per run
 *   - Provision isolated tmp directories per run
 *   - Manage isolated environment variable scopes
 *   - Track process ownership per run
 *   - Enforce cleanup on run teardown
 *
 * Single responsibility: filesystem + env isolation. No orchestration logic.
 */

import fs            from "fs/promises";
import path          from "path";
import { bus }       from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SandboxScope {
  readonly runId:        string;
  readonly projectId:    number;
  readonly projectDir:   string;
  readonly tmpDir:       string;
  readonly nodeModulesCache: string;
  readonly env:          Map<string, string>;
  readonly ownedPids:    Set<number>;
  readonly createdAt:    number;
}

export interface ProvisionResult {
  ok:         boolean;
  scope:      SandboxScope;
  error?:     string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _scopes = new Map<string, SandboxScope>();  // runId → scope

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "sandbox-isolation",
    agentName: "sandbox-isolation-manager",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function buildScope(runId: string, projectId: number, base: string): SandboxScope {
  const projectDir        = path.join(base, "projects", String(projectId), "runs", runId);
  const tmpDir            = path.join(base, ".tmp", runId);
  const nodeModulesCache  = path.join(base, ".nm-cache", String(projectId));
  return {
    runId, projectId,
    projectDir, tmpDir, nodeModulesCache,
    env:        new Map(),
    ownedPids:  new Set(),
    createdAt:  Date.now(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Provision a fully isolated sandbox for a run.
 * Creates all required directories and registers the scope.
 * Idempotent — returns existing scope if already provisioned.
 */
export async function provisionSandbox(
  runId:     string,
  projectId: number,
  base       = process.env.AGENT_PROJECT_ROOT ?? ".sandbox",
): Promise<ProvisionResult> {
  const existing = _scopes.get(runId);
  if (existing) return { ok: true, scope: existing };

  const scope = buildScope(runId, projectId, base);

  try {
    await Promise.all([
      ensureDir(scope.projectDir),
      ensureDir(scope.tmpDir),
      ensureDir(scope.nodeModulesCache),
    ]);
    _scopes.set(runId, scope);
    emit(runId, projectId, "run.isolated", {
      projectDir: scope.projectDir,
      tmpDir:     scope.tmpDir,
      activeScopes: _scopes.size,
    });
    return { ok: true, scope };
  } catch (err: any) {
    emit(runId, projectId, "runtime.failed", { reason: "sandbox-provision", error: err.message });
    return { ok: false, scope, error: err.message };
  }
}

/** Set an isolated environment variable for this run only. */
export function setSandboxEnv(runId: string, key: string, value: string): void {
  _scopes.get(runId)?.env.set(key, value);
}

/** Get the merged environment for a run (process.env + run-scoped overrides). */
export function getSandboxEnv(runId: string): Record<string, string> {
  const scope = _scopes.get(runId);
  const merged: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (scope) {
    for (const [k, v] of scope.env) merged[k] = v;
    // Force tmp isolation
    merged.TMPDIR   = scope.tmpDir;
    merged.TMP      = scope.tmpDir;
    merged.TEMP     = scope.tmpDir;
    merged.npm_config_cache = scope.nodeModulesCache;
  }
  return merged;
}

/** Register a PID as owned by this run (for crash-safe cleanup). */
export function registerPid(runId: string, pid: number): void {
  const scope = _scopes.get(runId);
  if (!scope) return;
  scope.ownedPids.add(pid);
  emit(runId, scope.projectId, "runtime.spawned", { pid });
}

/** Deregister a PID from a run scope (e.g. after clean exit). */
export function deregisterPid(runId: string, pid: number): void {
  _scopes.get(runId)?.ownedPids.delete(pid);
}

/** Retrieve the sandbox scope for a run (read-only). */
export function getSandboxScope(runId: string): SandboxScope | undefined {
  return _scopes.get(runId);
}

/**
 * Tear down a sandbox — kill orphan processes, remove tmp dir, deregister scope.
 * Best-effort: errors are logged but do not throw.
 */
export async function teardownSandbox(runId: string): Promise<void> {
  const scope = _scopes.get(runId);
  if (!scope) return;

  // Kill any orphan processes owned by this run
  for (const pid of scope.ownedPids) {
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
  scope.ownedPids.clear();

  // Remove tmp directory
  try {
    await fs.rm(scope.tmpDir, { recursive: true, force: true });
  } catch {}

  _scopes.delete(runId);
  emit(runId, scope.projectId, "run.completed", {
    lifetimeMs: Date.now() - scope.createdAt,
    activeScopes: _scopes.size,
  });
}

/** List all active sandbox scopes (diagnostic / monitoring). */
export function listScopes(): SandboxScope[] {
  return Array.from(_scopes.values());
}

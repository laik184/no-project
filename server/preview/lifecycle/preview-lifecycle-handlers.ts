/**
 * server/preview/lifecycle/preview-lifecycle-handlers.ts
 *
 * All individual bus-event → lifecycle-transition handlers.
 * Extracted from preview-lifecycle-bridge.ts to keep each file ≤250 lines.
 *
 * Single responsibility: handler functions only — no mounting, no bus.on calls.
 */

import { getLifecycleManager } from "./preview-lifecycle.manager.ts";

const CSS_EXTS = new Set(["css", "less", "scss", "sass", "styl"]);

// ── agent.event (phase=runtime) ───────────────────────────────────────────────

export function handleAgentRuntimeEvent(e: {
  phase: string; projectId?: number;
  eventType: string; payload: Record<string, unknown>;
}): void {
  if (e.phase !== "runtime" || !e.projectId) return;
  const mgr = getLifecycleManager(e.projectId);
  const pl  = e.payload;
  switch (e.eventType) {
    case "process.started":
      mgr.transition("starting", `Process starting (pid: ${pl?.["pid"] ?? "?"})…`);
      break;
    case "process.crashed":
      mgr.forceTransition("crashed", String(pl?.["error"] ?? "Process crashed."), pl);
      break;
    case "process.stopped":
      if (mgr.getState() !== "building" && mgr.getState() !== "installing")
        mgr.forceTransition("idle", "Process stopped.");
      break;
    case "process.restarted":
      mgr.forceTransition("restarting", "Runtime restarting…");
      break;
  }
}

// ── file.change ───────────────────────────────────────────────────────────────

export function handleFileChange(e: {
  projectId: number; type: string; path: string;
}): void {
  const mgr  = getLifecycleManager(e.projectId);
  const curr = mgr.getState();
  const ext  = e.path.split(".").pop() ?? "";

  if (e.type === "writing") {
    const isSrc = ["ts","tsx","js","jsx","py","go","rs","css","html","scss","less"].includes(ext);
    if (!isSrc) return;
    if (curr === "ready") {
      if (CSS_EXTS.has(ext)) {
        mgr.transition("hot_reloading", `Hot-reloading ${e.path.split("/").pop()}…`, { path: e.path, cssOnly: true });
      } else {
        mgr.transition("updating", `Updating ${e.path.split("/").pop()}…`, { path: e.path });
      }
    }
    return;
  }
  if (e.type === "add" || e.type === "change") {
    if (curr === "updating") {
      mgr.transition("refreshing", "Refreshing preview…");
    } else if (curr === "hot_reloading" && CSS_EXTS.has(ext)) {
      mgr.forceTransition("ready", "CSS updated.", { hotReload: true });
    }
  }
}

// ── run.lifecycle ─────────────────────────────────────────────────────────────

export function handleRunLifecycle(e: { projectId: number; status: string }): void {
  const mgr = getLifecycleManager(e.projectId);
  switch (e.status) {
    case "started":   mgr.transition("starting", "Starting server…"); break;
    case "completed": mgr.forceTransition("ready", "Build complete."); break;
    case "failed":    mgr.forceTransition("crashed", "Agent run failed.", { status: e.status }); break;
    case "cancelled": mgr.forceTransition("idle", "Run cancelled."); break;
  }
}

// ── tool.execution ────────────────────────────────────────────────────────────

export function handleToolExecution(e: {
  projectId?: number; phase: string;
  toolCategory?: string; toolName?: string;
}): void {
  if (!e.projectId || e.phase !== "start") return;
  const mgr  = getLifecycleManager(e.projectId);
  const curr = mgr.getState();
  if (e.toolCategory === "file" || e.toolName?.startsWith("write_")) {
    if (curr === "idle" || curr === "ready") mgr.transition("building", "AI is writing code…");
    return;
  }
  if (e.toolName === "install_packages" || e.toolName?.includes("npm") || e.toolName?.includes("pip")) {
    if (curr !== "installing") mgr.forceTransition("installing", "Installing packages…");
    return;
  }
  if (e.toolName === "run_command" || e.toolName === "start_server") {
    if (curr === "building" || curr === "installing" || curr === "idle")
      mgr.transition("starting", "Starting server…");
  }
}

// ── runtime.observation ───────────────────────────────────────────────────────

export function handleRuntimeObservation(e: {
  projectId: number; status: string; port?: number;
  errorCount?: number; recentErrors?: string[];
}): void {
  const mgr  = getLifecycleManager(e.projectId);
  const curr = mgr.getState();
  if (e.status === "healthy") {
    if (curr === "starting") {
      mgr.forceTransition("verifying", `Verifying server on port ${e.port ?? "?"}…`, { port: e.port });
      setTimeout(() => {
        if (mgr.getState() === "verifying")
          mgr.forceTransition("ready", `Server ready on port ${e.port ?? "?"}.`, { port: e.port });
      }, 1200);
    } else if (curr !== "ready" && curr !== "verifying") {
      mgr.forceTransition("ready", `Server healthy on port ${e.port ?? "?"}.`, { port: e.port });
    }
    return;
  }
  if (e.status === "crashed" && curr !== "crashed" && curr !== "self_healing" && curr !== "debugging" && curr !== "patching") {
    const topErr = e.recentErrors?.[0] ?? "Process exited unexpectedly.";
    mgr.forceTransition("crashed", topErr, { errorCount: e.errorCount });
  }
}

// ── runtime.verified ──────────────────────────────────────────────────────────

export function handleRuntimeVerified(e: {
  projectId: number; outcome: string; port?: number; summary: string;
}): void {
  const mgr  = getLifecycleManager(e.projectId);
  const curr = mgr.getState();
  if (e.outcome === "healthy") {
    if (curr !== "ready") {
      if (curr === "starting" || curr === "restarting") {
        mgr.forceTransition("verifying", "Running health checks…", { port: e.port });
        setTimeout(() => {
          if (mgr.getState() === "verifying") mgr.forceTransition("ready", e.summary, { port: e.port });
        }, 800);
      } else {
        mgr.forceTransition("ready", e.summary, { port: e.port });
      }
    }
  } else if (e.outcome === "crashed" || e.outcome === "error") {
    mgr.forceTransition("crashed", e.summary);
  }
}

// ── runtime.port ──────────────────────────────────────────────────────────────

export function handleRuntimePort(e: {
  projectId?: number; phase: string; port?: number;
  retryCount?: number; latencyMs?: number; elapsed?: number;
}): void {
  if (!e.projectId) return;
  const mgr  = getLifecycleManager(e.projectId);
  const curr = mgr.getState();
  switch (e.phase) {
    case "waiting":
      if (curr === "starting" || curr === "restarting")
        mgr.forceTransition("verifying", `Waiting for port ${e.port} to accept connections…`, { port: e.port, retryCount: e.retryCount });
      break;
    case "ready":
      if (curr !== "ready" && curr !== "crashed")
        mgr.forceTransition("verifying", `Port ${e.port} accepting connections (${e.latencyMs ?? "?"}ms) — verifying server…`, { port: e.port, latencyMs: e.latencyMs });
      break;
    case "timeout":
    case "failed":
      mgr.forceTransition("crashed", `Port ${e.port} never became reachable after ${e.elapsed ?? "?"}ms (${e.retryCount ?? 0} retries).`, { port: e.port });
      break;
    case "cancelled":
      break;
  }
}

// ── debug.lifecycle ───────────────────────────────────────────────────────────

export function handleDebugLifecycle(e: {
  projectId: number; eventType: string; sessionId?: string; payload?: unknown;
}): void {
  const mgr  = getLifecycleManager(e.projectId);
  switch (e.eventType) {
    case "analyzing":
    case "reading_logs":
      mgr.forceTransition("debugging",    "AI is reading logs and diagnosing…",  { sessionId: e.sessionId }); break;
    case "self_healing_start":
      mgr.forceTransition("self_healing", "AI is analyzing the crash…",           { sessionId: e.sessionId }); break;
    case "patching":
    case "applying_patch":
      mgr.forceTransition("patching",     "AI is applying a targeted patch…",     { sessionId: e.sessionId }); break;
    case "restarting":
      mgr.forceTransition("restarting",   "Restarting after patch…",              { sessionId: e.sessionId }); break;
    case "complete":
    case "success":
      mgr.forceTransition("verifying",    "Verifying fix…",                       { sessionId: e.sessionId });
      setTimeout(() => {
        if (mgr.getState() === "verifying") mgr.forceTransition("ready", "Self-heal complete. Server is healthy.");
      }, 1000);
      break;
    case "failed":
      mgr.forceTransition("crashed", String((e.payload as any)?.error ?? "Self-heal failed.")); break;
  }
}

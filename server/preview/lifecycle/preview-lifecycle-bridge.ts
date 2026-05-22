/**
 * preview-lifecycle-bridge.ts — wires global bus events → lifecycle state machine.
 *
 * Listens for existing bus events and maps them to lifecycle transitions so every
 * event source drives the preview state automatically.
 *
 * New in v2:
 *   - debug.lifecycle events → self_healing / debugging / patching states
 *   - CSS-only file changes  → hot_reloading (no iframe reload needed)
 *   - tool.execution "start_server" → verifying intermediate state
 *   - runtime.verified → verifying → ready (two-step for visual feedback)
 */

import { bus } from "../../infrastructure/events/bus.ts";
import { getLifecycleManager } from "./preview-lifecycle.manager.ts";

const CSS_EXTS = new Set(["css", "less", "scss", "sass", "styl"]);

let mounted = false;

export function mountLifecycleBridge(): void {
  if (mounted) return;
  mounted = true;

  // ── agent.event (phase=runtime) → lifecycle state machine ──────────────────
  // Ensures direct processRegistry events (not going through previewOrchestrator)
  // still drive the lifecycle overlay correctly.
  bus.on("agent.event", (e) => {
    if (e.phase !== "runtime" || !e.projectId) return;
    const mgr = getLifecycleManager(e.projectId);
    const pl  = e.payload as Record<string, unknown>;

    switch (e.eventType) {
      case "process.started":
        mgr.transition("starting", `Process starting (pid: ${pl?.["pid"] ?? "?"})…`);
        break;
      case "process.crashed":
        mgr.forceTransition("crashed", String(pl?.["error"] ?? "Process crashed."), pl);
        break;
      case "process.stopped":
        // Only reset to idle if not already in a higher-level state
        if (mgr.getState() !== "building" && mgr.getState() !== "installing") {
          mgr.forceTransition("idle", "Process stopped.");
        }
        break;
      case "process.restarted":
        mgr.forceTransition("restarting", "Runtime restarting…");
        break;
    }
  });

  // ── file.change → building / updating / hot_reloading ──────────────────────
  bus.on("file.change", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.type === "writing") {
      const ext = e.path.split(".").pop() ?? "";
      const isSrc = ["ts","tsx","js","jsx","py","go","rs","css","html","scss","less"].includes(ext);
      if (!isSrc) return;

      if (curr === "ready") {
        // CSS-only change → hot_reloading (browser can patch without restart)
        if (CSS_EXTS.has(ext)) {
          mgr.transition("hot_reloading", `Hot-reloading ${e.path.split("/").pop()}…`, { path: e.path, cssOnly: true });
        } else {
          mgr.transition("updating", `Updating ${e.path.split("/").pop()}…`, { path: e.path });
        }
      }
      return;
    }

    if (e.type === "add" || e.type === "change") {
      const ext = e.path.split(".").pop() ?? "";
      if (curr === "updating") {
        mgr.transition("refreshing", "Refreshing preview…");
      } else if (curr === "hot_reloading" && CSS_EXTS.has(ext)) {
        // CSS write complete — snap back to ready (no iframe reload)
        mgr.forceTransition("ready", "CSS updated.", { hotReload: true });
      }
    }
  });

  // ── run.lifecycle → starting / verifying / crashed / idle ──────────────────
  bus.on("run.lifecycle", (e) => {
    const mgr = getLifecycleManager(e.projectId);
    switch (e.status) {
      case "started":
        mgr.transition("starting", "Starting server…");
        break;
      case "completed":
        mgr.forceTransition("ready", "Build complete.");
        break;
      case "failed":
        mgr.forceTransition("crashed", "Agent run failed.", { status: e.status });
        break;
      case "cancelled":
        mgr.forceTransition("idle", "Run cancelled.");
        break;
    }
  });

  // ── tool.execution → building / installing / starting / verifying ───────────
  bus.on("tool.execution", (e) => {
    if (!e.projectId) return;
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.phase !== "start") return;

    if (e.toolCategory === "file" || e.toolName?.startsWith("write_")) {
      if (curr === "idle" || curr === "ready") {
        mgr.transition("building", "AI is writing code…");
      }
      return;
    }

    if (e.toolName === "install_packages" || e.toolName?.includes("npm") || e.toolName?.includes("pip")) {
      if (curr !== "installing") {
        mgr.forceTransition("installing", "Installing packages…");
      }
      return;
    }

    if (e.toolName === "run_command" || e.toolName === "start_server") {
      if (curr === "building" || curr === "installing" || curr === "idle") {
        mgr.transition("starting", "Starting server…");
      }
    }
  });

  // ── runtime.observation → verifying / ready / crashed ──────────────────────
  bus.on("runtime.observation", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.status === "healthy") {
      if (curr === "starting") {
        // Two-step: starting → verifying → ready (visual feedback)
        mgr.forceTransition("verifying", `Verifying server on port ${e.port ?? "?"}…`, { port: e.port });
        setTimeout(() => {
          const nowState = mgr.getState();
          if (nowState === "verifying") {
            mgr.forceTransition("ready", `Server ready on port ${e.port ?? "?"}.`, { port: e.port });
          }
        }, 1200);
      } else if (curr !== "ready" && curr !== "verifying") {
        mgr.forceTransition("ready", `Server healthy on port ${e.port ?? "?"}.`, { port: e.port });
      }
      return;
    }

    if (e.status === "crashed" && curr !== "crashed" && curr !== "self_healing" && curr !== "debugging" && curr !== "patching") {
      const topErr = e.recentErrors[0] ?? "Process exited unexpectedly.";
      mgr.forceTransition("crashed", topErr, { errorCount: e.errorCount });
    }
  });

  // ── runtime.verified → verifying → ready / crashed ─────────────────────────
  bus.on("runtime.verified", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.outcome === "healthy") {
      if (curr !== "ready") {
        if (curr === "starting" || curr === "restarting") {
          mgr.forceTransition("verifying", "Running health checks…", { port: e.port });
          setTimeout(() => {
            if (mgr.getState() === "verifying") {
              mgr.forceTransition("ready", e.summary, { port: e.port });
            }
          }, 800);
        } else {
          mgr.forceTransition("ready", e.summary, { port: e.port });
        }
      }
    } else if (e.outcome === "crashed" || e.outcome === "error") {
      mgr.forceTransition("crashed", e.summary);
    }
  });

  // ── runtime.port → verifying / crashed ────────────────────────────────────
  // Driven by waitForPort() in the deterministic startup pipeline.
  // Translates TCP port-readiness phases into preview lifecycle states so the
  // frontend overlay shows "Waiting for port…" instead of blank/frozen UI.
  bus.on("runtime.port", (e) => {
    if (!e.projectId) return;
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    switch (e.phase) {
      // Port waiting — show verifying if we're already in starting/restarting
      case "waiting":
        if (curr === "starting" || curr === "restarting") {
          mgr.forceTransition(
            "verifying",
            `Waiting for port ${e.port} to accept connections…`,
            { port: e.port, retryCount: e.retryCount },
          );
        }
        break;

      // Port ready — stay in verifying (startup-verifier runs next)
      case "ready":
        if (curr !== "ready" && curr !== "crashed") {
          mgr.forceTransition(
            "verifying",
            `Port ${e.port} accepting connections (${e.latencyMs ?? "?"}ms) — verifying server…`,
            { port: e.port, latencyMs: e.latencyMs },
          );
        }
        break;

      // Timeout / fail-closed — crash the preview; recovery bridge will handle retry
      case "timeout":
      case "failed":
        mgr.forceTransition(
          "crashed",
          `Port ${e.port} never became reachable after ${e.elapsed ?? "?"}ms (${e.retryCount ?? 0} retries).`,
          { port: e.port },
        );
        break;

      // Cancelled — silently leave state as-is (external abort, not a crash)
      case "cancelled":
        break;
    }
  });

  // ── debug.lifecycle → self_healing / debugging / patching ──────────────────
  // Emitted by the crash-responder and AI self-heal agent to show live progress.
  bus.on("debug.lifecycle", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const phase = e.eventType;

    switch (phase) {
      case "analyzing":
      case "reading_logs":
        mgr.forceTransition("debugging",    "AI is reading logs and diagnosing…",  { sessionId: e.sessionId });
        break;
      case "self_healing_start":
        mgr.forceTransition("self_healing", "AI is analyzing the crash…",           { sessionId: e.sessionId });
        break;
      case "patching":
      case "applying_patch":
        mgr.forceTransition("patching",     "AI is applying a targeted patch…",     { sessionId: e.sessionId });
        break;
      case "restarting":
        mgr.forceTransition("restarting",   "Restarting after patch…",              { sessionId: e.sessionId });
        break;
      case "complete":
      case "success":
        mgr.forceTransition("verifying",    "Verifying fix…",                       { sessionId: e.sessionId });
        setTimeout(() => {
          if (mgr.getState() === "verifying") {
            mgr.forceTransition("ready", "Self-heal complete. Server is healthy.");
          }
        }, 1000);
        break;
      case "failed":
        mgr.forceTransition("crashed",      String((e.payload as any)?.error ?? "Self-heal failed."));
        break;
    }
  });
}

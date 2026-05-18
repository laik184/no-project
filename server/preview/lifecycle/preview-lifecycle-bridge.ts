/**
 * preview-lifecycle-bridge.ts — wires global bus events → lifecycle state machine.
 *
 * Listens for existing bus events (file.change, run.lifecycle, tool.execution,
 * runtime.observation) and maps them to lifecycle transitions so every
 * event source drives the preview state automatically.
 *
 * Mount once at server startup (called from preview.orchestrator.ts).
 * Low coupling: the bridge only imports bus + lifecycle manager — nothing else.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import { getLifecycleManager } from "./preview-lifecycle.manager.ts";

let mounted = false;

export function mountLifecycleBridge(): void {
  if (mounted) return;
  mounted = true;

  // ── file.change → building / updating ──────────────────────────────────────
  bus.on("file.change", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.type === "writing") {
      const ext = e.path.split(".").pop() ?? "";
      const isSrc = ["ts","tsx","js","jsx","py","go","rs","css","html"].includes(ext);
      if (isSrc && curr === "ready") {
        mgr.transition("updating", `Updating ${e.path.split("/").pop()}…`, { path: e.path });
      }
      return;
    }

    if (e.type === "add" || e.type === "change") {
      if (curr === "updating") {
        mgr.transition("refreshing", "Refreshing preview…");
      }
    }
  });

  // ── run.lifecycle → starting / crashed / idle ───────────────────────────────
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

  // ── tool.execution → building / installing ──────────────────────────────────
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

    if (e.toolName === "install_packages" || e.toolName?.includes("npm")) {
      if (curr !== "installing") {
        mgr.forceTransition("installing", "Installing packages…");
      }
      return;
    }

    if (e.toolName === "run_command" || e.toolName === "start_server") {
      const curr2 = mgr.getState();
      if (curr2 === "building" || curr2 === "installing" || curr2 === "idle") {
        mgr.transition("starting", "Starting server…");
      }
    }
  });

  // ── runtime.observation → ready / crashed ──────────────────────────────────
  bus.on("runtime.observation", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    const curr = mgr.getState();

    if (e.status === "healthy" && curr !== "ready") {
      mgr.forceTransition("ready", `Server ready on port ${e.port ?? "?"}.`, { port: e.port });
      return;
    }

    if (e.status === "crashed" && curr !== "crashed") {
      const topErr = e.recentErrors[0] ?? "Process exited unexpectedly.";
      mgr.forceTransition("crashed", topErr, { errorCount: e.errorCount });
    }
  });

  // ── runtime.verified → ready / crashed ─────────────────────────────────────
  bus.on("runtime.verified", (e) => {
    const mgr  = getLifecycleManager(e.projectId);
    if (e.outcome === "healthy") {
      mgr.forceTransition("ready", e.summary, { port: e.port });
    } else if (e.outcome === "crashed" || e.outcome === "error") {
      mgr.forceTransition("crashed", e.summary);
    }
  });
}

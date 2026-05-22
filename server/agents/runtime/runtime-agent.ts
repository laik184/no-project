/**
 * server/agents/runtime/runtime-agent.ts
 *
 * RuntimeAgent — dedicated agent for runtime observation, process monitoring,
 * and health analysis. Wraps the existing runtime observation infrastructure
 * with agent telemetry, event-driven reporting, and orchestration integration.
 *
 * Single responsibility: observe the sandbox runtime and report health.
 * Does NOT modify runtime — use RecoveryAgent for mutations.
 */

import { bus }                    from "../../infrastructure/events/bus.ts";
import { record }                 from "../../telemetry/index.ts";
import type {
  RuntimeObservationRequest,
  RuntimeObservationResult,
  RuntimeHealthStatus,
  PortStatus,
  ProcessMetrics,
} from "./types.ts";

const AGENT_NAME = "runtime-agent";

// ── Telemetry helpers ─────────────────────────────────────────────────────────

function emitEvent(
  eventType: string,
  runId: string,
  projectId: number,
  payload: Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "runtime.observation",
    agentName: AGENT_NAME,
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Port probe ────────────────────────────────────────────────────────────────

async function probePort(port: number): Promise<PortStatus> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const { createConnection } = require("net");
    const socket = createConnection({ port, host: "127.0.0.1" });
    const timer  = setTimeout(() => {
      socket.destroy();
      resolve({ port, open: false, latencyMs: Date.now() - t0, protocol: "tcp" });
    }, 2_000);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ port, open: true, latencyMs: Date.now() - t0, protocol: "tcp" });
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve({ port, open: false, latencyMs: Date.now() - t0, protocol: "tcp" });
    });
  });
}

// ── Runtime snapshot reader ───────────────────────────────────────────────────

async function getRuntimeSnapshot(projectId: number): Promise<{
  healthy: boolean;
  message: string;
  phase:   string;
}> {
  try {
    const { getRuntimeSnapshot: snap } = await import(
      "../../orchestration/execution/runtime-sync.ts"
    );
    return snap(projectId);
  } catch {
    return { healthy: false, message: "Runtime snapshot unavailable", phase: "unknown" };
  }
}

// ── Process metrics (best-effort) ─────────────────────────────────────────────

function getProcessMetrics(): ProcessMetrics {
  const mem = process.memoryUsage();
  return {
    uptime:     Math.floor(process.uptime()),
    cpuPercent: 0,   // requires native addon; skipped for portability
    memoryMb:   Math.round(mem.heapUsed / 1_048_576),
    restarts:   0,
  };
}

// ── Health classifier ─────────────────────────────────────────────────────────

function classifyHealth(
  snapshot: { healthy: boolean; phase: string },
  openPorts: PortStatus[],
  recentErrors: string[],
): RuntimeHealthStatus {
  if (!snapshot.healthy && recentErrors.length > 5) return "crashed";
  if (!snapshot.healthy) return "degraded";
  if (openPorts.length === 0 && snapshot.phase !== "idle") return "degraded";
  return "healthy";
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function observeRuntime(
  req: RuntimeObservationRequest,
): Promise<RuntimeObservationResult> {
  const { runId, projectId, trigger } = req;
  const t0 = Date.now();

  emitEvent("agent.started", runId, projectId, { trigger });
  record("agent.started", runId, projectId, { agentName: AGENT_NAME, trigger }, [AGENT_NAME]);

  try {
    // Parallel: snapshot + port probe + metrics
    const [snapshot, metrics] = await Promise.all([
      getRuntimeSnapshot(projectId),
      Promise.resolve(getProcessMetrics()),
    ]);

    let ports: PortStatus[] = [];
    if (req.includePorts !== false) {
      const commonPorts = [3000, 3001, 4000, 5000, 8080];
      ports = await Promise.all(commonPorts.map(probePort));
    }

    const openPorts    = ports.filter(p => p.open);
    const recentErrors: string[] = [];   // populated by log analysis if available
    const status       = classifyHealth(snapshot, openPorts, recentErrors);

    const llmSummary = [
      `Runtime is ${status}.`,
      snapshot.healthy
        ? `Phase: ${snapshot.phase}.`
        : `Issue: ${snapshot.message}.`,
      openPorts.length > 0
        ? `Open ports: ${openPorts.map(p => p.port).join(", ")}.`
        : "No open ports detected.",
      `Memory: ${metrics.memoryMb}MB. Uptime: ${metrics.uptime}s.`,
    ].join(" ");

    const result: RuntimeObservationResult = {
      projectId,
      runId,
      status,
      ports,
      metrics,
      recentErrors,
      startupDetected: snapshot.healthy,
      llmSummary,
      ts:          Date.now(),
      durationMs:  Date.now() - t0,
    };

    emitEvent("agent.completed", runId, projectId, { status, openPorts: openPorts.length });
    record("agent.completed", runId, projectId, {
      agentName: AGENT_NAME, status, openPorts: openPorts.length,
    }, [AGENT_NAME]);

    // Emit runtime.observation for downstream subscribers
    bus.emit("runtime.observation", {
      projectId,
      status,
      errorCount:  recentErrors.length,
      uptime:      metrics.uptime,
      openPorts:   openPorts.map(p => p.port),
      ts:          Date.now(),
    });

    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitEvent("agent.failed", runId, projectId, { error: msg, trigger });
    record("agent.started", runId, projectId, { agentName: AGENT_NAME, error: msg }, [AGENT_NAME]);

    return {
      projectId,
      runId,
      status:          "unknown",
      ports:           [],
      metrics:         getProcessMetrics(),
      recentErrors:    [msg],
      startupDetected: false,
      llmSummary:      `RuntimeAgent observation failed: ${msg}`,
      ts:              Date.now(),
      durationMs:      Date.now() - t0,
    };
  }
}

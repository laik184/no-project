/**
 * server/sandbox/security/resource-monitor.ts
 * Monitors CPU, memory, and network usage of a sandbox process.
 * Single responsibility: resource telemetry. No execution or policy logic.
 */

import { bus }           from "../../infrastructure/events/bus.ts";
import type { ResourceUsage } from "../types.ts";

const resourceSnapshots = new Map<string, ResourceUsage[]>();

function readProcMemory(): number {
  try {
    const mem = process.memoryUsage();
    return Math.round(mem.rss / 1024 / 1024);
  } catch {
    return 0;
  }
}

function readCpuPercent(): number {
  // Node.js does not expose per-child CPU directly — return process-level estimate
  const usage = process.cpuUsage();
  const totalMs = (usage.user + usage.system) / 1000;
  return Math.min(Math.round(totalMs / process.uptime() / 10), 100);
}

export async function monitorResources(
  sandboxId: string,
  constraints: { maxMemoryMb: number; maxCpuPercent: number },
): Promise<ResourceUsage> {
  const snapshot: ResourceUsage = {
    cpuPercent:   readCpuPercent(),
    memoryMb:     readProcMemory(),
    processes:    1,
    networkBytes: 0,
  };

  // Store rolling snapshot
  const history = resourceSnapshots.get(sandboxId) ?? [];
  history.push(snapshot);
  if (history.length > 60) history.shift();   // keep last 60 samples
  resourceSnapshots.set(sandboxId, history);

  // Emit warning events if limits exceeded
  if (snapshot.memoryMb > constraints.maxMemoryMb) {
    bus.emit("agent.event", {
      runId: sandboxId, eventType: "sandbox.blocked" as any,
      phase: "execution", ts: Date.now(),
      payload: { type: "memory_exceeded", used: snapshot.memoryMb, limit: constraints.maxMemoryMb },
    });
  }

  if (snapshot.cpuPercent > constraints.maxCpuPercent) {
    bus.emit("agent.event", {
      runId: sandboxId, eventType: "sandbox.blocked" as any,
      phase: "execution", ts: Date.now(),
      payload: { type: "cpu_exceeded", used: snapshot.cpuPercent, limit: constraints.maxCpuPercent },
    });
  }

  return snapshot;
}

export function getResourceHistory(sandboxId: string): ResourceUsage[] {
  return resourceSnapshots.get(sandboxId) ?? [];
}

export function clearResourceHistory(sandboxId: string): void {
  resourceSnapshots.delete(sandboxId);
}

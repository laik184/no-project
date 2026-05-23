/**
 * Responsibility: Telemetry for the distributed memory layer — write lifecycle,
 *                 conflict detection, rollback, and retry events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for distributed memory.
 */

import { bus }              from "../../infrastructure/events/bus.ts";
import type { MemoryEventType } from "./types/index.ts";

interface MemoryMetrics {
  started:   number;
  committed: number;
  conflicts: number;
  rolledBack: number;
  retried:   number;
}

class MemoryTelemetry {
  private readonly m: MemoryMetrics = {
    started: 0, committed: 0, conflicts: 0, rolledBack: 0, retried: 0,
  };

  onWriteStarted(txId: string, runId: string, key: string): void {
    this.m.started++;
    this.emit("memory.write.started", runId, { txId, key });
  }

  onWriteCommitted(txId: string, runId: string, key: string, version: number): void {
    this.m.committed++;
    this.emit("memory.write.committed", runId, { txId, key, version });
  }

  onConflict(txId: string, runId: string, key: string, local: number, remote: number): void {
    this.m.conflicts++;
    this.emit("memory.write.conflict", runId, { txId, key, localVersion: local, remoteVersion: remote });
  }

  onRolledBack(txId: string, runId: string, reason: string): void {
    this.m.rolledBack++;
    this.emit("memory.write.rolled_back", runId, { txId, reason });
  }

  onRetried(txId: string, runId: string, attempt: number): void {
    this.m.retried++;
    this.emit("memory.write.retried", runId, { txId, attempt });
  }

  snapshot(): MemoryMetrics { return { ...this.m }; }

  private emit(eventType: MemoryEventType, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.memory",
        agentName: "memory-telemetry",
        eventType, payload, ts: Date.now(),
      });
    } catch (err) { console.error("[memory-telemetry] Emit error:", err); }
  }
}

export const memoryTelemetry = new MemoryTelemetry();

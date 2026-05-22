/**
 * Responsibility: Distributed node synchronization — tracks which nodes have completed
 *                 across distributed wave executions and gates downstream nodes on their
 *                 dependency completion status. Complements the existing node-scheduler.ts.
 * Dependencies: distributed-sync-barrier (for barrier primitives)
 * Failure: unknown node lookups return "pending" safely; never throws on missing data.
 * Telemetry: sync.wait emitted when a node polls for dependency completion.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeSyncStatus = "pending" | "running" | "completed" | "failed";

export interface NodeSyncEntry {
  nodeId:      string;
  runId:       string;
  status:      NodeSyncStatus;
  startedAt?:  number;
  completedAt?: number;
  error?:      string;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

class DistributedNodeSync {
  /** runId → Map<nodeId, NodeSyncEntry> */
  private readonly store = new Map<string, Map<string, NodeSyncEntry>>();

  // ── Registration ───────────────────────────────────────────────────────────

  register(runId: string, nodeId: string): void {
    const run = this.getOrCreate(runId);
    run.set(nodeId, { nodeId, runId, status: "pending" });
  }

  markRunning(runId: string, nodeId: string): void {
    this.update(runId, nodeId, { status: "running", startedAt: Date.now() });
  }

  markCompleted(runId: string, nodeId: string): void {
    this.update(runId, nodeId, { status: "completed", completedAt: Date.now() });
  }

  markFailed(runId: string, nodeId: string, error: string): void {
    this.update(runId, nodeId, { status: "failed", completedAt: Date.now(), error });
  }

  // ── Dependency gating ──────────────────────────────────────────────────────

  /** Check if all dependencies for a node are completed. */
  depsCompleted(runId: string, dependsOn: string[]): boolean {
    const run = this.store.get(runId);
    if (!run) return dependsOn.length === 0;
    return dependsOn.every(dep => run.get(dep)?.status === "completed");
  }

  /** Check if any dependency has failed (fail-closed). */
  depsHaveFailed(runId: string, dependsOn: string[]): boolean {
    const run = this.store.get(runId);
    if (!run) return false;
    return dependsOn.some(dep => run.get(dep)?.status === "failed");
  }

  /**
   * Wait until all dependencies are completed or one fails.
   * Returns "ready" | "blocked" | "timeout".
   */
  async waitForDeps(
    runId:      string,
    nodeId:     string,
    dependsOn:  string[],
    maxWaitMs = 120_000,
    pollMs    = 200,
  ): Promise<"ready" | "blocked" | "timeout"> {
    if (dependsOn.length === 0) return "ready";

    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      if (this.depsHaveFailed(runId, dependsOn)) return "blocked";
      if (this.depsCompleted(runId, dependsOn))  return "ready";

      bus.emit("agent.event", {
        runId, projectId: 0,
        phase:     "distributed.sync",
        agentName: "distributed-node-sync",
        eventType: "sync.wait",
        payload:   { nodeId, dependsOn, waiting: true },
        ts:        Date.now(),
      });

      await new Promise<void>(r => setTimeout(r, pollMs));
    }

    return "timeout";
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  clearRun(runId: string): void {
    this.store.delete(runId);
  }

  status(runId: string, nodeId: string): NodeSyncStatus {
    return this.store.get(runId)?.get(nodeId)?.status ?? "pending";
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private getOrCreate(runId: string): Map<string, NodeSyncEntry> {
    if (!this.store.has(runId)) this.store.set(runId, new Map());
    return this.store.get(runId)!;
  }

  private update(runId: string, nodeId: string, patch: Partial<NodeSyncEntry>): void {
    const run     = this.getOrCreate(runId);
    const existing = run.get(nodeId) ?? { nodeId, runId, status: "pending" as NodeSyncStatus };
    run.set(nodeId, { ...existing, ...patch });
  }
}

export const distributedNodeSync = new DistributedNodeSync();

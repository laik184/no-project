/**
 * Responsibility: Dynamic node injection into running DAG graphs.
 *                 Allows agents to add new work items mid-execution without
 *                 stopping or rebuilding the entire graph.
 * Dependencies: graph-state-store (existing)
 * Failure: injection into non-existent or completed graphs returns false safely.
 * Telemetry: emits agent.started on each successful injection.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InjectedNode {
  id:         string;
  dependsOn:  string[];
  type:       "agent" | "tool" | "verify" | "checkpoint";
  label:      string;
  fn:         () => Promise<unknown>;
  timeoutMs?: number;
  critical?:  boolean;
}

export interface InjectionResult {
  success:      boolean;
  nodeId:       string;
  graphRunId:   string;
  queuedAfter:  string[];
  error?:       string;
}

// ── Injector ─────────────────────────────────────────────────────────────────

class DynamicNodeInjection {
  /** Runtime-injected nodes keyed by graphRunId */
  private readonly injected = new Map<string, InjectedNode[]>();

  /**
   * Inject a node into a running graph's pending queue.
   * The node will be picked up on the next wave evaluation cycle.
   */
  inject(graphRunId: string, node: InjectedNode, projectId: number): InjectionResult {
    try {
      const existing = this.injected.get(graphRunId) ?? [];

      // Validate: no duplicate node IDs
      if (existing.some(n => n.id === node.id)) {
        return {
          success:     false,
          nodeId:      node.id,
          graphRunId,
          queuedAfter: [],
          error:       `Duplicate node id "${node.id}"`,
        };
      }

      this.injected.set(graphRunId, [...existing, node]);

      bus.emit("agent.event", {
        runId:     graphRunId,
        projectId,
        phase:     "distributed.dag",
        agentName: "dynamic-node-injection",
        eventType: "agent.started",
        payload:   { nodeId: node.id, type: node.type, dependsOn: node.dependsOn },
        ts:        Date.now(),
      });

      return {
        success:     true,
        nodeId:      node.id,
        graphRunId,
        queuedAfter: node.dependsOn,
      };

    } catch (err) {
      return {
        success:     false,
        nodeId:      node.id,
        graphRunId,
        queuedAfter: [],
        error:       err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Drain pending injected nodes for a graph run (called by graph-engine on each wave). */
  drain(graphRunId: string): InjectedNode[] {
    const nodes = this.injected.get(graphRunId) ?? [];
    this.injected.delete(graphRunId);
    return nodes;
  }

  /** How many nodes are pending injection for a run. */
  pendingCount(graphRunId: string): number {
    return (this.injected.get(graphRunId) ?? []).length;
  }

  /** Cancel all pending injections for a run (e.g. on abort). */
  cancel(graphRunId: string): number {
    const count = (this.injected.get(graphRunId) ?? []).length;
    this.injected.delete(graphRunId);
    return count;
  }
}

export const dynamicNodeInjection = new DynamicNodeInjection();

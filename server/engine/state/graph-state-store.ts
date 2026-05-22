/**
 * graph-state-store.ts
 *
 * Per-run active graph registry.
 * Allows any module to look up a live ExecutionGraph by runId.
 * Supports graph lifecycle: register → active → complete/failed → evict.
 *
 * Single responsibility: graph state lookup. No execution logic.
 */

import type { ExecutionGraph, GraphStatus } from "../graph/graph-types.ts";

// ── Registry ──────────────────────────────────────────────────────────────────

const MAX_ACTIVE = 25;

class GraphStateStore {
  private graphs = new Map<string, ExecutionGraph>();
  private order: string[] = [];

  register(graph: ExecutionGraph): void {
    if (this.graphs.has(graph.id)) return;
    this.graphs.set(graph.id, graph);
    this.order.push(graph.id);
    // Evict oldest if over limit (completed/failed only)
    if (this.order.length > MAX_ACTIVE) {
      for (const runId of this.order) {
        const g = this.graphs.get(runId);
        if (g && ["complete", "failed", "rolled-back"].includes(g.status)) {
          this.evict(runId);
          break;
        }
      }
    }
    console.log(`[graph-state-store] Registered run=${graph.id.slice(0,8)} total=${this.graphs.size}`);
  }

  get(runId: string): ExecutionGraph | undefined {
    return this.graphs.get(runId);
  }

  list(): ExecutionGraph[] {
    return [...this.graphs.values()];
  }

  listByProject(projectId: number): ExecutionGraph[] {
    return [...this.graphs.values()].filter(g => g.projectId === projectId);
  }

  listByStatus(status: GraphStatus): ExecutionGraph[] {
    return [...this.graphs.values()].filter(g => g.status === status);
  }

  evict(runId: string): boolean {
    if (!this.graphs.has(runId)) return false;
    this.graphs.delete(runId);
    this.order = this.order.filter(id => id !== runId);
    console.log(`[graph-state-store] Evicted run=${runId.slice(0,8)} remaining=${this.graphs.size}`);
    return true;
  }

  snapshot(): {
    total:    number;
    running:  number;
    complete: number;
    failed:   number;
  } {
    const all = [...this.graphs.values()];
    return {
      total:    all.length,
      running:  all.filter(g => g.status === "running").length,
      complete: all.filter(g => g.status === "complete").length,
      failed:   all.filter(g => g.status === "failed").length,
    };
  }
}

export const graphStateStore = new GraphStateStore();

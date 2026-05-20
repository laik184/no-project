/**
 * node-scheduler.ts
 *
 * Wave-based scheduler that determines execution waves from the DAG.
 * Each wave contains the maximum set of nodes that can execute in parallel
 * while respecting all dependency constraints.
 */

import { getReadyNodes, getBlockedNodes } from "./dependency-resolver.ts";
import { MAX_PARALLEL }                   from "./graph-types.ts";
import type { ExecutionGraph, ExecutionNode } from "./graph-types.ts";

export interface SchedulerWave {
  waveIndex:  number;
  nodes:      ExecutionNode[];
  isParallel: boolean;
  estimatedMs:number;
}

// ── Wave builder ──────────────────────────────────────────────────────────────

/**
 * Build the complete execution schedule as a sequence of waves.
 * Does NOT execute — purely analysis for estimation/display.
 */
export function buildSchedule(graph: ExecutionGraph): SchedulerWave[] {
  const waves:     SchedulerWave[] = [];
  const simDone   = new Set<string>();
  const simFailed = new Set<string>();

  let iteration = 0;
  const maxIter  = graph.nodes.size + 1;

  while (iteration++ < maxIter) {
    const ready: ExecutionNode[] = [];

    for (const node of graph.nodes.values()) {
      if (simDone.has(node.id) || simFailed.has(node.id)) continue;

      const andMet = node.dependsOn.every(dep => simDone.has(dep));
      if (!andMet) continue;

      const blocked = node.dependsOn.some(dep => simFailed.has(dep));
      if (blocked) { simFailed.add(node.id); continue; }

      ready.push(node);
    }

    if (ready.length === 0) break;

    const wave: SchedulerWave = {
      waveIndex:   waves.length,
      nodes:       ready.slice(0, MAX_PARALLEL),
      isParallel:  ready.length > 1,
      estimatedMs: 5_000,   // default estimate per wave
    };

    waves.push(wave);
    ready.forEach(n => simDone.add(n.id));
  }

  return waves;
}

/** Get the next wave of ready nodes, respecting MAX_PARALLEL. */
export function getNextWave(graph: ExecutionGraph): ExecutionNode[] {
  const ready = getReadyNodes(graph);
  return ready.slice(0, MAX_PARALLEL);
}

/** How many more waves remain (estimate). */
export function remainingWaves(graph: ExecutionGraph): number {
  const schedule = buildSchedule(graph);
  const doneCount = graph.completedIds.size;
  let acc = 0;
  let waveIndex = 0;
  for (const wave of schedule) {
    acc += wave.nodes.length;
    if (acc >= doneCount) return schedule.length - waveIndex;
    waveIndex++;
  }
  return 0;
}

/** Human-readable schedule description. */
export function describeSchedule(waves: SchedulerWave[]): string {
  return waves.map(w =>
    `Wave ${w.waveIndex + 1}: [${w.nodes.map(n => n.label).join(" | ")}]${w.isParallel ? " (parallel)" : ""}`,
  ).join("\n");
}

// ── Scheduler event emitter ───────────────────────────────────────────────────

export interface SchedulerEvents {
  onWaveStart:  (wave: SchedulerWave, waveIndex: number) => void;
  onWaveEnd:    (waveIndex: number, passed: number, failed: number) => void;
  onGraphDone:  (totalWaves: number) => void;
  onGraphFailed:(failedNodeId: string, reason: string) => void;
}

export function createSchedulerEvents(partial: Partial<SchedulerEvents>): SchedulerEvents {
  return {
    onWaveStart:   partial.onWaveStart  ?? (() => {}),
    onWaveEnd:     partial.onWaveEnd    ?? (() => {}),
    onGraphDone:   partial.onGraphDone  ?? (() => {}),
    onGraphFailed: partial.onGraphFailed ?? (() => {}),
  };
}

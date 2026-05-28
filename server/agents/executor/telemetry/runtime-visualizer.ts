/**
 * server/agents/executor/telemetry/runtime-visualizer.ts
 *
 * Read-only runtime introspection facade.
 * Aggregates data from execution-timeline, workflow-tracer, execution-monitor,
 * failure-monitor, working-memory, and execution-state-machine to produce a
 * single unified snapshot for API surfaces and debugging.
 *
 * Never imports from tool layer. Read-only projection only.
 */

import { executionTimeline }      from './execution-timeline.ts';
import { workflowTracer }         from './workflow-tracer.ts';
import { executionMonitor }       from '../monitoring/execution-monitor.ts';
import { failureMonitor }         from '../monitoring/failure-monitor.ts';
import { executionStateMachine }  from '../runtime/execution-state-machine.ts';
import { workingMemory }          from '../memory/working-memory.ts';

// ── Snapshot shapes ───────────────────────────────────────────────────────────

export interface WorkflowSnapshot {
  runId:          string;
  state:          string;
  progressPct:    number;
  activeStepId?:  string;
  retries:        number;
  recoveries:     number;
  isStuck:        boolean;
  durationMs:     number;
  timelineLog:    string[];
  traceText:      string[];
  modifiedFiles:  string[];
}

export interface RuntimeSummary {
  activeWorkflows:   number;
  totalRetries:      number;
  totalRecoveries:   number;
  stuckWorkflows:    string[];
  failureSummary:    ReturnType<typeof failureMonitor.summary>;
  workflows:         WorkflowSnapshot[];
}

export interface FailureGraph {
  nodes: Array<{ id: string; label: string; occurrences: number; category: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const runtimeVisualizer = {
  /** Full snapshot for a specific run. */
  snapshotRun(runId: string): WorkflowSnapshot {
    const monSnap  = executionMonitor.snapshot(runId);
    const smSnap   = executionStateMachine.snapshot(runId);
    const wm       = workingMemory.get(runId);
    const timeline = executionTimeline.getTimeline(runId);
    const firstTs  = timeline[0]?.ts ?? Date.now();

    return {
      runId,
      state:         smSnap?.state ?? 'UNKNOWN',
      progressPct:   monSnap?.progressPct ?? 0,
      activeStepId:  monSnap?.activeStepId,
      retries:       executionTimeline.retryCount(runId),
      recoveries:    executionTimeline.recoveryCount(runId),
      isStuck:       executionMonitor.isStuck(runId),
      durationMs:    Date.now() - firstTs,
      timelineLog:   executionTimeline.toLog(runId),
      traceText:     workflowTracer.toText(runId),
      modifiedFiles: wm ? [...wm.modifiedFiles] : [],
    };
  },

  /** Summary of all active workflows. */
  runtimeSummary(): RuntimeSummary {
    const active    = executionStateMachine.allActive();
    const snapshots = active.map((e) => this.snapshotRun(e.runId));
    const stuck     = snapshots.filter((s) => s.isStuck).map((s) => s.runId);

    return {
      activeWorkflows: active.length,
      totalRetries:    snapshots.reduce((s, w) => s + w.retries, 0),
      totalRecoveries: snapshots.reduce((s, w) => s + w.recoveries, 0),
      stuckWorkflows:  stuck,
      failureSummary:  failureMonitor.summary(),
      workflows:       snapshots,
    };
  },

  /** Active workflow states summary. */
  activeWorkflows(): Array<{ runId: string; state: string; progressPct: number }> {
    return executionStateMachine.allActive().map((e) => ({
      runId:       e.runId,
      state:       e.state,
      progressPct: executionMonitor.snapshot(e.runId)?.progressPct ?? 0,
    }));
  },

  /** Build a failure graph from all known failure patterns. */
  failureGraph(): FailureGraph {
    const allFailures = failureMonitor.allFailures();
    const nodeMap     = new Map<string, { occurrences: number; category: string }>();
    const edges:      FailureGraph['edges'] = [];

    for (const f of allFailures) {
      const toolKey = `tool:${f.toolName}`;
      const kindKey = `kind:${f.kind}`;
      nodeMap.set(toolKey, { occurrences: (nodeMap.get(toolKey)?.occurrences ?? 0) + 1, category: 'tool' });
      nodeMap.set(kindKey, { occurrences: (nodeMap.get(kindKey)?.occurrences ?? 0) + 1, category: 'kind' });
      edges.push({ from: kindKey, to: toolKey, label: f.error.slice(0, 40) });
    }

    const nodes = [...nodeMap.entries()].map(([id, v]) => ({
      id, label: id.split(':')[1] ?? id, occurrences: v.occurrences, category: v.category,
    }));

    return { nodes, edges };
  },

  /** Telemetry summary for a run suitable for SSE broadcast. */
  telemetrySummary(runId: string): Record<string, unknown> {
    const snap = this.snapshotRun(runId);
    return {
      runId:        snap.runId,
      state:        snap.state,
      progressPct:  snap.progressPct,
      retries:      snap.retries,
      recoveries:   snap.recoveries,
      isStuck:      snap.isStuck,
      durationMs:   snap.durationMs,
      modifiedFiles: snap.modifiedFiles.length,
    };
  },
};

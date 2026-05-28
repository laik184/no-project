/**
 * server/agents/planner/planning/task-graph-builder.ts
 *
 * Converts a goal + task list into a proper execution DAG with:
 *   - phases
 *   - explicit + inferred dependencies
 *   - parallel execution groups (waves)
 *   - validation checkpoints between phases
 *   - risk annotations
 *
 * Builds on dependency-analyzer.ts and risk-estimator.ts.
 * No tool imports. No execution.
 */

import type { PlannedTask, ExecutionPhase } from '../types/planner.types.ts';
import { analyzeDependencies, removeCyclicTasks } from '../reasoning/dependency-analyzer.ts';
import { estimateRisk }                           from '../reasoning/risk-estimator.ts';

// ── DAG types ──────────────────────────────────────────────────────────────────

export interface DagNode {
  taskId:       string;
  label:        string;
  phaseIndex:   number;
  waveIndex:    number;
  toolName:     string;
  priority:     string;
  deps:         string[];
  isCheckpoint: boolean;
  riskLevel:    string;
}

export interface DagEdge {
  from:  string;
  to:    string;
  kind:  'explicit' | 'inferred' | 'checkpoint';
}

export interface ExecutionDag {
  planId:    string;
  goal:      string;
  nodes:     DagNode[];
  edges:     DagEdge[];
  phases:    ExecutionPhase[];
  waves:     DagNode[][];     // parallel execution groups
  riskScore: number;
  riskLevel: string;
  hasCycles: boolean;
  safeToRun: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _makeCheckpointTask(phaseIndex: number, depIds: string[]): PlannedTask {
  return {
    id:           `checkpoint_phase_${phaseIndex}`,
    label:        `Phase ${phaseIndex} validation checkpoint`,
    description:  `Verify integrity after phase ${phaseIndex}`,
    phase:        phaseIndex,
    priority:     'high',
    dependencies: depIds,
    toolName:     'run_typecheck',
    input:        { phaseIndex },
    timeoutMs:    30_000,
    retryLimit:   1,
    estimatedMs:  5_000,
  };
}

function _groupByPhase(tasks: PlannedTask[]): Map<number, PlannedTask[]> {
  const map = new Map<number, PlannedTask[]>();
  for (const t of tasks) {
    const group = map.get(t.phase) ?? [];
    group.push(t);
    map.set(t.phase, group);
  }
  return map;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildTaskGraph(
  planId:  string,
  goal:    string,
  tasks:   PlannedTask[],
  options: { insertCheckpoints?: boolean } = {},
): ExecutionDag {
  const { insertCheckpoints = true } = options;

  // Risk analysis
  const risk    = estimateRisk(goal, tasks);

  // Dependency analysis + cycle removal
  const depAnalysis = analyzeDependencies(tasks);
  const safeTasks   = depAnalysis.hasCycles ? removeCyclicTasks(tasks, depAnalysis) : tasks;

  // Re-analyze after cycle removal
  const finalDep    = analyzeDependencies(safeTasks);

  // Optionally insert validation checkpoints between phases
  let allTasks = [...safeTasks];
  if (insertCheckpoints && risk.requiresCheckpoint) {
    const phaseMap = _groupByPhase(safeTasks);
    const phases   = [...phaseMap.keys()].sort((a, b) => a - b);
    for (let i = 0; i < phases.length - 1; i++) {
      const phaseId      = phases[i];
      const phaseTasks   = phaseMap.get(phaseId) ?? [];
      const checkpointDeps = phaseTasks.map((t) => t.id);
      allTasks.push(_makeCheckpointTask(phaseId, checkpointDeps));
    }
  }

  // Final dependency analysis with checkpoints
  const fullDep = analyzeDependencies(allTasks);

  // Build nodes
  const nodes: DagNode[] = allTasks.map((t) => {
    const waveIdx = fullDep.parallelGroups.findIndex((g) => g.includes(t.id));
    return {
      taskId:       t.id,
      label:        t.label,
      phaseIndex:   t.phase,
      waveIndex:    waveIdx >= 0 ? waveIdx : 0,
      toolName:     t.toolName,
      priority:     t.priority,
      deps:         t.dependencies ?? [],
      isCheckpoint: t.id.startsWith('checkpoint_'),
      riskLevel:    risk.overall,
    };
  });

  // Build edges
  const edges: DagEdge[] = fullDep.edges.map((e) => ({
    from: e.from, to: e.to,
    kind: e.kind === 'explicit' ? 'explicit' : 'inferred',
  }));
  // Checkpoint edges
  for (const node of nodes.filter((n) => n.isCheckpoint)) {
    for (const dep of node.deps) {
      edges.push({ from: node.taskId, to: dep, kind: 'checkpoint' });
    }
  }

  // Build execution phases
  const phaseMap2 = _groupByPhase(allTasks);
  const phases: ExecutionPhase[] = [...phaseMap2.keys()].sort((a, b) => a - b).map((phaseIdx) => {
    const phaseTasks = phaseMap2.get(phaseIdx)!;
    return {
      index:       phaseIdx,
      label:       `Phase ${phaseIdx}`,
      tasks:       phaseTasks,
      strategy:    phaseTasks.length > 1 ? 'wave' : 'sequential',
      canParallel: phaseTasks.length > 1,
    };
  });

  // Build waves (parallel groups mapped to nodes)
  const waves: DagNode[][] = fullDep.parallelGroups.map((group) =>
    nodes.filter((n) => group.includes(n.taskId)),
  );

  return {
    planId, goal, nodes, edges, phases, waves,
    riskScore: risk.score,
    riskLevel: risk.overall,
    hasCycles: depAnalysis.hasCycles,
    safeToRun: !depAnalysis.hasCycles && safeTasks.length > 0,
  };
}

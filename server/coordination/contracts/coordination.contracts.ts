/**
 * coordination.contracts.ts
 *
 * Type contracts for the coordination layer: plans, contexts, results.
 * Single responsibility: shape definitions only — no logic, no imports.
 */

import type { SpecialistTask, SpecialistResult, FilePatch } from "./specialist.contracts.ts";

// ── Dependency graph ──────────────────────────────────────────────────────────

export interface DependencyEdge {
  /** taskId that depends on `dependsOn`. */
  from:      string;
  /** taskId that must complete first. */
  dependsOn: string;
}

/**
 * A computed DAG of specialist tasks.
 * waves[i] contains taskIds that can execute concurrently.
 * wave[i+1] only starts after all of wave[i] completes.
 */
export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
  /** Topologically sorted groups — each group is safe to run in parallel. */
  waves: string[][];
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export interface DecomposedPlan {
  runId:          string;
  projectId:      number;
  goal:           string;
  tasks:          SpecialistTask[];
  dependencyGraph: DependencyGraph;
  estimatedWaves: number;
  createdAt:      number;
}

// ── Execution context ─────────────────────────────────────────────────────────

/**
 * Mutable coordination context scoped to a single run.
 * Passed by reference through all wave executions.
 * Owned by ExecutionContextFactory — never mutated by specialist code.
 */
export interface CoordinationContext {
  runId:            string;
  projectId:        number;
  goal:             string;
  plan:             DecomposedPlan;
  activeTaskIds:    Set<string>;
  completedTaskIds: Set<string>;
  failedTaskIds:    Set<string>;
  results:          Map<string, SpecialistResult>;
  startedAt:        number;
  abortController:  AbortController;
}

// ── Wave results ──────────────────────────────────────────────────────────────

export interface WaveExecutionResult {
  waveIndex:  number;
  taskIds:    string[];
  results:    SpecialistResult[];
  succeeded:  number;
  failed:     number;
  durationMs: number;
}

// ── Merge plan ────────────────────────────────────────────────────────────────

export interface PatchGroup {
  filePath:  string;
  patches:   FilePatch[];
  hasConflict: boolean;
  /** The winning patch selected by conflict resolution. */
  winner?:   FilePatch;
}

export interface MergePlan {
  runId:       string;
  groups:      PatchGroup[];
  conflictCount: number;
  safeCount:   number;
}

// ── Final result ──────────────────────────────────────────────────────────────

export interface CoordinationResult {
  runId:             string;
  projectId:         number;
  success:           boolean;
  results:           SpecialistResult[];
  mergedPatches:     FilePatch[];
  durationMs:        number;
  wavesExecuted:     number;
  specialistsRan:    number;
  parallelismFactor: number;
  error?:            string;
}

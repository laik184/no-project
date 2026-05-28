/**
 * server/orchestration/swarm/intent-graph/intent-graph-types.ts
 *
 * Type definitions for the intent graph used by the swarm routing layer.
 * Orchestration-only — no tool execution, no filesystem access.
 */

// ── Intent node ───────────────────────────────────────────────────────────────

export type IntentNodeStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'skipped';

export type IntentNodeKind =
  | 'code'
  | 'verify'
  | 'plan'
  | 'search'
  | 'analyze'
  | 'custom';

export interface IntentNode {
  id:           string;
  kind:         IntentNodeKind;
  label:        string;
  description?: string;
  status:       IntentNodeStatus;
  dependencies: string[];
  priority:     number;
  meta:         Record<string, unknown>;
}

// ── Intent graph ──────────────────────────────────────────────────────────────

export interface IntentGraph {
  id:       string;
  runId:    string;
  nodes:    IntentNode[];
  waves:    string[][];
  createdAt: number;
  meta:     Record<string, unknown>;
}

// ── Builder helpers ───────────────────────────────────────────────────────────

export function makeIntentNode(
  partial: Pick<IntentNode, 'id' | 'kind' | 'label'> & Partial<IntentNode>,
): IntentNode {
  return {
    status:       'pending',
    dependencies: [],
    priority:     0,
    meta:         {},
    description:  '',
    ...partial,
  };
}

export function makeIntentGraph(
  runId: string,
  nodes: IntentNode[],
  meta: Record<string, unknown> = {},
): IntentGraph {
  return {
    id:        `ig-${runId}-${Date.now()}`,
    runId,
    nodes,
    waves:     computeWaves(nodes),
    createdAt: Date.now(),
    meta,
  };
}

// ── Topological wave computation ──────────────────────────────────────────────

function computeWaves(nodes: IntentNode[]): string[][] {
  const remaining = new Set(nodes.map(n => n.id));
  const completed = new Set<string>();
  const waves:      string[][] = [];

  while (remaining.size > 0) {
    const wave: string[] = [];

    for (const node of nodes) {
      if (!remaining.has(node.id)) continue;
      const depsOk = node.dependencies.every(d => completed.has(d));
      if (depsOk) wave.push(node.id);
    }

    if (wave.length === 0) break; // cycle guard

    for (const id of wave) {
      remaining.delete(id);
      completed.add(id);
    }

    waves.push(wave);
  }

  return waves;
}

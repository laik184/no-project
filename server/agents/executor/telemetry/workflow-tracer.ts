/**
 * server/agents/executor/telemetry/workflow-tracer.ts
 *
 * Full request-to-completion workflow tracer.
 * Builds a structured trace tree from:
 *   request → plan → phase → step → tool → validation → completion
 *
 * Each trace node records timing, outcome, and child nodes.
 * Exposed for debugging, observability APIs, and visualizer input.
 *
 * No execution logic. No tool imports.
 */

// ── Trace node ────────────────────────────────────────────────────────────────

export type TraceNodeKind =
  | 'run'
  | 'plan'
  | 'phase'
  | 'step'
  | 'tool'
  | 'validation'
  | 'recovery'
  | 'rollback';

export type TraceNodeStatus = 'open' | 'ok' | 'failed' | 'skipped' | 'cancelled';

export interface TraceNode {
  id:           string;
  parentId?:    string;
  runId:        string;
  kind:         TraceNodeKind;
  label:        string;
  status:       TraceNodeStatus;
  startedAt:    number;
  completedAt?: number;
  durationMs?:  number;
  error?:       string;
  meta?:        Record<string, unknown>;
  children:     TraceNode[];
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _traces = new Map<string, TraceNode>();    // nodeId → node
const _roots  = new Map<string, TraceNode>();    // runId  → root node
let   _seq    = 0;

function _id(kind: TraceNodeKind): string {
  return `tr_${kind}_${++_seq}`;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const workflowTracer = {
  /** Start a root trace for a run. Returns root node id. */
  startRun(runId: string, goal: string): string {
    const node: TraceNode = {
      id: _id('run'), parentId: undefined, runId,
      kind: 'run', label: goal, status: 'open',
      startedAt: Date.now(), children: [],
    };
    _traces.set(node.id, node);
    _roots.set(runId, node);
    return node.id;
  },

  /** Open a child trace node under a parent. Returns child node id. */
  openNode(
    runId:    string,
    parentId: string,
    kind:     TraceNodeKind,
    label:    string,
    meta?:    Record<string, unknown>,
  ): string {
    const parent = _traces.get(parentId);
    const node: TraceNode = {
      id: _id(kind), parentId, runId, kind, label,
      status: 'open', startedAt: Date.now(), children: [], meta,
    };
    _traces.set(node.id, node);
    if (parent) parent.children.push(node);
    return node.id;
  },

  /** Close a trace node as ok or failed. */
  closeNode(
    nodeId:    string,
    status:    Exclude<TraceNodeStatus, 'open'>,
    error?:    string,
    meta?:     Record<string, unknown>,
  ): void {
    const node = _traces.get(nodeId);
    if (!node || node.status !== 'open') return;
    node.status      = status;
    node.completedAt = Date.now();
    node.durationMs  = node.completedAt - node.startedAt;
    if (error) node.error = error;
    if (meta)  Object.assign(node.meta ?? (node.meta = {}), meta);
  },

  getRoot(runId: string): TraceNode | undefined {
    return _roots.get(runId);
  },

  getNode(nodeId: string): TraceNode | undefined {
    return _traces.get(nodeId);
  },

  /** Flatten the trace tree to an ordered list (depth-first). */
  flatten(runId: string): TraceNode[] {
    const root = _roots.get(runId);
    if (!root) return [];
    const result: TraceNode[] = [];
    const walk = (node: TraceNode) => {
      result.push(node);
      for (const child of node.children) walk(child);
    };
    walk(root);
    return result;
  },

  /** Return a compact text representation. */
  toText(runId: string, indent = 0): string[] {
    const root = _roots.get(runId);
    if (!root) return [];
    const lines: string[] = [];
    const walk = (node: TraceNode, depth: number) => {
      const pad    = '  '.repeat(depth);
      const dur    = node.durationMs !== undefined ? ` ${node.durationMs}ms` : '';
      const status = node.status === 'open' ? '⏳' : node.status === 'ok' ? '✓' : node.status === 'failed' ? '✗' : '–';
      lines.push(`${pad}${status} [${node.kind}] ${node.label}${dur}`);
      for (const child of node.children) walk(child, depth + 1);
    };
    walk(root, indent);
    return lines;
  },

  clear(runId: string): void {
    const root = _roots.get(runId);
    if (root) {
      const walk = (n: TraceNode) => { _traces.delete(n.id); n.children.forEach(walk); };
      walk(root);
    }
    _roots.delete(runId);
  },

  reset(): void { _traces.clear(); _roots.clear(); _seq = 0; },
  size():  number { return _roots.size; },
};

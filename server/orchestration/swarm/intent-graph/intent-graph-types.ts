export type IntentNodeType =
  | 'analyze'
  | 'plan'
  | 'execute'
  | 'verify'
  | 'browser'
  | 'fix'
  | 'complete';

export type IntentNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface IntentNode {
  id: string;
  type: IntentNodeType;
  label: string;
  status: IntentNodeStatus;
  dependsOn: string[];
  metadata: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface IntentEdge {
  from: string;
  to: string;
  label?: string;
}

export interface IntentGraph {
  graphId: string;
  runId: string;
  nodes: IntentNode[];
  edges: IntentEdge[];
  createdAt: Date;
  goal: string;
}

export function createIntentGraph(runId: string, goal: string): IntentGraph {
  return {
    graphId: `graph_${runId}`,
    runId,
    nodes: [],
    edges: [],
    createdAt: new Date(),
    goal,
  };
}

export function addNode(graph: IntentGraph, node: Omit<IntentNode, 'status' | 'metadata'>): IntentNode {
  const n: IntentNode = { ...node, status: 'pending', metadata: {} };
  graph.nodes.push(n);
  return n;
}

export function addEdge(graph: IntentGraph, from: string, to: string, label?: string): void {
  graph.edges.push({ from, to, label });
}

export function getNode(graph: IntentGraph, id: string): IntentNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function getReadyNodes(graph: IntentGraph): IntentNode[] {
  const completed = new Set(graph.nodes.filter((n) => n.status === 'completed').map((n) => n.id));
  return graph.nodes.filter(
    (n) => n.status === 'pending' && n.dependsOn.every((dep) => completed.has(dep))
  );
}

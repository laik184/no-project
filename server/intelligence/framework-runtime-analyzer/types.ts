export type RuntimeFramework = 'express' | 'nestjs' | 'react' | 'nextjs' | 'unknown';

export type RuntimeNodeKind =
  | 'function'
  | 'method'
  | 'hook'
  | 'middleware'
  | 'render'
  | 'state'
  | 'dependency'
  | 'condition'
  | 'loop'
  | 'error'
  | 'async'
  | 'unknown';

export interface RuntimeNode {
  id: string;
  label: string;
  filePath?: string;
  framework: RuntimeFramework;
  kind: RuntimeNodeKind;
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface RuntimeEdge {
  from: string;
  to: string;
  type: 'calls' | 'awaits' | 'branches' | 'renders' | 'depends_on' | 'handles' | 'mutates';
}

export interface FrameworkRuntimeInput {
  entryPoints: RuntimeNode[];
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
}

export interface RuntimeFlowData {
  callGraph: Record<string, string[]>;
  executionOrder: string[];
  entryToExitPaths: string[][];
}

export interface LifecycleFinding {
  framework: RuntimeFramework;
  lifecycle: string;
  nodeIds: string[];
}

export interface LifecycleData {
  patterns: LifecycleFinding[];
}

export interface AsyncFlowData {
  chains: string[][];
  parallelGroups: string[][];
}

export interface ExecutionPathsData {
  branches: string[][];
  conditionalNodes: string[];
}

export interface AgentResult<T> {
  logs: string[];
  data: T;
}

export interface RuntimeAnalyzerData {
  runtimeFlow: RuntimeFlowData;
  lifecycle: LifecycleData;
  asyncFlow: AsyncFlowData;
  executionPaths: ExecutionPathsData;
  anomalies: string[];
}

export interface RuntimeAnalyzerOutput {
  success: boolean;
  logs: string[];
  data: RuntimeAnalyzerData;
  error?: string;
}

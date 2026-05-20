export type AnalysisPhase =
  | "IDLE"
  | "GRAPH_BUILDING"
  | "CYCLE_DETECTION"
  | "COUPLING_ANALYSIS"
  | "CLUSTER_DETECTION"
  | "METRICS_COMPUTATION"
  | "COMPLETE";

export type CouplingRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EdgeKind = "direct" | "transitive" | "type-only";

export interface SourceModule {
  readonly id:      string;
  readonly path:    string;
  readonly imports: readonly string[];
  readonly layer?:  number;
  readonly domain?: string;
}

export interface DependencyInput {
  readonly projectId: string;
  readonly modules:   readonly SourceModule[];
}

export interface GraphNode {
  readonly id:     string;
  readonly path:   string;
  readonly layer:  number;
  readonly domain: string;
}

export interface GraphEdge {
  readonly from: string;
  readonly to:   string;
  readonly kind: EdgeKind;
}

export interface DependencyGraph {
  readonly projectId: string;
  readonly nodes:     readonly GraphNode[];
  readonly edges:     readonly GraphEdge[];
}

export interface CycleGroup {
  readonly id:          string;
  readonly members:     readonly string[];
  readonly memberPaths: readonly string[];
  readonly length:      number;
  readonly severity:    CouplingRisk;
}

export interface CouplingScore {
  readonly moduleId:          string;
  readonly path:              string;
  readonly afferentCoupling:  number;
  readonly efferentCoupling:  number;
  readonly totalCoupling:     number;
  readonly instability:       number;
  readonly risk:              CouplingRisk;
}

export interface DependencyCluster {
  readonly id:            string;
  readonly members:       readonly string[];
  readonly memberPaths:   readonly string[];
  readonly internalEdges: number;
  readonly externalEdges: number;
  readonly cohesion:      number;
}

export interface DependencyMetrics {
  readonly totalModules:       number;
  readonly totalEdges:         number;
  readonly avgFanOut:          number;
  readonly avgFanIn:           number;
  readonly maxFanOut:          number;
  readonly maxFanIn:           number;
  readonly graphDensity:       number;
  readonly cycleCount:         number;
  readonly modulesInCycles:    number;
  readonly clusterCount:       number;
  readonly avgInstability:     number;
  readonly maxDepth:           number;
  readonly overallHealthScore: number;
}

export interface DependencyAnalysisResult {
  readonly resultId:   string;
  readonly analyzedAt: number;
  readonly graph:      DependencyGraph;
  readonly cycles:     readonly CycleGroup[];
  readonly coupling:   readonly CouplingScore[];
  readonly clusters:   readonly DependencyCluster[];
  readonly metrics:    DependencyMetrics;
  readonly summary:    string;
}

export interface DependencySession {
  readonly sessionId:  string;
  readonly projectId:  string;
  readonly phase:      AnalysisPhase;
  readonly startedAt:  number;
  readonly moduleCount: number;
}

export const MAX_MODULES            = 5_000;
export const MAX_CYCLES_REPORTED    = 100;
export const INSTABILITY_HIGH_RISK  = 0.8;
export const INSTABILITY_MED_RISK   = 0.5;
export const LARGE_CYCLE_THRESHOLD  = 5;
export const HEALTH_SCORE_START     = 100;

export const HEALTH_DEDUCTIONS = Object.freeze({
  cycle:        10,
  largeCycle:   20,
  highRisk:     5,
  criticalRisk: 10,
  highDensity:  15,
});

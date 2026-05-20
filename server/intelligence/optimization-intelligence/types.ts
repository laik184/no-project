export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OptimizationCategory =
  | "CPU_PATTERN"
  | "MEMORY_PATTERN"
  | "LATENCY_PATTERN"
  | "ASYNC_SUGGESTION"
  | "SYNC_BLOCKING"
  | "WORKER_THREAD"
  | "CACHING_OPPORTUNITY"
  | "PAYLOAD_OPTIMIZATION";

export type AnalysisStage =
  | "IDLE"
  | "PERFORMANCE"
  | "CODE_OPTIMIZATION"
  | "PAYLOAD"
  | "RANKING"
  | "COMPLETE";

export interface RuntimeMetric {
  readonly name:      string;
  readonly valueMs:   number;
  readonly threshold: number;
}

export interface MemoryMetric {
  readonly heapUsedMb:  number;
  readonly heapTotalMb: number;
  readonly externalMb:  number;
  readonly rssMb:       number;
}

export interface CpuMetric {
  readonly usagePercent: number;
  readonly userMs:       number;
  readonly systemMs:     number;
}

export interface EndpointProfile {
  readonly route:           string;
  readonly method:          string;
  readonly avgLatencyMs:    number;
  readonly p99LatencyMs:    number;
  readonly callCount:       number;
  readonly errorRate:       number;
}

export interface RuntimeAnalysisInput {
  readonly memory:    MemoryMetric;
  readonly cpu:       CpuMetric;
  readonly endpoints: readonly EndpointProfile[];
  readonly metrics:   readonly RuntimeMetric[];
}

export interface FunctionProfile {
  readonly name:           string;
  readonly isAsync:        boolean;
  readonly hasSyncIoCalls: boolean;
  readonly hasLoops:       boolean;
  readonly lineCount:      number;
  readonly callFrequency:  number;
}

export interface ResponseProfile {
  readonly route:           string;
  readonly avgPayloadBytes: number;
  readonly hasCompression:  boolean;
  readonly hasFieldFilter:  boolean;
}

export interface CacheProfile {
  readonly route:          string;
  readonly cacheHitRate:   number;
  readonly avgComputeMs:   number;
  readonly callFrequency:  number;
}

export interface CodeStructureInput {
  readonly functions:  readonly FunctionProfile[];
  readonly responses:  readonly ResponseProfile[];
  readonly caches:     readonly CacheProfile[];
}

export interface OptimizationFinding {
  readonly findingId:   string;
  readonly category:    OptimizationCategory;
  readonly target:      string;
  readonly description: string;
  readonly impact:      ImpactLevel;
  readonly score:       number;
  readonly evidence:    readonly string[];
}

export interface RankedSuggestion {
  readonly rank:       number;
  readonly findingId:  string;
  readonly category:   OptimizationCategory;
  readonly suggestion: string;
  readonly impact:     ImpactLevel;
  readonly score:      number;
  readonly effort:     "LOW" | "MEDIUM" | "HIGH";
}

export interface OptimizationSummary {
  readonly totalFindings:    number;
  readonly criticalCount:    number;
  readonly highCount:        number;
  readonly mediumCount:      number;
  readonly lowCount:         number;
  readonly topCategory:      OptimizationCategory | null;
  readonly overallScore:     number;
  readonly priorityFocus:    string;
}

export interface OptimizationReport {
  readonly reportId:          string;
  readonly findings:          readonly OptimizationFinding[];
  readonly rankedSuggestions: readonly RankedSuggestion[];
  readonly summary:           OptimizationSummary;
  readonly analyzedAt:        number;
}

export interface OptimizationSession {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly stage:     AnalysisStage;
  readonly findings:  readonly OptimizationFinding[];
  readonly report:    OptimizationReport | null;
}

export const SCORE_CRITICAL = 100;
export const SCORE_HIGH     = 60;
export const SCORE_MEDIUM   = 30;
export const SCORE_LOW      = 10;

export const LATENCY_HIGH_MS    = 500;
export const LATENCY_CRITICAL_MS = 2000;
export const MEMORY_HIGH_PCT    = 0.80;
export const MEMORY_CRITICAL_PCT = 0.95;
export const CPU_HIGH_PCT       = 75;
export const CPU_CRITICAL_PCT   = 90;
export const PAYLOAD_HIGH_BYTES = 100_000;
export const PAYLOAD_CRITICAL_BYTES = 500_000;
export const CACHE_HIT_LOW      = 0.40;

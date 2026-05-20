export type Severity = "low" | "medium" | "high";

export type OptimizationIssue = {
  type: string;
  severity: Severity;
  message: string;
  fix: string;
};

export type OptimizationResult = {
  success: boolean;
  issues: OptimizationIssue[];
  score: number;
  logs: string[];
};

export type FrameworkSignals = {
  framework: string;
  timestamp?: number;
  ui?: {
    rerenders?: number;
    largeComponents?: number;
    missingMemoization?: number;
    heavyRoutes?: string[];
  };
  api?: {
    p95LatencyMs?: number;
    avgPayloadKb?: number;
    unpaginatedEndpoints?: string[];
    missingBatching?: string[];
  };
  database?: {
    slowQueries?: string[];
    missingIndexes?: string[];
    nPlusOnePatterns?: string[];
  };
  caching?: {
    cacheHitRate?: number;
    uncachedHotPaths?: string[];
    invalidationMissing?: string[];
  };
  bundle?: {
    totalJsKb?: number;
    duplicatedDeps?: string[];
    routesWithoutSplitting?: string[];
  };
  middleware?: {
    chainLength?: number;
    redundantMiddlewares?: string[];
    orderIssues?: string[];
  };
  concurrency?: {
    blockingCalls?: string[];
    serialAwaits?: string[];
    eventLoopLagMs?: number;
  };
  bestPractices?: {
    antiPatterns?: string[];
    ruleViolations?: string[];
  };
};

export type FrameworkOptimizerState = {
  framework: string;
  metrics: {
    performanceScore: number;
    bottlenecks: string[];
    suggestions: string[];
  };
  timestamp: number;
};

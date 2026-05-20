export interface SystemMetrics {
  latencyMs: number;
  errorRate: number;
  successRate: number;
  throughput: number;
  memoryUsageMb: number;
  cpuPercent: number;
  timestamp: number;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issueCount: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface RecoveryRecord {
  failureType: string;
  resolved: boolean;
  attemptCount: number;
  durationMs: number;
  timestamp: number;
}

export interface SelfImprovementInput {
  metrics: SystemMetrics;
  validationResult?: ValidationResult;
  recoveryHistory?: RecoveryRecord[];
  executionLogs?: string[];
  sessionId: string;
}

export type StrategyType =
  | "optimize"
  | "refactor"
  | "cache"
  | "parallelize"
  | "retry-tune";

export interface Bottleneck {
  area: string;
  severity: "critical" | "high" | "medium" | "low";
  metric: string;
  currentValue: number;
  thresholdValue: number;
  impactScore: number;
}

export interface ImprovementAction {
  id: string;
  title: string;
  description: string;
  strategy: StrategyType;
  targetArea: string;
  estimatedImpact: number;
  estimatedEffort: number;
  optimizationScore: number;
  priority: number;
}

export interface PerformanceAnalysis {
  efficiencyScore: number;
  latencyScore: number;
  reliabilityScore: number;
  resourceScore: number;
  overallScore: number;
  warnings: string[];
}

export interface ImprovementPlan {
  sessionId: string;
  generatedAt: number;
  performanceAnalysis: PerformanceAnalysis;
  bottlenecks: Bottleneck[];
  actions: ImprovementAction[];
  selectedStrategy: StrategyType;
  optimizationScore: number;
  estimatedGain: number;
}

export interface ModuleOutput {
  success: boolean;
  logs: string[];
  error?: string;
  plan?: ImprovementPlan;
}

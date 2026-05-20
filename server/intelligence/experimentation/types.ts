export interface ExperimentInput {
  goal: string;
  context: string;
  strategyHints?: string[];
}

export interface ExperimentPlan {
  goal: string;
  testType: "a-b" | "multivariate" | "exploration";
  strategyCount: number;
  constraints: string[];
}

export interface Variant {
  id: string;
  name: string;
  strategy: string;
  parameters: Record<string, number | string | boolean>;
}

export interface ExecutionResult {
  variantId: string;
  success: boolean;
  latencyMs: number;
  accuracyScore: number;
  rawScore: number;
  notes: string;
}

export interface ComparisonResult {
  variantId: string;
  speedScore: number;
  accuracyScore: number;
  successRateScore: number;
  compositeScore: number;
}

export interface WinnerResult {
  variant: Variant;
  comparisonResult: ComparisonResult;
  rationale: string;
}

export interface ExperimentData {
  winner: Variant;
  confidence: number;
  results: ExecutionResult[];
}

export interface ExperimentOutput {
  success: boolean;
  logs: string[];
  error?: string;
  data?: ExperimentData;
}

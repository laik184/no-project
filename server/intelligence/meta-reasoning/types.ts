export interface MetaReasoningInput {
  decision: string;
  context: string;
  outcome: string;
}

export interface DecisionAnalysis {
  intent: string;
  logicPath: string[];
  assumptions: string[];
  goalAlignment: number;
}

export interface DetectedFlaw {
  type: "inefficiency" | "wrong-assumption" | "missed-opportunity" | "premature-conclusion" | "scope-creep";
  description: string;
  severity: "low" | "medium" | "high";
  affectedPart: string;
}

export interface Alternative {
  id: string;
  title: string;
  approach: string;
  speedScore: number;
  riskScore: number;
  efficiencyScore: number;
}

export interface StrategyComparison {
  winnerId: string;
  winnerTitle: string;
  rationale: string;
  tradeoffs: string[];
  scores: Array<{ id: string; composite: number }>;
}

export interface AnalysisResult {
  flaws: string[];
  alternatives: string[];
  bestStrategy: string;
  improvement: string;
  confidence: number;
}

export interface MetaReasoningOutput {
  success: boolean;
  logs: string[];
  analysis: AnalysisResult;
  error?: string;
}

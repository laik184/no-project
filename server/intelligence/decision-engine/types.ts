export type Intent = 'generate' | 'fix' | 'analyze' | 'deploy' | 'optimize';

export type Strategy = 'single-agent' | 'multi-agent' | 'pipeline';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Complexity = 'low' | 'medium' | 'high';

export type Domain =
  | 'backend'
  | 'frontend'
  | 'mobile'
  | 'devops'
  | 'data'
  | 'security'
  | 'realtime'
  | 'infrastructure'
  | 'unknown';

export interface DecisionInput {
  requestId: string;
  userInput: string;
  context: Record<string, unknown>;
  availableAgents: string[];
  timestamp: number;
}

export interface ClassifiedIntent {
  intent: Intent;
  confidence: number;
  keywords: string[];
  raw: string;
}

export interface ContextAnalysis {
  domain: Domain;
  complexity: Complexity;
  dependencies: string[];
  estimatedSteps: number;
  hasSecurityImplication: boolean;
}

export interface CapabilityMap {
  taskAgentMap: Record<string, string[]>;
  primaryAgents: string[];
  supportingAgents: string[];
  totalCapable: number;
}

export interface StrategySelection {
  strategy: Strategy;
  agentSequence: string[];
  parallelGroups: string[][];
  reasoning: string;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  performanceRisk: number;
  securityRisk: number;
  failureProbability: number;
  mitigations: string[];
}

export interface ScoredOption {
  optionId: string;
  score: number;
  breakdown: {
    confidenceScore: number;
    capabilityScore: number;
    riskPenalty: number;
    complexityPenalty: number;
  };
}

export interface FinalDecision {
  intent: Intent;
  selectedStrategy: Strategy;
  selectedAgents: string[];
  confidence: number;
  riskLevel: RiskLevel;
}

export interface DecisionOutput {
  success: boolean;
  decision: FinalDecision;
  logs: string[];
}

export interface DecisionRecord {
  requestId: string;
  decision: FinalDecision;
  timestamp: number;
  confidence: number;
}

export interface FallbackDecision {
  triggered: boolean;
  reason: string;
  fallbackAgents: string[];
  fallbackStrategy: Strategy;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type RetryStrategy = 'quick' | 'deep' | 'fallback';

export type LoopStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export type IssueCode =
  | 'LOGICAL_ERROR'
  | 'INCOMPLETE_OUTPUT'
  | 'CONTRACT_VIOLATION'
  | 'SCHEMA_MISMATCH'
  | 'EMPTY_RESULT'
  | 'TIMEOUT'
  | 'UNKNOWN';

export type ImprovementStrategy = 'patch' | 'rerun' | 'escalate';

export type LearningCategory = 'error' | 'performance' | 'quality';

export interface ExecutionResult {
  output: unknown;
  agentId: string;
  timestamp: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface Issue {
  code: IssueCode;
  message: string;
  severity: Severity;
  field?: string;
  context?: string;
}

export interface EvaluationResult {
  issues: Issue[];
  score: number;
  severity: Severity;
  passed: boolean;
  evaluatedAt: number;
}

export interface Feedback {
  issueRef: IssueCode;
  instruction: string;
  priority: number;
  target: string;
}

export interface ImprovementPlan {
  strategy: ImprovementStrategy;
  targetModule: string;
  steps: string[];
  priority: number;
  estimatedImpact: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  strategy: RetryStrategy;
  reason: string;
  nextAttempt: number;
  delayMs: number;
}

export interface LearningInsight {
  pattern: string;
  frequency: number;
  recommendation: string;
  category: LearningCategory;
  confidence: number;
}

export interface FeedbackLoopInput {
  requestId: string;
  executionResult: ExecutionResult;
  maxAttempts: number;
  currentAttempt: number;
  history: EvaluationResult[];
}

export interface FeedbackLoopOutput {
  success: boolean;
  score: number;
  attempts: number;
  improvements: ImprovementPlan[];
  insights: LearningInsight[];
  logs: string[];
  error?: string;
}

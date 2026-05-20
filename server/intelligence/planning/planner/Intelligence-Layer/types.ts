export type RefinementPhase =
  | "idle"
  | "prompt-refinement"
  | "intent-extraction"
  | "ambiguity-resolution"
  | "capability-mapping"
  | "strategy-hinting"
  | "complete"
  | "failed";

export type IntentType =
  | "CREATE"
  | "MODIFY"
  | "DELETE"
  | "ANALYZE"
  | "DEPLOY"
  | "TEST"
  | "DOCUMENT"
  | "CONFIGURE"
  | "MIGRATE"
  | "OPTIMIZE"
  | "REVIEW";

export type ExecutionHint =
  | "prefer-sequential"
  | "prefer-parallel"
  | "checkpoint-recommended"
  | "dry-run-first"
  | "incremental-approach"
  | "validate-early"
  | "snapshot-before-mutate"
  | "high-confidence-fast-path";

export type CapabilityDomain =
  | "backend-code-generation"
  | "frontend-code-generation"
  | "database-management"
  | "api-design"
  | "testing"
  | "documentation"
  | "deployment"
  | "configuration"
  | "refactoring"
  | "analysis";

export interface IntelligenceResult<T = undefined> {
  readonly ok:     boolean;
  readonly error?: string;
  readonly code?:  string;
  readonly data?:  T;
  readonly phase?: RefinementPhase;
}

export interface RawInput {
  readonly text:      string;
  readonly context?:  Readonly<Record<string, unknown>>;
  readonly sessionId?: string;
}

export interface RefinedPrompt {
  readonly original:          string;
  readonly normalized:        string;
  readonly sentences:         readonly string[];
  readonly wordCount:         number;
  readonly cleanedKeywords:   readonly string[];
  readonly languageConfidence: number;
}

export interface ActionPhrase {
  readonly verb:      string;
  readonly object:    string;
  readonly qualifier: string;
}

export interface ExtractedIntent {
  readonly primaryIntent:    IntentType;
  readonly secondaryIntents: readonly IntentType[];
  readonly actionPhrases:    readonly ActionPhrase[];
  readonly domain:           string;
  readonly scope:            string;
  readonly confidence:       number;
}

export interface AmbiguitySignal {
  readonly term:       string;
  readonly type:       "vague" | "overloaded" | "missing-context" | "conflicting";
  readonly resolution: string;
  readonly confidence: number;
}

export interface AmbiguityReport {
  readonly signals:          readonly AmbiguitySignal[];
  readonly overallAmbiguity: number;
  readonly resolvedText:     string;
  readonly isHighlyAmbiguous: boolean;
}

export interface MappedCapability {
  readonly domain:        CapabilityDomain;
  readonly required:      boolean;
  readonly confidence:    number;
  readonly triggerTerms:  readonly string[];
}

export interface CapabilityMap {
  readonly capabilities:  readonly MappedCapability[];
  readonly primaryDomain: CapabilityDomain;
  readonly coverageScore: number;
}

export interface StrategyHint {
  readonly hints:               readonly ExecutionHint[];
  readonly estimatedComplexity: number;
  readonly preferredOrder:      readonly string[];
  readonly warnings:            readonly string[];
  readonly rationale:           string;
}

export interface ImmutableRefinedGoal {
  readonly goalId:            string;
  readonly sessionId:         string;
  readonly refinedAt:         number;
  readonly rawInput:          RawInput;
  readonly refinedPrompt:     RefinedPrompt;
  readonly intent:            ExtractedIntent;
  readonly ambiguityReport:   AmbiguityReport;
  readonly capabilityMap:     CapabilityMap;
  readonly strategyHint:      StrategyHint;
  readonly overallConfidence: number;
  readonly readyForPlanning:  boolean;
}

export interface IntelligenceSession {
  readonly sessionId:    string;
  readonly rawInput:     RawInput;
  readonly phase:        RefinementPhase;
  readonly startedAt:    number;
  readonly intermediate: Readonly<{
    refinedPrompt?:   RefinedPrompt;
    intent?:          ExtractedIntent;
    ambiguityReport?: AmbiguityReport;
    capabilityMap?:   CapabilityMap;
    strategyHint?:    StrategyHint;
  }>;
}

export { refine, getActiveSession, resetIntelligence } from "./orchestrator.js";

export type {
  RawInput,
  ImmutableRefinedGoal,
  IntelligenceResult,
  RefinementPhase,
  IntelligenceSession,
  RefinedPrompt,
  ExtractedIntent,
  ActionPhrase,
  AmbiguityReport,
  AmbiguitySignal,
  CapabilityMap,
  MappedCapability,
  StrategyHint,
  IntentType,
  ExecutionHint,
  CapabilityDomain,
} from "./types.js";

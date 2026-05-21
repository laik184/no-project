/**
 * server/engines/learning/types.ts
 * Shared types for the learning engine. No logic, no imports from sibling modules.
 */

export interface FixRecord {
  runId: string;
  goal: string;
  failureType: string;
  fix: string;
  toolsUsed: string[];
  ts: number;
}

export interface FailurePattern {
  pattern: string;
  failureType: string;
  occurrences: number;
  lastSeen: number;
  knownFix?: string;
}

export interface ArchitectureDecisionRecord {
  runId: string;
  decision: string;
  rationale: string;
  ts: number;
}

export interface LearningResult {
  projectId: number;
  runId: string;
  fixPersisted: boolean;
  patternPersisted: boolean;
  decisionPersisted: boolean;
  elapsedMs: number;
}

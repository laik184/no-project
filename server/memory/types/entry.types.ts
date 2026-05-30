/**
 * server/memory/types/entry.types.ts
 *
 * Purpose: Domain-specific memory entry shapes extending the base MemoryEntry.
 * Responsibility: One typed interface per memory domain. No runtime logic.
 * Exports: DecisionEntry, BugEntry, ArchitectureEntry, etc.
 */

import type { MemoryEntry } from './memory.types.ts';

// ── Decision memory ───────────────────────────────────────────────────────────

export interface DecisionEntry extends MemoryEntry {
  readonly category: 'decision';
  context:   string;
  outcome:   string;
  rationale: string;
  impact:    'low' | 'medium' | 'high' | 'critical';
  reversed?: boolean;
}

// ── Architecture memory ───────────────────────────────────────────────────────

export interface ArchitectureEntry extends MemoryEntry {
  readonly category: 'architecture';
  component:   string;
  pattern:     string;
  tradeoffs:   string[];
  constraints: string[];
}

// ── Bug memory ────────────────────────────────────────────────────────────────

export interface BugEntry extends MemoryEntry {
  readonly category: 'bug';
  errorType:   string;
  stackTrace?: string;
  rootCause:   string;
  fix:         string;
  recurrence:  number;   // count of occurrences
  resolved:    boolean;
}

// ── Business memory ───────────────────────────────────────────────────────────

export interface BusinessEntry extends MemoryEntry {
  readonly category: 'business';
  domain:     string;
  insight:    string;
  source:     string;
  confidence: number;   // 0.0–1.0
}

// ── User feedback memory ──────────────────────────────────────────────────────

export interface FeedbackEntry extends MemoryEntry {
  readonly category: 'user-feedback';
  sentiment:  'positive' | 'neutral' | 'negative';
  feature:    string;
  verbatim:   string;
  actionable: boolean;
}

// ── Revenue memory ────────────────────────────────────────────────────────────

export interface RevenueEntry extends MemoryEntry {
  readonly category: 'revenue';
  metric:     string;
  value:      number;
  currency:   string;
  period:     string;   // e.g. "2024-Q1"
  trend:      'up' | 'down' | 'flat';
}

// ── Learning memory ───────────────────────────────────────────────────────────

export interface LearningEntry extends MemoryEntry {
  readonly category: 'learning';
  lesson:      string;
  domain:      string;
  appliedFrom: string;   // runId or context that produced the lesson
  validated:   boolean;
}

// ── Prediction memory ─────────────────────────────────────────────────────────

export interface PredictionEntry extends MemoryEntry {
  readonly category: 'prediction';
  subject:     string;
  prediction:  string;
  confidence:  number;   // 0.0–1.0
  horizon:     string;   // e.g. "30d", "1q"
  outcome?:    'correct' | 'incorrect' | 'partial' | 'pending';
}

// ── Execution memory ──────────────────────────────────────────────────────────

export interface ExecutionEntry extends MemoryEntry {
  readonly category: 'execution';
  runId:       string;
  goal:        string;
  agentType:   string;
  toolsUsed:   string[];
  durationMs:  number;
  success:     boolean;
  errorSummary?: string;
}

// ── Conversation memory ───────────────────────────────────────────────────────

export interface ConversationEntry extends MemoryEntry {
  readonly category: 'conversation';
  projectId:   string;
  role:        'user' | 'agent' | 'system';
  turnIndex:   number;
  summary?:    string;
}

// ── Reflection memory ─────────────────────────────────────────────────────────

export interface ReflectionEntry extends MemoryEntry {
  readonly category: 'reflection';
  sourceIds:   string[];   // IDs of memories that triggered this reflection
  mistake:     string;
  lesson:      string;
  improvement: string;
  applied:     boolean;
}

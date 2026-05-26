/**
 * memory-classifier.ts
 *
 * Classifies raw observations into typed memory categories.
 * Single responsibility: classification only. No I/O, no persistence.
 *
 * Memory types:
 *   EPISODIC    — what happened in a specific run (events, outcomes)
 *   SEMANTIC    — general knowledge (patterns, architectures, frameworks)
 *   PROCEDURAL  — successful workflows and tool chains
 *   FAILURE     — crashes, failed patches, unstable runtimes
 *   PROJECT     — folder structures, conventions, dependencies
 *   REFLECTION  — root cause analysis, postmortem learnings
 *   RUNTIME     — crashes, port issues, preview stability
 */

import type { MemoryCategory } from "../types.ts";

// ── Extended type that maps to MemoryCategory ─────────────────────────────────

export type MemoryType =
  | "episodic"
  | "semantic"
  | "procedural"
  | "failure"
  | "project"
  | "reflection"
  | "runtime";

export interface ClassifiedMemory {
  type:        MemoryType;
  category:    MemoryCategory;  // maps to vector store category
  confidence:  number;          // 0.0–1.0
  tags:        string[];
  score:       number;          // initial quality score
  ttlMs:       number;          // suggested time-to-live
}

// ── Classification rules ───────────────────────────────────────────────────────

const RUNTIME_KEYWORDS = [
  "crash", "port", "startup", "boot", "server", "preview",
  "runtime", "process", "exit", "hung", "timeout", "memory",
  "heap", "oom", "killed", "sigterm", "sigkill",
];

const FAILURE_KEYWORDS = [
  "fail", "error", "exception", "broke", "wrong", "invalid",
  "cannot", "unable", "refused", "rejected", "denied",
  "bug", "broken", "unstable", "corrupt",
];

const PROCEDURAL_KEYWORDS = [
  "workflow", "sequence", "pipeline", "steps", "procedure",
  "chain", "pattern", "recipe", "algorithm", "process",
  "always do", "correct approach", "best way", "use this",
];

const REFLECTION_KEYWORDS = [
  "root cause", "postmortem", "analysis", "lesson",
  "because", "reason", "therefore", "insight", "learned",
  "understand", "discovered", "realized", "found that",
];

const PROJECT_KEYWORDS = [
  "architecture", "structure", "folder", "convention", "decision",
  "dependency", "package", "framework", "library", "stack",
  "config", "schema", "database", "api", "route",
];

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

// ── TTL constants ─────────────────────────────────────────────────────────────

const TTL = {
  episodic:   7  * 24 * 60 * 60 * 1000,   // 7 days
  semantic:   90 * 24 * 60 * 60 * 1000,   // 90 days
  procedural: 30 * 24 * 60 * 60 * 1000,   // 30 days
  failure:    30 * 24 * 60 * 60 * 1000,   // 30 days
  project:    Infinity,                    // project conventions never expire
  reflection: 60 * 24 * 60 * 60 * 1000,   // 60 days
  runtime:    14 * 24 * 60 * 60 * 1000,   // 14 days
};

// ── Type → MemoryCategory mapping ─────────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<MemoryType, MemoryCategory> = {
  episodic:   "pattern",      // run history → pattern recognition
  semantic:   "architecture", // general knowledge → architecture facts
  procedural: "success",      // working workflows → success patterns
  failure:    "failure",      // failures and fixes
  project:    "fact",         // project facts
  reflection: "pattern",      // insights → patterns
  runtime:    "runtime",      // runtime incidents
};

// ── Classifier ────────────────────────────────────────────────────────────────

export function classifyMemory(
  content: string,
  hint?: Partial<{ success: boolean; fromReflection: boolean; fromRuntime: boolean }>,
): ClassifiedMemory {
  const scores: Record<MemoryType, number> = {
    runtime:    countKeywords(content, RUNTIME_KEYWORDS)    * 3,
    failure:    countKeywords(content, FAILURE_KEYWORDS)    * 2,
    reflection: countKeywords(content, REFLECTION_KEYWORDS) * 3,
    procedural: countKeywords(content, PROCEDURAL_KEYWORDS) * 2,
    project:    countKeywords(content, PROJECT_KEYWORDS)    * 2,
    semantic:   0,
    episodic:   0,
  };

  // Apply hints
  if (hint?.fromReflection) scores.reflection += 10;
  if (hint?.fromRuntime)    scores.runtime    += 10;
  if (hint?.success === false) scores.failure += 5;
  if (hint?.success === true)  scores.procedural += 3;

  // Episodic is the default catch-all
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    scores.episodic = 1;
  }

  const type = (Object.entries(scores) as [MemoryType, number][])
    .sort(([, a], [, b]) => b - a)[0][0];

  const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
  const confidence = Math.min(0.99, scores[type] / total);

  const tags = buildTags(content, type, hint);
  const score = hint?.success ? 0.8 : type === "failure" ? 0.7 : 0.6;

  return {
    type,
    category:   TYPE_TO_CATEGORY[type],
    confidence,
    tags,
    score,
    ttlMs: TTL[type] ?? TTL.episodic,
  };
}

function buildTags(
  content: string,
  type: MemoryType,
  hint?: Partial<{ success: boolean; fromReflection: boolean; fromRuntime: boolean }>,
): string[] {
  const tags: string[] = [type];
  if (hint?.success !== undefined) tags.push(hint.success ? "success" : "failure");
  if (hint?.fromReflection) tags.push("reflection");
  if (hint?.fromRuntime)    tags.push("runtime");

  // Extract relevant keywords as tags
  const lower = content.toLowerCase();
  const techTags = ["typescript", "react", "express", "postgres", "vite", "drizzle",
                    "openrouter", "websocket", "sse", "api", "database"];
  for (const tag of techTags) {
    if (lower.includes(tag)) tags.push(tag);
  }

  return [...new Set(tags)];
}

/** Classify a run summary as a memory entry. */
export function classifyRunSummary(success: boolean, goal: string, summary: string): ClassifiedMemory {
  return classifyMemory(`${goal} ${summary}`, { success });
}

/** Classify a failure entry. */
export function classifyFailureEntry(goal: string, reason: string): ClassifiedMemory {
  return classifyMemory(`${goal} ${reason}`, { success: false });
}

/** Classify a reflection output. */
export function classifyReflectionOutput(analysis: string): ClassifiedMemory {
  return classifyMemory(analysis, { fromReflection: true });
}

/** Classify a runtime event. */
export function classifyRuntimeEvent(description: string): ClassifiedMemory {
  return classifyMemory(description, { fromRuntime: true });
}

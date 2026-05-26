/**
 * memory-injector.ts
 *
 * Fail-safe, validated context injection into agent prompts.
 *
 * Rules:
 *   1. NEVER corrupt runtime — any failure returns empty string
 *   2. Validate memory before injection (stale, corrupted, cross-project)
 *   3. Emit memory.injected telemetry on every injection
 *   4. Fail-closed: invalid/stale memories are BLOCKED, not injected
 *   5. Enforce context budget (max chars)
 *
 * Single responsibility: injection safety layer only.
 */

import { retrieve }         from "../pipeline/memory-pipeline.ts";
import { memoryTelemetry }  from "../telemetry/memory-telemetry.ts";
import type { MemoryEntry, RankedMemory } from "../types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_INJECTION_CHARS   = 3_000;  // hard cap for injected context
const MIN_MEMORY_SCORE      = 0.20;   // entries below this are blocked
const MAX_MEMORY_AGE_MS     = 30 * 24 * 60 * 60 * 1000;  // 30 days stale threshold
const MAX_ENTRIES_INJECTED  = 8;

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid:   boolean;
  reason?: string;
}

function validateEntry(entry: MemoryEntry, projectId: number): ValidationResult {
  // Cross-project contamination guard
  if (entry.projectId !== undefined && entry.projectId !== projectId) {
    return { valid: false, reason: "cross_project_contamination" };
  }

  // Stale memory guard
  const ageMs = Date.now() - entry.createdAt;
  if (ageMs > MAX_MEMORY_AGE_MS && entry.usedCount === 0) {
    return { valid: false, reason: "stale_unused" };
  }

  // Low quality guard
  if (entry.score < MIN_MEMORY_SCORE) {
    return { valid: false, reason: "low_score" };
  }

  // Content corruption guard
  if (!entry.content?.trim() || entry.content.length < 10) {
    return { valid: false, reason: "empty_or_corrupted" };
  }

  return { valid: true };
}

// ── Formatter ──────────────────────────────────────────────────────────────────

function formatForInjection(ranked: RankedMemory[], projectId: number): string {
  const validated: RankedMemory[] = [];
  const blocked:   string[]       = [];

  for (const r of ranked.slice(0, MAX_ENTRIES_INJECTED)) {
    const result = validateEntry(r.memory, projectId);
    if (result.valid) {
      validated.push(r);
    } else {
      blocked.push(result.reason!);
      memoryTelemetry.failed({
        operation: `inject.blocked.${result.reason}`,
        projectId,
        reason:    result.reason!,
      });
    }
  }

  if (validated.length === 0) return "";

  const parts: string[] = [
    "=== RETRIEVED MEMORIES (ranked by relevance) ===",
  ];

  let charCount = parts[0].length;

  for (const r of validated) {
    const entry = r.memory;
    const line  = `[${entry.category.toUpperCase()}${entry.tags.includes("failure") ? " · FAILURE" : ""}] ${entry.content.trim()}`;
    const note  = r.relevanceNote ? ` (${r.relevanceNote})` : "";
    const block = `• ${line}${note}`;

    if (charCount + block.length > MAX_INJECTION_CHARS) break;

    parts.push(block);
    charCount += block.length;
  }

  parts.push("=== END RETRIEVED MEMORIES ===");

  return parts.join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface InjectionInput {
  query:     string;
  projectId: number;
  runId:     string;
  phase:     string;
}

export interface InjectionResult {
  context:     string;  // the injected context string (empty string = nothing to inject)
  blockCount:  number;
  totalChars:  number;
  wasBlocked:  boolean; // true if validation blocked some entries
}

/** Retrieve and validate memory then return safe-to-inject context string. */
export async function injectMemoryContext(input: InjectionInput): Promise<InjectionResult> {
  const { query, projectId, runId, phase } = input;

  // Fail-closed: any exception returns empty context
  try {
    const ranked = await retrieve(query, projectId, runId, {
      topK:     MAX_ENTRIES_INJECTED + 2, // over-fetch to allow validation filtering
      minScore: MIN_MEMORY_SCORE,
    });

    if (ranked.length === 0) {
      return { context: "", blockCount: 0, totalChars: 0, wasBlocked: false };
    }

    const context = formatForInjection(ranked, projectId);

    if (!context) {
      return { context: "", blockCount: 0, totalChars: 0, wasBlocked: true };
    }

    const blockCount = Math.min(ranked.length, MAX_ENTRIES_INJECTED);
    const totalChars = context.length;

    memoryTelemetry.injected({ runId, projectId, blockCount, totalChars, phase });

    return { context, blockCount, totalChars, wasBlocked: false };

  } catch (err) {
    memoryTelemetry.failed({
      operation: "inject",
      projectId,
      reason:    (err as Error).message,
      runId,
    });
    // FAIL-CLOSED: return empty string, never throw
    return { context: "", blockCount: 0, totalChars: 0, wasBlocked: true };
  }
}

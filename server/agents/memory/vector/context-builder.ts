/**
 * context-builder.ts
 *
 * Builds context-injected prompts from ranked memories.
 * Compresses memory content to fit within token budgets.
 */

import type { RankedMemory, MemoryCategory } from "./vector-types.ts";

// ── Category labels ───────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  pattern:      "🔁 Recurring Pattern",
  fact:         "📌 Established Fact",
  preference:   "⚙️  Preference",
  failure:      "⚠️  Past Failure",
  success:      "✅ Successful Strategy",
  architecture: "🏗️  Architecture Decision",
  dependency:   "📦 Dependency Note",
  runtime:      "🔧 Runtime Incident",
};

// ── Compression ───────────────────────────────────────────────────────────────

function compressContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  // Keep first 60% and last 40% of budget
  const headLen = Math.floor(maxChars * 0.6);
  const tailLen = maxChars - headLen - 10;

  return `${content.slice(0, headLen)}\n...[compressed]...\n${content.slice(-tailLen)}`;
}

// ── Block builder ─────────────────────────────────────────────────────────────

export interface MemoryBlock {
  category:      MemoryCategory;
  label:         string;
  content:       string;
  relevanceNote: string;
  score:         number;
}

export function buildMemoryBlock(ranked: RankedMemory, maxCharsEach = 400): MemoryBlock {
  return {
    category:      ranked.memory.category,
    label:         CATEGORY_LABEL[ranked.memory.category],
    content:       compressContent(ranked.memory.content, maxCharsEach),
    relevanceNote: ranked.relevanceNote,
    score:         ranked.finalScore,
  };
}

// ── Context injection ─────────────────────────────────────────────────────────

export interface ContextInjectionResult {
  injectedText:  string;
  memoryCount:   number;
  tokenEstimate: number;
}

/**
 * Build a concise memory injection block from ranked results.
 * Suitable for prepending to an agent system prompt.
 */
export function buildContextInjection(
  ranked:       RankedMemory[],
  maxTotalChars: number = 2_000,
): ContextInjectionResult {
  if (ranked.length === 0) {
    return { injectedText: "", memoryCount: 0, tokenEstimate: 0 };
  }

  const blocks = ranked.map(r => buildMemoryBlock(r));
  const lines:  string[] = ["## Relevant Memory", ""];

  let usedChars = 20;
  let included  = 0;

  for (const block of blocks) {
    const entry = [
      `**${block.label}** (${block.relevanceNote})`,
      block.content,
      "",
    ].join("\n");

    if (usedChars + entry.length > maxTotalChars) break;

    lines.push(entry);
    usedChars += entry.length;
    included++;
  }

  const injectedText  = lines.join("\n");
  const tokenEstimate = Math.ceil(injectedText.length / 4);

  return { injectedText, memoryCount: included, tokenEstimate };
}

// ── Summary builder ───────────────────────────────────────────────────────────

/** Build a summary of what was learned in the current run for memory storage. */
export function buildRunSummary(
  goal:        string,
  outcome:     "success" | "failure",
  keyActions:  string[],
  errors:      string[],
): string {
  const parts = [
    `Goal: ${goal}`,
    `Outcome: ${outcome.toUpperCase()}`,
    `Actions: ${keyActions.slice(0, 5).join("; ")}`,
  ];

  if (errors.length > 0) {
    parts.push(`Errors encountered: ${errors.slice(0, 3).join("; ")}`);
  }

  return parts.join("\n");
}

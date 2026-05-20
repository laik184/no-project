/**
 * project-context-builder.ts
 *
 * Build a compressed project context string for injection into the LLM
 * at the start of each agent run.
 *
 * Reads (all in parallel):
 *   - run-history.jsonl    → last 5 run summaries
 *   - failures.json        → last 3 recent failures
 *   - decisions.json       → last 5 architecture decisions
 *   - architecture.md      → architectural decisions narrative (capped)
 *   - context.md           → run log (capped)
 *   - tasks.md             → pending tasks (must resume)             [C8]
 *   - progress.md          → project progress milestones             [C9]
 *   - decisions.md         → human-readable decision log             [C9]
 *   - failed-attempts.md   → broken approaches to avoid              [C9]
 *
 * Returns a single compact string that fits in ~2000 tokens.
 * Returns null on the very first run for this project (no .nura/ yet).
 *
 * Ownership: memory/context — context assembly only. No I/O directly.
 */

import {
  readRecentRuns,
  readFailures,
  readDecisions,
  readArchitectureMd,
  readContextMd,
  readProgressMd,
  readDecisionsMd,
  readFailedAttemptsMd,
} from "../persistence/memory-store.ts";
import { readTasksMd } from "../task-memory/tasks-store.ts";
import type { RunSummary, FailureEntry, ArchitectureDecision } from "../types.ts";

// ─── Caps ─────────────────────────────────────────────────────────────────────

const MAX_RUNS          = 5;
const MAX_FAILURES      = 3;
const MAX_DECISIONS     = 5;
const MAX_ARCH_CHARS    = 1_500;
const MAX_LOG_CHARS     = 600;
const MAX_TASK_CHARS    = 1_200;
const MAX_PROGRESS_CHARS = 800;
const MAX_DECISION_MD_CHARS = 800;
const MAX_FAILED_CHARS  = 800;

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtRun(r: RunSummary, i: number): string {
  const date = new Date(r.ts).toISOString().slice(0, 10);
  const icon = r.success ? "✓" : "✗";
  const note = r.success
    ? r.summary.slice(0, 150)
    : `FAILED: ${r.failReason?.slice(0, 130) ?? "unknown"}`;
  return `${i + 1}. [${date}] ${icon} "${r.goal.slice(0, 100)}"\n   ${note}`;
}

function fmtFailure(f: FailureEntry, i: number): string {
  const date = new Date(f.ts).toISOString().slice(0, 10);
  return `${i + 1}. [${date}] "${f.goal.slice(0, 80)}" → ${f.reason.slice(0, 120)}`;
}

function fmtDecision(d: ArchitectureDecision, i: number): string {
  return `${i + 1}. "${d.goal.slice(0, 80)}" → ${d.summary.slice(0, 150)}`;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildProjectContext(projectId: number): Promise<string | null> {
  const [
    recentRuns, failures, decisions,
    archMd, contextMd, tasksMd,
    progressMd, decisionsMd, failedMd,
  ] = await Promise.all([
    readRecentRuns(projectId, MAX_RUNS),
    readFailures(projectId),
    readDecisions(projectId),
    readArchitectureMd(projectId),
    readContextMd(projectId),
    readTasksMd(projectId),
    readProgressMd(projectId),
    readDecisionsMd(projectId),
    readFailedAttemptsMd(projectId),
  ]);

  const hasRuns      = recentRuns.length > 0;
  const hasArch      = archMd.trim().length > 0;
  const hasContext   = contextMd.trim().length > 0;
  const hasTasks     = tasksMd.trim().length > 0;
  const hasProgress  = progressMd.trim().length > 0;
  const hasDecMd     = decisionsMd.trim().length > 0;
  const hasFailedMd  = failedMd.trim().length > 0;

  // No memory yet — first run for this project
  if (!hasRuns && !hasArch && !hasContext && !hasTasks && !hasProgress) return null;

  const parts: string[] = [
    "=== PROJECT MEMORY ===",
    `Project ID: ${projectId}`,
    "Context from previous agent runs — build on this, do NOT restart from scratch.",
    "",
  ];

  // ── 1. Pending tasks (highest priority — must resume these) ───────────────
  if (hasTasks && tasksMd.includes("⏳ Pending")) {
    parts.push("PENDING TASKS (unfinished — resume these, do NOT restart from scratch):");
    parts.push(tasksMd.trim().slice(-MAX_TASK_CHARS));
    parts.push("");
  }

  // ── 2. Project progress (what's been built) ───────────────────────────────
  if (hasProgress) {
    parts.push("PROJECT PROGRESS (completed milestones):");
    parts.push(progressMd.trim().slice(-MAX_PROGRESS_CHARS));
    parts.push("");
  }

  // ── 3. Architecture (shapes all decisions) ────────────────────────────────
  if (hasArch) {
    parts.push("ARCHITECTURE (established design):");
    parts.push(archMd.trim().slice(-MAX_ARCH_CHARS));
    parts.push("");
  }

  // ── 4. Key decisions log (human-readable) ─────────────────────────────────
  if (hasDecMd) {
    parts.push("KEY DECISIONS (follow these choices):");
    parts.push(decisionsMd.trim().slice(-MAX_DECISION_MD_CHARS));
    parts.push("");
  } else if (decisions.length > 0) {
    parts.push("ARCHITECTURE DECISIONS (recent):");
    parts.push(...decisions.slice(0, MAX_DECISIONS).map(fmtDecision));
    parts.push("");
  }

  // ── 5. Recent runs ────────────────────────────────────────────────────────
  if (hasRuns) {
    parts.push("RECENT RUNS (most recent first):");
    parts.push(...recentRuns.map(fmtRun));
    parts.push("");
  }

  // ── 6. Failed attempts (must not repeat) ─────────────────────────────────
  if (hasFailedMd) {
    parts.push("FAILED APPROACHES (do NOT repeat these):");
    parts.push(failedMd.trim().slice(-MAX_FAILED_CHARS));
    parts.push("");
  } else {
    const recentFails = failures.slice(0, MAX_FAILURES);
    if (recentFails.length > 0) {
      parts.push("KNOWN FAILURES (do NOT repeat these approaches):");
      parts.push(...recentFails.map(fmtFailure));
      parts.push("");
    }
  }

  // ── 7. Activity log (raw run log) ────────────────────────────────────────
  if (hasContext) {
    parts.push("ACTIVITY LOG (recent):");
    parts.push(contextMd.trim().slice(-MAX_LOG_CHARS));
    parts.push("");
  }

  parts.push(
    "=== INSTRUCTIONS ===",
    "• Resume any ⏳ Pending tasks above. Do NOT restart them from scratch.",
    "• Build on established architecture and package choices above.",
    "• Do NOT redo work already marked ✓ in recent runs.",
    "• If a previous run failed, fix the root cause — do not repeat the same approach.",
    "• Use memory_update tool to persist important decisions, progress, or failures mid-run.",
    "=== END PROJECT MEMORY ===",
  );

  return parts.join("\n");
}

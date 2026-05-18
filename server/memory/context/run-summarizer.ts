/**
 * run-summarizer.ts
 *
 * Post-run: extract a structured summary and persist it to .nura/.
 *
 * Called by MemoryManager.saveRunSummary() after each agent loop completes.
 * Deterministic — no LLM calls.
 *
 * Responsibilities:
 *   1. Build RunSummary → run-history.jsonl
 *   2. Update context.md with a compact run line
 *   3. success → appendDecision (decisions.json) + updateArchitectureMd + appendDecisionMd [C9] + appendProgressMd [C9]
 *   4. failure → appendFailure (failures.json) + appendFailedAttemptMd [C9]
 *
 * Ownership: memory/context — summarization logic only.
 * Delegates all I/O to memory-store.ts.
 */

import {
  appendRunSummary,
  appendFailure,
  appendDecision,
  readContextMd,
  writeContextMd,
  readArchitectureMd,
  writeArchitectureMd,
  appendDecisionMd,
  appendProgressMd,
  appendFailedAttemptMd,
} from "../persistence/memory-store.ts";
import type { RunSummary, FailureEntry, ArchitectureDecision } from "../types.ts";

export interface SummarizableResult {
  success:    boolean;
  steps:      number;
  summary:    string;
  stopReason: string;
  error?:     string;
}

// ─── context.md ───────────────────────────────────────────────────────────────

const MAX_CONTEXT_CHARS = 4_000;

function buildRunLine(s: RunSummary): string {
  const date = new Date(s.ts).toISOString().slice(0, 10);
  const icon = s.success ? "✓" : "✗";
  return `[${date}] ${icon} ${s.goal.slice(0, 100)}\n   → ${s.summary.slice(0, 180)}`;
}

async function updateContextMd(projectId: number, runLine: string): Promise<void> {
  let existing = await readContextMd(projectId);
  if (!existing) {
    existing = "# Project Run Log\n\nTracks what the agent has built across runs.\n\n## Runs\n";
  }
  const updated = existing + "\n" + runLine;
  const pruned  = updated.length > MAX_CONTEXT_CHARS ? updated.slice(-MAX_CONTEXT_CHARS) : updated;
  await writeContextMd(projectId, pruned);
}

// ─── architecture.md ──────────────────────────────────────────────────────────

const MAX_ARCH_CHARS = 5_000;
const ARCH_HEADER = "# Architecture Decisions\n\nKey decisions made across agent runs.\n\n";

async function updateArchitectureMd(
  projectId: number,
  decision:  ArchitectureDecision,
): Promise<void> {
  let existing = await readArchitectureMd(projectId);
  if (!existing) existing = ARCH_HEADER;

  const date = new Date(decision.ts).toISOString().slice(0, 10);
  const line = `## [${date}] ${decision.goal.slice(0, 80)}\n${decision.summary.slice(0, 300)}\n`;
  const updated = existing + "\n" + line;
  const pruned  = updated.length > MAX_ARCH_CHARS ? ARCH_HEADER + updated.slice(-MAX_ARCH_CHARS) : updated;
  await writeArchitectureMd(projectId, pruned);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function summarizeAndPersist(
  projectId: number,
  runId:     string,
  goal:      string,
  result:    SummarizableResult,
): Promise<void> {
  try {
    const ts = Date.now();
    const summary: RunSummary = {
      runId,
      ts,
      goal,
      summary:    result.summary.slice(0, 500),
      success:    result.success,
      stopReason: result.stopReason,
      failReason: result.success ? undefined : (result.error ?? result.summary).slice(0, 300),
    };

    const writes: Promise<void>[] = [
      appendRunSummary(projectId, summary),
      updateContextMd(projectId, buildRunLine(summary)),
    ];

    if (result.success) {
      const decision: ArchitectureDecision = {
        runId, ts, goal,
        summary: result.summary.slice(0, 400),
      };
      // decisions.json (structured) + architecture.md (narrative) + decisions.md [C9] + progress.md [C9]
      writes.push(appendDecision(projectId, decision));
      writes.push(updateArchitectureMd(projectId, decision));
      writes.push(appendDecisionMd(projectId,
        `Goal: ${goal.slice(0, 120)}\nOutcome: ${result.summary.slice(0, 300)}`));
      writes.push(appendProgressMd(projectId,
        `Completed: ${goal.slice(0, 120)}\n→ ${result.summary.slice(0, 250)}`));
    } else {
      const failure: FailureEntry = {
        runId, ts, goal,
        reason: (summary.failReason ?? "Unknown failure"),
      };
      // failures.json (structured) + failed-attempts.md [C9]
      writes.push(appendFailure(projectId, failure));
      writes.push(appendFailedAttemptMd(projectId,
        `Goal: ${goal.slice(0, 120)}\nReason: ${failure.reason.slice(0, 300)}`));
    }

    await Promise.all(writes);
  } catch {
    // Memory writes must NEVER crash the agent run
  }
}

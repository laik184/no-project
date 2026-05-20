/**
 * recovery-goal-builder.ts
 *
 * Build a context-rich recovery goal string for the LLM agent.
 *
 * Enriches the goal beyond the generic crash-responder goal with:
 *   - Pre-extracted stack frames and affected files
 *   - Correlated fix hints (suggestedAction per error)
 *   - Memory context from past attempts (what was tried, what worked)
 *   - Explicit rollback instruction if a checkpoint exists
 *
 * Pure function — no I/O, no bus, no state.
 * Ownership: autonomous-debug/core — single responsibility: prompt engineering.
 */

import { renderCorrelations }  from "../analyzers/error-correlator.ts";
import { buildMemorySummary }  from "../memory/recovery-memory.ts";
import type { DebugSession }   from "../types/debug-types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const LOG_BLOCK_CHARS = 4_000;

// ─── Goal builder ─────────────────────────────────────────────────────────────

export function buildRecoveryGoal(
  session:         DebugSession,
  attempt:         number,
  maxAttempts:     number,
): string {
  const { projectId, logSnapshot, correlations, extractedErrors, checkpointCreated } = session;

  const logBlock = logSnapshot.join("\n").slice(-LOG_BLOCK_CHARS) || "(no logs captured)";

  const memorySummary = buildMemorySummary(projectId);

  const correlationBlock = renderCorrelations(correlations);

  const affectedFilesBlock = extractedErrors.length > 0
    ? extractedErrors
        .flatMap(e => e.frames.map(f => f.line ? `  ${f.file}:${f.line}` : `  ${f.file}`))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 6)
        .join("\n")
    : "  (none extracted — check logs manually)";

  const rollbackNote = checkpointCreated
    ? `\nROLLBACK AVAILABLE: Files were snapshotted before this session (session=${session.sessionId}). ` +
      `If your fix makes things worse, the rollback-manager will automatically restore them.\n`
    : "";

  const sections = [
    `AUTONOMOUS RECOVERY — project ${projectId} | attempt ${attempt}/${maxAttempts}`,
    "",
    "═══ CRASH LOGS ═══",
    "```",
    logBlock,
    "```",
    "",
  ];

  if (correlationBlock) {
    sections.push(correlationBlock, "");
  }

  sections.push("AFFECTED FILES (extracted from stack traces):", affectedFilesBlock, "");

  if (memorySummary) {
    sections.push(memorySummary, "");
  }

  if (rollbackNote) {
    sections.push(rollbackNote);
  }

  sections.push(
    "RECOVERY STEPS — follow in order, no confirmation needed:",
    "1. Call server_logs for any additional context beyond what is shown above.",
    "2. Identify the root cause using the DIAGNOSTIC HINTS above as your guide.",
    "3. Fix the root cause:",
    "   • missing_module          → package_install <package>",
    "   • syntax_error/compile    → file_replace or file_write on the affected file",
    "   • runtime_error           → locate the failing line from the stack trace and fix it",
    "   • port_conflict           → server_stop then server_start",
    "   • unknown / generic       → server_restart and observe new logs",
    "4. Call server_restart to bring the server back up.",
    "5. Call server_logs after ~3 s to confirm a clean startup.",
    "6. If still failing and this is not your first attempt, try a different approach from step 3.",
    "7. Once the server is running cleanly, call task_complete with a one-sentence summary of the fix.",
    "",
    "IMPORTANT: Do NOT ask for confirmation. Act autonomously. Prefer targeted file edits over full rewrites.",
  );

  return sections.join("\n");
}

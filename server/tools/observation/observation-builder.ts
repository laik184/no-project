/**
 * server/tools/observation/observation-builder.ts
 *
 * Assembles all collector outputs into a single ExecutionObservation
 * and renders the [OBSERVATION] context block injected into LLM messages.
 *
 * The block makes the AI "see" what happened after every tool call —
 * this is what transforms it from blind execution to observable reasoning.
 *
 * Security: ALL content injected into LLM context passes through
 * sanitizeForLlm / sanitizeToolResultJson before reaching the model.
 */

import type { ToolResult }   from "../registry/tool-types.ts";
import type { ExecutionObservation, FailureClass } from "./types.ts";
import { classifyFailure }   from "./observers/failure-classifier.ts";
import { inspectConsole }    from "./observers/console-inspector.ts";
import { inspectRuntime, formatRuntimeHealth } from "./observers/runtime-inspector.ts";
import { adviseAction }      from "./advisor/action-advisor.ts";
import type { RunMemorySummary } from "./memory/execution-entry.ts";
import { sanitizeForLlm, sanitizeToolResultJson } from "../../security/secret-redactor.ts";

// ── Tools that generate noisy but low-value output when succeeding ─────────────
// These skip the observation block on success to reduce LLM context noise.
const SILENT_ON_SUCCESS = new Set([
  "file_read", "file_list", "file_delete",
  "env_read", "git_status", "git_add",
  "agent_think", "agent_wait",
  "network_port_check", "network_dns_lookup",
  "preview_url",
]);

// ── Observation block renderer ─────────────────────────────────────────────────

function renderContextBlock(obs: ExecutionObservation, hint: string): string {
  // Skip block for quiet successes
  if (obs.ok && SILENT_ON_SUCCESS.has(obs.toolName)) return "";

  const status  = obs.ok ? "OK" : `FAILED${obs.failureClass ? ` (${obs.failureClass})` : ""}`;
  const lines:  string[] = [];

  lines.push(`[OBSERVATION tool="${obs.toolName}" status="${status}" duration="${obs.durationMs}ms"]`);

  // Runtime health — most important for server tools
  if (obs.runtimeHealth) {
    lines.push(formatRuntimeHealth(obs.runtimeHealth));
  }

  // Error lines from console (only on failure or server issues)
  // All console lines are sanitized before injection
  if (!obs.ok && obs.errorLines.length > 0) {
    lines.push("Console errors:");
    obs.errorLines
      .slice(0, 8)
      .map(sanitizeForLlm)
      .forEach((l) => lines.push(`  ${l}`));
  } else if (obs.ok && obs.consoleLines.length > 0 && obs.runtimeHealth?.running) {
    // Server just started — show brief output for awareness
    lines.push("Console (last 3 lines):");
    obs.consoleLines
      .slice(-3)
      .map(sanitizeForLlm)
      .forEach((l) => lines.push(`  ${l}`));
  }

  // Recommendation (only on failure or important transitions)
  if (!obs.ok && obs.recommendation !== "continue") {
    lines.push(`Recommendation: ${obs.recommendation.toUpperCase()} — ${sanitizeForLlm(hint)}`);
  }

  lines.push("[/OBSERVATION]");
  return lines.join("\n");
}

// ── Main builder ───────────────────────────────────────────────────────────────

export function buildObservation(
  toolName:    string,
  result:      ToolResult,
  projectId:   number,
  startTs:     number,
  durationMs:  number,
  memory:      RunMemorySummary,
): ExecutionObservation {
  const consoleSn    = inspectConsole(projectId, startTs);
  const runtimeHealth = inspectRuntime(projectId, toolName);

  // Classify failure
  let failureClass: FailureClass | null = null;
  if (!result.ok) {
    const resultData  = result.result as Record<string, unknown> | undefined;
    const exitCode    = resultData?.["exitCode"] as number | undefined;
    const timedOut    = resultData?.["timedOut"] as boolean | undefined;
    const { failureClass: fc } = classifyFailure({
      toolName,
      errorMsg:    sanitizeForLlm(result.error ?? ""),
      consoleText: consoleSn.allLines.map(sanitizeForLlm).join("\n"),
      exitCode,
      timedOut,
    });
    failureClass = fc;
  }

  // Advise next action
  const { recommendation, hint } = adviseAction(failureClass, memory, toolName);

  const obs: ExecutionObservation = {
    toolName,
    ok:            result.ok,
    failureClass,
    durationMs,
    consoleLines:  consoleSn.allLines,
    errorLines:    consoleSn.errorLines,
    runtimeHealth,
    recommendation,
    ts:            Date.now(),
    contextBlock:  "", // filled below
  };

  obs.contextBlock = renderContextBlock(obs, hint);
  return obs;
}

/**
 * Build the full tool message content: sanitized result JSON + observation block.
 *
 * SECURITY: rawJson is sanitized through sanitizeToolResultJson before the LLM
 * sees it. This is the final gate — no secret value can reach the model context.
 */
export function buildObservableContent(
  result:      ToolResult,
  observation: ExecutionObservation,
  maxResultLen = 8_000,
): string {
  const rawJson    = JSON.stringify(result);
  // ── Secret gate: sanitize ALL tool result JSON before LLM injection ──────────
  const sanitized  = sanitizeToolResultJson(rawJson);
  const trimmed    = sanitized.length > maxResultLen
    ? sanitized.slice(0, 4_000) + " ... [truncated] ... " + sanitized.slice(-1_000)
    : sanitized;

  if (!observation.contextBlock) return trimmed;
  return trimmed + "\n" + observation.contextBlock;
}

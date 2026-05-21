/**
 * server/verification/runtime/typescript-validator.ts
 *
 * Real TypeScript validation via deterministic compiler execution.
 * Replaces the previous log-scanning / regex-heuristic approach entirely.
 *
 * GUARANTEE: "passed" is returned if and only if `tsc --noEmit` exits 0.
 *            No log scanning. No hot-reload assumptions. No regex heuristics.
 *
 * Ownership: verification/runtime — adapter between the new TS verification
 * subsystem and the legacy CheckResult interface expected by the engine.
 */

import path from "path";
import { verifyTypeScript }       from "../typescript/index.ts";
import { VerificationResultParser } from "../typescript/result-parser.ts";
import type { CheckResult }        from "../types.ts";

const DEFAULT_WORKSPACE = process.cwd();
const TIMEOUT_MS        = 45_000;
const MAX_RETRIES       = 1;

const _parser = new VerificationResultParser();

// ─── Public API (matches legacy signature) ────────────────────────────────────

export async function checkTypeScript(
  _projectId: number,
  workspacePath: string = DEFAULT_WORKSPACE
): Promise<CheckResult> {
  let result;
  try {
    result = await verifyTypeScript({
      workspacePath,
      timeoutMs:  TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
      skipCache:  false,
    });
  } catch (err) {
    // Hard crash in the orchestrator itself — treat as CORRUPTED, not passed
    return {
      name:    "typescript_errors",
      status:  "failed",
      message: "TypeScript verification subsystem threw unexpectedly.",
      detail:  String(err),
    };
  }

  // ── PASSED ────────────────────────────────────────────────────────────────
  if (result.passed) {
    const notice = result.warningCount > 0
      ? ` (${result.warningCount} warning(s) present)`
      : "";
    return {
      name:    "typescript_errors",
      status:  "passed",
      message: `TypeScript compilation passed — tsc --noEmit exited 0${notice}.`,
    };
  }

  // ── CANCELLED ─────────────────────────────────────────────────────────────
  if (result.state === "CANCELLED") {
    return {
      name:    "typescript_errors",
      status:  "failed",
      message: "TypeScript verification was cancelled.",
      detail:  "Re-run verification once the agent completes its current action.",
    };
  }

  // ── TIMEOUT ───────────────────────────────────────────────────────────────
  if (result.state === "TIMEOUT") {
    return {
      name:    "typescript_errors",
      status:  "failed",
      message: `TypeScript verification timed out after ${TIMEOUT_MS / 1000}s.`,
      detail:  "The project may have an unusually large type graph. Consider splitting tsconfig files.",
    };
  }

  // ── CORRUPTED ─────────────────────────────────────────────────────────────
  if (result.state === "CORRUPTED") {
    return {
      name:    "typescript_errors",
      status:  "failed",
      message: "TypeScript compiler produced unparseable output.",
      detail:  result.failureReason ?? "Output could not be parsed into typed diagnostics.",
    };
  }

  // ── No tsconfig found ─────────────────────────────────────────────────────
  if (!result.tsconfigPath) {
    return {
      name:    "typescript_errors",
      status:  "failed",
      message: "No tsconfig.json found in workspace.",
      detail:  `Add a tsconfig.json to ${workspacePath}.`,
    };
  }

  // ── FAILED with diagnostics ───────────────────────────────────────────────
  const errors = result.diagnostics.filter(d => d.severity === "error");
  const summary = _parser.summarise(result.diagnostics, 8);

  return {
    name:    "typescript_errors",
    status:  "failed",
    message: `${errors.length} TypeScript error(s) detected — tsc --noEmit exited ${result.execution.exitCode}.`,
    detail:  [
      "Fix all type errors before marking the task complete.",
      "",
      summary,
    ].join("\n"),
  };
}

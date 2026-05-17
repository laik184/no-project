/**
 * server/security/execution-policy.ts
 *
 * Runtime execution policies: per-command rate limits, blocked domain lists,
 * URL argument detection, and execution audit trail.
 *
 * Kept separate from command-validator.ts (which is pure string logic)
 * so this file can be extended with DB-backed policies without touching validation.
 */

import { validateCommand, validateArgs, validatePackageName } from "./command-validator.ts";
import type { ValidationResult } from "./command-validator.ts";
export type { ValidationResult };

// ── URL detection in arguments ────────────────────────────────────────────────
// Block any argument that looks like a remote URL (http/https/ftp/git).

const URL_ARG_RE = /^(https?|ftp|git\+https?|git):\/\//i;

export function containsUrlArg(args: string[]): ValidationResult {
  for (const arg of args) {
    if (URL_ARG_RE.test(arg)) {
      return { valid: false, reason: `URL argument "${arg.slice(0, 80)}" is not allowed — use local paths only` };
    }
  }
  return { valid: true };
}

// ── Package install policy ────────────────────────────────────────────────────

export interface PackagePolicy {
  valid:    boolean;
  reason?:  string;
  cleaned?: string[];
}

export function validatePackageInstallArgs(packages: unknown[]): PackagePolicy {
  if (!Array.isArray(packages)) {
    return { valid: false, reason: "packages must be an array" };
  }
  const cleaned: string[] = [];
  for (const raw of packages) {
    const pkg = String(raw).trim();
    if (!pkg) continue;
    const result = validatePackageName(pkg);
    if (!result.valid) return { valid: false, reason: result.reason };
    cleaned.push(pkg);
  }
  return { valid: true, cleaned };
}

// ── Full shell_exec pre-flight ────────────────────────────────────────────────
// One call that runs all checks in the correct order.

export interface PreFlightResult {
  valid:   boolean;
  reason?: string;
}

export function shellExecPreFlight(
  command: string,
  args:    string[],
): PreFlightResult {
  const cmdResult = validateCommand(command);
  if (!cmdResult.valid) return cmdResult;

  const argsResult = validateArgs(command, args);
  if (!argsResult.valid) return argsResult;

  const urlResult = containsUrlArg(args);
  if (!urlResult.valid) return urlResult;

  return { valid: true };
}

// ── In-memory execution audit (ring buffer) ───────────────────────────────────

export interface ExecutionAuditEntry {
  ts:        number;
  command:   string;
  args:      string[];
  projectId: number;
  runId?:    string;
  blocked:   boolean;
  reason?:   string;
  exitCode?: number | null;
  durationMs?: number;
}

const MAX_AUDIT = 500;
const _audit: ExecutionAuditEntry[] = [];

export function recordExecution(entry: ExecutionAuditEntry): void {
  _audit.push(entry);
  if (_audit.length > MAX_AUDIT) _audit.shift();
}

export function getExecutionAudit(limit = 50): ExecutionAuditEntry[] {
  return _audit.slice(-limit);
}

export function getBlockedExecutions(limit = 50): ExecutionAuditEntry[] {
  return _audit.filter((e) => e.blocked).slice(-limit);
}

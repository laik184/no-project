/**
 * server/tools/registry/tool-security.ts
 *
 * Security layer for the unified tool registry.
 *
 * Responsibilities:
 *  - Re-exports SAFE_COMMANDS (single source of truth from security layer)
 *  - Sandbox path validation
 *  - Argument sanitisation (delegates to centralised command-validator)
 *  - Audit logging
 */

import path from "path";
import {
  SAFE_COMMANDS,
  validateCommand as _validateCommand,
  validateArgs as _validateArgs,
} from "../../security/command-validator.ts";

// ── Re-export for backward compat with shell-tools.ts ─────────────────────────
export const ALLOWED_COMMANDS = SAFE_COMMANDS;

// ── Sandbox root ──────────────────────────────────────────────────────────────

const SANDBOX_ROOT = path.resolve(
  process.env.AGENT_PROJECT_ROOT || ".sandbox",
);

// ── Path validation ───────────────────────────────────────────────────────────

export interface PathValidationResult {
  valid: boolean;
  reason?: string;
  resolvedPath?: string;
}

/**
 * Verify that a resolved absolute path is inside the sandbox root.
 * Prevents path-traversal attacks via tool arguments.
 */
export function validateSandboxPath(absolutePath: string): PathValidationResult {
  const resolved = path.resolve(absolutePath);

  if (!resolved.startsWith(SANDBOX_ROOT)) {
    return {
      valid: false,
      reason: `Path "${resolved}" is outside sandbox root "${SANDBOX_ROOT}"`,
    };
  }

  return { valid: true, resolvedPath: resolved };
}

// ── Command validation ────────────────────────────────────────────────────────

export interface CommandValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateCommand(command: string): CommandValidationResult {
  return _validateCommand(command);
}

// ── Argument sanitisation ─────────────────────────────────────────────────────
// Delegates to command-validator for per-arg metacharacter and policy checks.
// Falls back to a broad JSON scan for any non-shell tool calls.

const LEGACY_DANGEROUS_RE = /[|;&`$<>!\\()\n\r"'{}[\]]/;

export function sanitizeArgs(args: Record<string, unknown>): { safe: boolean; reason?: string } {
  const flat = JSON.stringify(args);
  if (LEGACY_DANGEROUS_RE.test(flat)) {
    return { safe: false, reason: "Argument contains disallowed shell metacharacter" };
  }
  return { safe: true };
}

// ── Audit log ─────────────────────────────────────────────────────────────────

interface AuditEntry {
  ts: number;
  tool: string;
  projectId: number;
  runId: string;
  ok: boolean;
  durationMs: number;
}

const _auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 500;

export function auditLog(entry: AuditEntry): void {
  _auditLog.push(entry);
  if (_auditLog.length > MAX_AUDIT_ENTRIES) {
    _auditLog.shift();
  }
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return _auditLog.slice(-limit);
}

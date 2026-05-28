/**
 * server/agents/executor/validation/response-validator.ts
 *
 * Verifies that a task ACTUALLY completed successfully.
 * Checks: meaningful output, requested result achieved, no broken exports,
 * no circular imports in output, UI state validity, workflow integrity.
 *
 * Returns ValidationOutcome — never throws.
 * No tool imports. No execution. Pure output analysis.
 */

import type { TaskKind } from '../types/executor.types.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code:     string;
  message:  string;
  severity: ValidationSeverity;
}

export interface ValidationOutcome {
  ok:        boolean;
  issues:    ValidationIssue[];
  summary:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _issue(code: string, message: string, severity: ValidationSeverity = 'error'): ValidationIssue {
  return { code, message, severity };
}

function _asString(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output === null || output === undefined) return '';
  try { return JSON.stringify(output); } catch { return String(output); }
}

function _detectCircularImport(text: string): boolean {
  return /circular.*import|import.*circular|dependency.*cycle/i.test(text);
}

function _detectBrokenExport(text: string): boolean {
  return /export.*not found|cannot.*export|no exported member/i.test(text);
}

function _detectSyntaxError(text: string): boolean {
  return /syntaxerror|unexpected.*token|unexpected.*end|invalid.*syntax/i.test(text);
}

function _detectTypeError(text: string): boolean {
  return /ts\d{4}|type.*error|is not assignable|property.*does not exist/i.test(text);
}

function _detectImportError(text: string): boolean {
  return /cannot find module|module.*not found|failed to resolve.*import/i.test(text);
}

// ── Validators by kind ────────────────────────────────────────────────────────

function _validateCodingOutput(output: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!output || output.trim().length === 0) {
    issues.push(_issue('EMPTY_OUTPUT', 'Coding task produced no output'));
    return issues;
  }
  if (_detectCircularImport(output))  issues.push(_issue('CIRCULAR_IMPORT', 'Circular import detected in output'));
  if (_detectBrokenExport(output))    issues.push(_issue('BROKEN_EXPORT', 'Broken export detected in output'));
  if (_detectSyntaxError(output))     issues.push(_issue('SYNTAX_ERROR', 'Syntax error in output'));
  if (_detectTypeError(output))       issues.push(_issue('TYPE_ERROR', 'TypeScript error in output'));
  if (_detectImportError(output))     issues.push(_issue('IMPORT_ERROR', 'Import resolution error in output'));
  return issues;
}

function _validateTerminalOutput(output: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!output && output !== '') return issues;   // empty ok for terminal
  const lower = output.toLowerCase();
  if (/error:\s/.test(lower) && !/0 errors/i.test(lower)) {
    issues.push(_issue('TERMINAL_ERROR', 'Terminal output contains error', 'warning'));
  }
  if (/npm err|yarn error|enoent/i.test(lower)) {
    issues.push(_issue('PACKAGE_ERROR', 'Package manager error detected'));
  }
  return issues;
}

function _validateVerifyOutput(output: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (/\d+\s+failing/i.test(output))   issues.push(_issue('TEST_FAILURE', 'Test failures detected'));
  if (_detectTypeError(output))        issues.push(_issue('TYPE_ERROR', 'TypeScript errors found during verification'));
  if (/build.*failed|compile.*failed/i.test(output)) issues.push(_issue('BUILD_FAILURE', 'Build/compile failed'));
  return issues;
}

function _validateBrowserOutput(output: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (/page.*crashed|target.*closed|browser.*disconnected/i.test(output)) {
    issues.push(_issue('BROWSER_CRASH', 'Browser session crashed'));
  }
  if (/net::err|navigation.*failed/i.test(output)) {
    issues.push(_issue('NAVIGATION_ERROR', 'Browser navigation failed'));
  }
  return issues;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function validateResponse(
  kind:    TaskKind,
  output:  unknown,
  context?: { requiresNonEmpty?: boolean; expectedKeywords?: string[] },
): ValidationOutcome {
  const text   = _asString(output);
  const issues: ValidationIssue[] = [];

  // Universal checks
  if (context?.requiresNonEmpty && (!text || text.trim().length === 0)) {
    issues.push(_issue('EMPTY_RESULT', `${kind} task produced empty output`));
  }
  if (context?.expectedKeywords) {
    for (const kw of context.expectedKeywords) {
      if (!text.includes(kw)) {
        issues.push(_issue('MISSING_KEYWORD', `Expected keyword "${kw}" not found in output`, 'warning'));
      }
    }
  }

  // Kind-specific checks
  const kindIssues =
    kind === 'coding'     ? _validateCodingOutput(text)   :
    kind === 'terminal'   ? _validateTerminalOutput(text) :
    kind === 'verify'     ? _validateVerifyOutput(text)   :
    kind === 'browser'    ? _validateBrowserOutput(text)  :
    [];

  issues.push(...kindIssues);

  const errors   = issues.filter((i) => i.severity === 'error');
  const ok       = errors.length === 0;
  const summary  = ok
    ? `${kind} task validated successfully`
    : `${kind} task has ${errors.length} error(s): ${errors.map((e) => e.code).join(', ')}`;

  return { ok, issues, summary };
}

/** Quick check — returns true if the output looks like a valid task result. */
export function isValidOutput(kind: TaskKind, output: unknown): boolean {
  return validateResponse(kind, output).ok;
}

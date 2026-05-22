/**
 * server/quantum/conflicts/validation-gate.ts
 *
 * Validates merged file content before committing to the sandbox.
 * Fail-closed: any ERROR-severity issue blocks the write.
 *
 * Validators
 * ──────────
 *   Syntax         — unmatched braces/parens, obvious broken structure
 *   Import safety  — malformed import statements, missing paths
 *   Circular hints — self-referential imports, obvious cycles
 *   Safety markers — dangerous runtime patterns (eval, global mutation)
 *   Content sanity — empty content, excessive size
 */

import { emitValidationFailed } from "../telemetry/conflict-telemetry.ts";
import type { ValidationResult, ValidationIssue } from "./conflict-types.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 500_000;  // 500 KB hard limit per merged file
const DANGEROUS_PATTERNS  = [
  { re: /\beval\s*\(/, code: "UNSAFE_EVAL",   msg: "eval() usage detected in merged content" },
  { re: /\bFunction\s*\(.*\)/, code: "UNSAFE_FUNCTION_CTOR", msg: "Function() constructor detected" },
  { re: /globalThis\s*\[.*\]\s*=/, code: "GLOBAL_MUTATION", msg: "Dynamic globalThis mutation" },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate merged file content before committing.
 * Returns a ValidationResult; if `passed` is false, the write should be blocked.
 */
export async function validateMergedContent(
  filePath: string,
  content:  string,
  runId:    string,
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  issues.push(...checkContentSanity(content, filePath));
  issues.push(...checkBraceBalance(content));
  issues.push(...checkImportSafety(content));
  issues.push(...checkCircularHints(content, filePath));
  issues.push(...checkSafetyMarkers(content));

  const passed = !issues.some(i => i.severity === "error");

  if (!passed) {
    const first = issues.find(i => i.severity === "error")!;
    emitValidationFailed(runId, filePath, issues.filter(i => i.severity === "error").length, first.message);
  }

  return { filePath, passed, issues, checkedAt: Date.now() };
}

// ── Validators ────────────────────────────────────────────────────────────────

function checkContentSanity(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!content || content.trim().length === 0) {
    issues.push({ code: "EMPTY_CONTENT", severity: "error", message: "Merged content is empty" });
    return issues;
  }

  if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
    issues.push({
      code:     "FILE_TOO_LARGE",
      severity: "error",
      message:  `Merged content exceeds ${MAX_FILE_SIZE_BYTES / 1024}KB limit`,
    });
  }

  return issues;
}

function checkBraceBalance(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines   = content.split("\n");
  let   depth   = 0;
  let   parenD  = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip string content (simplified heuristic)
    const stripped = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, "``");

    for (const ch of stripped) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (ch === "(") parenD++;
      if (ch === ")") parenD--;
    }

    if (depth < 0) {
      issues.push({ code: "UNMATCHED_BRACE", severity: "error", message: "Unmatched closing brace detected", line: i + 1 });
      break;
    }
  }

  if (depth !== 0) {
    issues.push({ code: "UNCLOSED_BRACE", severity: "error", message: `Unclosed braces at end of file (depth=${depth})` });
  }
  if (parenD !== 0) {
    issues.push({ code: "UNCLOSED_PAREN", severity: "warning", message: `Unbalanced parentheses (delta=${parenD})` });
  }

  return issues;
}

function checkImportSafety(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const importLines = content.split("\n").filter(l => l.trim().startsWith("import "));

  for (let i = 0; i < importLines.length; i++) {
    const line = importLines[i];
    // Malformed import: has "from" but no quoted path
    if (line.includes(" from ") && !/from\s+['"][^'"]+['"]/.test(line)) {
      issues.push({
        code:     "MALFORMED_IMPORT",
        severity: "error",
        message:  `Malformed import statement: ${line.trim().slice(0, 60)}`,
      });
    }
  }

  return issues;
}

function checkCircularHints(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fileName = filePath.split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/, "") ?? "";

  // Self-import heuristic
  const selfImport = new RegExp(`from\\s+['"].*/${fileName}['"]`);
  if (fileName && selfImport.test(content)) {
    issues.push({
      code:     "POSSIBLE_SELF_IMPORT",
      severity: "warning",
      message:  `Possible self-import detected in ${filePath}`,
    });
  }

  return issues;
}

function checkSafetyMarkers(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const { re, code, msg } of DANGEROUS_PATTERNS) {
    if (re.test(content)) {
      issues.push({ code, severity: "warning", message: msg });
    }
  }

  // Conflict markers left by a failed merge tool
  if (/<<<<<<<|=======|>>>>>>>/.test(content)) {
    issues.push({ code: "UNRESOLVED_CONFLICT_MARKERS", severity: "error", message: "Unresolved merge conflict markers found in content" });
  }

  return issues;
}

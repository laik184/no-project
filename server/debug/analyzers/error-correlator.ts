/**
 * error-correlator.ts
 *
 * Map extracted errors to actionable fix hints.
 *
 * Pure function — no I/O, no bus, no state.
 * Converts classified errors into structured hints the recovery goal-builder
 * can inject into the LLM prompt, making recovery faster and more targeted.
 *
 * Ownership: autonomous-debug/analyzers — single responsibility: correlation.
 */

import type { ExtractedError, ErrorCorrelation, SuggestedAction } from "../types/debug-types.ts";

// ─── Correlation rules ────────────────────────────────────────────────────────

interface CorrelationRule {
  errorTypes: string[];
  action: SuggestedAction;
  hintTemplate: (err: ExtractedError) => string;
  extractPackage?: (err: ExtractedError) => string | undefined;
}

const RULES: CorrelationRule[] = [
  {
    errorTypes: ["missing_module"],
    action: "install_package",
    hintTemplate: (e) => {
      const match = /cannot find module ['"]([^'"]+)['"]/i.exec(e.message);
      const pkg   = match?.[1]?.replace(/^@types\//, "") ?? "unknown";
      return `Install the missing package: run \`npm install ${pkg}\`. If it's a type package, try \`npm install -D @types/${pkg.replace("@types/", "")}\`.`;
    },
    extractPackage: (e) => {
      const match = /cannot find module ['"]([^'"]+)['"]/i.exec(e.message);
      return match?.[1];
    },
  },
  {
    errorTypes: ["syntax_error", "syntaxerror"],
    action: "fix_file",
    hintTemplate: (e) => {
      const frame = e.frames[0];
      if (frame?.file && frame.line) {
        return `Syntax error in \`${frame.file}\` at line ${frame.line}. Open the file, locate the syntax issue, and fix it. Common causes: missing closing bracket, extra comma, incorrect JSX.`;
      }
      return `Syntax error detected: ${e.message}. Check recent file edits for syntax issues.`;
    },
  },
  {
    errorTypes: ["compile_error"],
    action: "fix_file",
    hintTemplate: (e) => {
      const frame = e.frames[0];
      if (frame?.file && frame.line) {
        return `Compilation error in \`${frame.file}\` at line ${frame.line}: ${e.message}. Fix the type or syntax issue at that location.`;
      }
      return `Compilation error: ${e.message}. Run \`npx tsc --noEmit\` for the full error list.`;
    },
  },
  {
    errorTypes: ["runtime_error", "typeerror", "referenceerror"],
    action: "fix_file",
    hintTemplate: (e) => {
      const frame = e.frames.find(f => !f.file.includes("node_modules") && !f.file.startsWith("node:"));
      if (frame?.file && frame.line) {
        return `Runtime error at \`${frame.file}\`:${frame.line}: ${e.message}. Inspect and fix the runtime issue at that location.`;
      }
      return `Runtime error: ${e.message}. Check recent changes to project files.`;
    },
  },
  {
    errorTypes: ["port_conflict"],
    action: "restart_server",
    hintTemplate: () =>
      "Port is already in use. Call server_stop then server_start to bind a fresh port.",
  },
  {
    errorTypes: ["permission"],
    action: "fix_file",
    hintTemplate: (e) =>
      `Permission denied error: ${e.message}. Check file permissions or path resolution in project.`,
  },
  {
    errorTypes: ["oom"],
    action: "restart_server",
    hintTemplate: () =>
      "Out-of-memory crash detected. Restart the server and check for memory leaks or unbounded data structures.",
  },
];

// ─── Correlator ───────────────────────────────────────────────────────────────

/**
 * Correlate a list of extracted errors into actionable fix hints.
 * De-duplicates by suggested action to avoid redundant hints.
 */
export function correlateErrors(errors: ExtractedError[]): ErrorCorrelation[] {
  const result: ErrorCorrelation[] = [];
  const seenActions = new Set<string>();

  for (const err of errors) {
    const rule = RULES.find(r =>
      r.errorTypes.some(t => err.type.toLowerCase().includes(t))
    );

    if (!rule) {
      // Fallback: generic hint
      const key = `unknown:${err.message.slice(0, 40)}`;
      if (!seenActions.has(key)) {
        seenActions.add(key);
        result.push({
          errorType:       err.type,
          hint:            `Unknown error: ${err.message.slice(0, 200)}. Check server logs and recent file changes.`,
          affectedFiles:   err.frames.map(f => f.file).filter(f => !f.includes("node_modules")),
          suggestedAction: "unknown",
        });
      }
      continue;
    }

    const actionKey = `${rule.action}:${err.message.slice(0, 40)}`;
    if (seenActions.has(actionKey)) continue;
    seenActions.add(actionKey);

    result.push({
      errorType:       err.type,
      hint:            rule.hintTemplate(err),
      affectedFiles:   err.frames.map(f => f.file).filter(f => !f.includes("node_modules")),
      suggestedAction: rule.action,
      packageName:     rule.extractPackage?.(err),
    });
  }

  return result;
}

/** Render correlations as a human-readable block for LLM prompt injection. */
export function renderCorrelations(correlations: readonly ErrorCorrelation[]): string {
  if (correlations.length === 0) return "";

  const lines = ["DIAGNOSTIC HINTS (pre-analyzed):"];
  for (const c of correlations) {
    lines.push(`  • [${c.suggestedAction}] ${c.hint}`);
    if (c.affectedFiles.length > 0) {
      lines.push(`    Affected files: ${c.affectedFiles.slice(0, 3).join(", ")}`);
    }
  }
  return lines.join("\n");
}

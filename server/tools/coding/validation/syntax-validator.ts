/**
 * server/tools/coding/validation/syntax-validator.ts
 *
 * Basic structural syntax checks on generated TypeScript/TSX code.
 * Pure functions — no I/O, no execution.
 */

export interface SyntaxValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

function checkBraceBalance(code: string): string | null {
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inStr) {
      if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return depth !== 0 ? `Unbalanced braces (net depth: ${depth})` : null;
}

function checkParenBalance(code: string): string | null {
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inStr) {
      if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }
  return depth !== 0 ? `Unbalanced parentheses (net depth: ${depth})` : null;
}

function checkNoPlaceholders(code: string): string[] {
  const issues: string[] = [];
  const patterns = [/TODO:/gi, /FIXME:/gi, /\/\/ \.\.\./g, /placeholder/gi];
  for (const p of patterns) {
    if (p.test(code)) issues.push(`Contains placeholder/TODO: ${p.source}`);
  }
  return issues;
}

function checkHasExport(code: string): string | null {
  if (!/\bexport\b/.test(code)) return 'File has no exports';
  return null;
}

function checkImportPaths(code: string, filepath: string): string[] {
  const issues: string[] = [];
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code)) !== null) {
    const p = m[1];
    if (p.includes('..') && p.split('/').filter(s => s === '..').length > 6) {
      issues.push(`Suspicious deep relative import in ${filepath}: ${p}`);
    }
    if (p.startsWith('/') && !p.startsWith('/node_modules')) {
      issues.push(`Absolute import path may not resolve: ${p}`);
    }
  }
  return issues;
}

export function validateSyntax(
  filepath: string,
  code:     string,
): SyntaxValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const braceErr = checkBraceBalance(code);
  if (braceErr)  errors.push(braceErr);

  const parenErr = checkParenBalance(code);
  if (parenErr)  errors.push(parenErr);

  const placeholders = checkNoPlaceholders(code);
  warnings.push(...placeholders);

  const exportErr = checkHasExport(code);
  if (exportErr) warnings.push(exportErr);

  const importIssues = checkImportPaths(code, filepath);
  warnings.push(...importIssues);

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAllSyntax(
  files: Record<string, string>,
): SyntaxValidationResult {
  const allErrors:   string[] = [];
  const allWarnings: string[] = [];

  for (const [filepath, code] of Object.entries(files)) {
    const result = validateSyntax(filepath, code);
    allErrors.push(...result.errors.map(e => `[${filepath}] ${e}`));
    allWarnings.push(...result.warnings.map(w => `[${filepath}] ${w}`));
  }

  return {
    valid:    allErrors.length === 0,
    errors:   allErrors,
    warnings: allWarnings,
  };
}

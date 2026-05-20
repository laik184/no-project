import { ValidationInput, ValidationIssue } from "../types";

export function validateConsistency(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const code = input.code;

  issues.push(...checkNamingConsistency(code));
  issues.push(...checkQuoteConsistency(code));
  issues.push(...checkIndentationConsistency(code));
  issues.push(...checkImportStyle(code));
  issues.push(...checkExportConsistency(code));

  return Object.freeze(issues);
}

function checkNamingConsistency(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const camelCaseVars    = (code.match(/\bconst\s+[a-z][a-zA-Z0-9]*\b/g) ?? []).length;
  const snakeCaseVars    = (code.match(/\bconst\s+[a-z][a-z0-9_]*_[a-z]/g) ?? []).length;

  if (camelCaseVars > 2 && snakeCaseVars > 2) {
    issues.push(Object.freeze({
      type: "consistency" as const,
      severity: "medium" as const,
      message: `Mixed naming conventions detected: ${camelCaseVars} camelCase vs ${snakeCaseVars} snake_case variables.`,
      rule: "mixed-naming-convention",
    }));
  }

  const pascalFunctions  = (code.match(/function\s+[A-Z][a-zA-Z0-9]*/g) ?? []).length;
  const camelFunctions   = (code.match(/function\s+[a-z][a-zA-Z0-9]*/g) ?? []).length;
  if (pascalFunctions > 0 && camelFunctions > 0) {
    issues.push(Object.freeze({
      type: "consistency" as const,
      severity: "low" as const,
      message: "Function names mix PascalCase and camelCase — standardize naming convention.",
      rule: "mixed-function-naming",
    }));
  }

  return issues;
}

function checkQuoteConsistency(code: string): ValidationIssue[] {
  const singleQuotes = (code.match(/(?<!\\)'/g) ?? []).length;
  const doubleQuotes = (code.match(/(?<!\\)"/g) ?? []).length;

  if (singleQuotes > 5 && doubleQuotes > 5) {
    const ratio = Math.min(singleQuotes, doubleQuotes) / Math.max(singleQuotes, doubleQuotes);
    if (ratio > 0.3) {
      return [Object.freeze({
        type: "consistency" as const,
        severity: "low" as const,
        message: `Mixed string quotes: ${singleQuotes} single vs ${doubleQuotes} double — use a consistent style.`,
        rule: "mixed-quote-style",
      })];
    }
  }
  return [];
}

function checkIndentationConsistency(code: string): ValidationIssue[] {
  const lines = code.split("\n").filter((l) => l.startsWith(" ") || l.startsWith("\t"));
  const tabLines   = lines.filter((l) => l.startsWith("\t")).length;
  const spaceLines = lines.filter((l) => l.startsWith("  ")).length;

  if (tabLines > 2 && spaceLines > 2) {
    return [Object.freeze({
      type: "consistency" as const,
      severity: "medium" as const,
      message: `Mixed indentation: ${tabLines} tab-indented and ${spaceLines} space-indented lines.`,
      rule: "mixed-indentation",
    })];
  }
  return [];
}

function checkImportStyle(code: string): ValidationIssue[] {
  const esImports  = (code.match(/^import\s+/gm) ?? []).length;
  const cjsImports = (code.match(/\brequire\s*\(/g) ?? []).length;

  if (esImports > 0 && cjsImports > 0) {
    return [Object.freeze({
      type: "consistency" as const,
      severity: "high" as const,
      message: `Mixed module systems: ${esImports} ES import(s) and ${cjsImports} require() call(s) — choose one.`,
      rule: "mixed-module-system",
    })];
  }
  return [];
}

function checkExportConsistency(code: string): ValidationIssue[] {
  const namedExports   = (code.match(/\bexport\s+(const|function|class|type|interface)\b/g) ?? []).length;
  const defaultExports = (code.match(/\bexport\s+default\b/g) ?? []).length;

  if (namedExports > 3 && defaultExports > 1) {
    return [Object.freeze({
      type: "consistency" as const,
      severity: "low" as const,
      message: `Multiple default exports detected alongside named exports — prefer named exports for tree-shaking.`,
      rule: "multiple-default-exports",
    })];
  }
  return [];
}

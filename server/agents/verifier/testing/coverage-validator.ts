export interface CoverageThresholds {
  lines?:     number;
  functions?: number;
  branches?:  number;
  statements?: number;
}

export interface CoverageResult {
  lines?:      number;
  functions?:  number;
  branches?:   number;
  statements?: number;
}

export interface CoverageValidationResult {
  passed:    boolean;
  errors:    string[];
  coverage:  CoverageResult;
}

const COV_LINE_PATTERN   = /lines\s*[:\|]\s*([\d.]+)%/i;
const COV_FUNC_PATTERN   = /(?:functions|funcs)\s*[:\|]\s*([\d.]+)%/i;
const COV_BRANCH_PATTERN = /branches\s*[:\|]\s*([\d.]+)%/i;
const COV_STMT_PATTERN   = /statements\s*[:\|]\s*([\d.]+)%/i;

export function parseCoverageOutput(output: string): CoverageResult {
  function extract(pattern: RegExp): number | undefined {
    const m = output.match(pattern);
    return m ? parseFloat(m[1]) : undefined;
  }

  return {
    lines:      extract(COV_LINE_PATTERN),
    functions:  extract(COV_FUNC_PATTERN),
    branches:   extract(COV_BRANCH_PATTERN),
    statements: extract(COV_STMT_PATTERN),
  };
}

export function validateCoverage(
  output:     string,
  thresholds: CoverageThresholds,
): CoverageValidationResult {
  const coverage = parseCoverageOutput(output);
  const errors:  string[] = [];

  const checks: Array<[keyof CoverageResult, number | undefined]> = [
    ['lines',      thresholds.lines],
    ['functions',  thresholds.functions],
    ['branches',   thresholds.branches],
    ['statements', thresholds.statements],
  ];

  for (const [key, threshold] of checks) {
    if (threshold === undefined) continue;
    const actual = coverage[key];
    if (actual === undefined) {
      errors.push(`Coverage metric "${key}" not found in output`);
    } else if (actual < threshold) {
      errors.push(`Coverage "${key}" is ${actual}%, below threshold ${threshold}%`);
    }
  }

  return { passed: errors.length === 0, errors, coverage };
}

import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export interface CoverageReport {
  lines:      number;
  branches:   number;
  functions:  number;
  statements: number;
  meets:      boolean;
  threshold:  number;
}

const COVERAGE_PATTERN = /(?:Lines|Branches|Funcs|Stmts)\s*:\s*([\d.]+)%/gi;

export function parseCoverage(output: string, threshold = 0): CoverageReport {
  const matches = [...output.matchAll(COVERAGE_PATTERN)];
  const values  = matches.map(m => parseFloat(m[1]));
  const [lines = 0, branches = 0, functions = 0, statements = 0] = values;
  const avg   = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  return { lines, branches, functions, statements, meets: avg >= threshold, threshold };
}

export const coverageValidatorTool: ToolDefinition = {
  name:        'validate_coverage',
  category:    'verifier',
  description: 'Parse and validate test coverage from output',
  inputSchema: {
    output:    { type: 'string', description: 'Test output with coverage', required: true },
    threshold: { type: 'number', description: 'Minimum coverage % (default: 0)' },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = parseCoverage(input.output as string, Number(input.threshold ?? 0));
    return toToolOk(result, Date.now() - start);
  },
};

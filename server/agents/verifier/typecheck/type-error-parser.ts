/**
 * typecheck/type-error-parser.ts
 * Parses tsc output into structured TypeScript error objects.
 * Called by server/tools/verifier/typecheck/typescript-parser.ts.
 */

import type { ParsedError } from '../types/diagnostics.types.ts';

export interface TypeScriptError {
  file:    string;
  line:    number;
  col:     number;
  code:    number;
  message: string;
  raw:     string;
}

const TS_ERROR_RE = /^(.+?)\((\d+),(\d+)\):\s+error TS(\d+):\s+(.+)$/;

export function parseTscOutput(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  for (const line of output.split('\n')) {
    const m = TS_ERROR_RE.exec(line.trim());
    if (!m) continue;
    errors.push({ file: m[1], line: parseInt(m[2], 10), col: parseInt(m[3], 10), code: parseInt(m[4], 10), message: m[5], raw: line.trim() });
  }
  return errors;
}

export function extractErrorCount(output: string): number {
  return (output.match(/error TS\d{4}/g) ?? []).length;
}

export function rawToParseError(e: TypeScriptError): ParsedError {
  return {
    message:  `TS${e.code}: ${e.message}`,
    severity: 'error',
    category: 'typecheck',
    file:     e.file,
    line:     e.line,
    column:   e.col,
    code:     `TS${e.code}`,
    raw:      e.raw,
  };
}

export function groupByFile(errors: TypeScriptError[]): Map<string, TypeScriptError[]> {
  const map = new Map<string, TypeScriptError[]>();
  for (const e of errors) {
    if (!map.has(e.file)) map.set(e.file, []);
    map.get(e.file)!.push(e);
  }
  return map;
}

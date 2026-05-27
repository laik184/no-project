import type { ParsedError } from '../types/diagnostics.types.ts';
import { parseLines } from '../utils/parser-utils.ts';

const TS_ERROR_PATTERN = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
const TS_WARN_PATTERN  = /^(.+?)\((\d+),(\d+)\):\s*warning\s+(TS\d+):\s*(.+)$/;

export interface RawTypeError {
  file:     string;
  line:     number;
  column:   number;
  code:     string;
  message:  string;
  isError:  boolean;
}

export function parseTscOutput(output: string): RawTypeError[] {
  const lines  = parseLines(output);
  const errors: RawTypeError[] = [];

  for (const line of lines) {
    const errMatch = line.match(TS_ERROR_PATTERN);
    if (errMatch) {
      errors.push({
        file:    errMatch[1],
        line:    parseInt(errMatch[2], 10),
        column:  parseInt(errMatch[3], 10),
        code:    errMatch[4],
        message: errMatch[5],
        isError: true,
      });
      continue;
    }

    const warnMatch = line.match(TS_WARN_PATTERN);
    if (warnMatch) {
      errors.push({
        file:    warnMatch[1],
        line:    parseInt(warnMatch[2], 10),
        column:  parseInt(warnMatch[3], 10),
        code:    warnMatch[4],
        message: warnMatch[5],
        isError: false,
      });
    }
  }

  return errors;
}

export function rawToParseError(raw: RawTypeError): ParsedError {
  return {
    message:  raw.message,
    severity: raw.isError ? 'error' : 'warning',
    category: 'typecheck',
    file:     raw.file,
    line:     raw.line,
    column:   raw.column,
    code:     raw.code,
    raw:      `${raw.file}(${raw.line},${raw.column}): ${raw.code}: ${raw.message}`,
  };
}

export function extractErrorCount(output: string): number {
  const m = output.match(/Found (\d+) error/);
  return m ? parseInt(m[1], 10) : 0;
}

import type { ParsedError } from './verifier-types.ts';

export interface RawTscError {
  file:    string;
  line:    number;
  column:  number;
  code:    string;
  message: string;
}

const TSC_LINE_RE = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;
const ERROR_COUNT = /Found (\d+) error/i;

export function parseTscOutput(output: string): RawTscError[] {
  return output
    .split('\n')
    .reduce<RawTscError[]>((acc, line) => {
      const m = TSC_LINE_RE.exec(line);
      if (!m) return acc;
      acc.push({
        file:    m[1]!.trim(),
        line:    parseInt(m[2]!, 10),
        column:  parseInt(m[3]!, 10),
        code:    m[4]!.trim(),
        message: m[5]!.trim(),
      });
      return acc;
    }, []);
}

export function extractErrorCount(output: string): number {
  const m = ERROR_COUNT.exec(output);
  return m ? parseInt(m[1]!, 10) : 0;
}

export function rawToParseError(raw: RawTscError): ParsedError {
  return {
    message:  raw.message,
    severity: 'error',
    category: 'type',
    file:     raw.file,
    line:     raw.line,
    column:   raw.column,
    code:     raw.code,
  };
}

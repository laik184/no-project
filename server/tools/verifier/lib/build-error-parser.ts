import type { ParsedError, ErrorSeverity, FailureCategory } from './verifier-types.ts';

const ERROR_LINE_RE = /(?:error|warning)\s*(?:TS\d+)?:\s*(.+)/i;
const FILE_LOC_RE   = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+)?:\s*(.+)/i;

export function parseBuildErrors(output: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const fileLoc = FILE_LOC_RE.exec(line);
    if (fileLoc) {
      const [, file, lineNum, col, sev, code, msg] = fileLoc;
      errors.push({
        message:  msg?.trim() ?? line.trim(),
        severity: (sev?.toLowerCase() as ErrorSeverity) ?? 'error',
        category: code?.startsWith('TS') ? 'type' : 'build',
        file:     file?.trim(),
        line:     parseInt(lineNum ?? '0', 10),
        column:   parseInt(col ?? '0', 10),
        code:     code?.trim(),
      });
      continue;
    }
    const m = ERROR_LINE_RE.exec(line);
    if (m) {
      errors.push({
        message:  m[1]?.trim() ?? line.trim(),
        severity: /warning/i.test(line) ? 'warning' : 'error',
        category: 'build' as FailureCategory,
      });
    }
  }
  return errors;
}

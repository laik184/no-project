import type { ParsedError, DiagnosticsReport, FailureCategory, ErrorSeverity } from './verifier-types.ts';
import { parseBuildErrors } from './build-error-parser.ts';

const TSC_LINE_RE     = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/i;
const RUNTIME_ERR_RE  = /(?:Error|Exception|FATAL|ENOENT|EADDRINUSE|SyntaxError)[\s:](.+)/i;
const GENERIC_ERR_RE  = /^(error|err)\b[:\s]+(.+)/i;

function parseLine(runId: string, line: string): ParsedError | undefined {
  const tsc = TSC_LINE_RE.exec(line);
  if (tsc) {
    const [, file, ln, col, sev, code, msg] = tsc;
    return {
      message:  msg!.trim(),
      severity: sev!.toLowerCase() as ErrorSeverity,
      category: 'type',
      file:     file!.trim(),
      line:     parseInt(ln!, 10),
      column:   parseInt(col!, 10),
      code:     code!.trim(),
    };
  }
  const rt = RUNTIME_ERR_RE.exec(line);
  if (rt) {
    return { message: rt[0]!.trim(), severity: 'error', category: 'runtime' as FailureCategory };
  }
  const ge = GENERIC_ERR_RE.exec(line);
  if (ge) {
    return { message: ge[2]!.trim(), severity: 'error', category: 'unknown' as FailureCategory };
  }
  return undefined;
}

export function analyzeOutput(runId: string, output: string): ParsedError[] {
  const lines  = output.split('\n');
  const errors: ParsedError[] = [];
  for (const line of lines) {
    const e = parseLine(runId, line.trim());
    if (e) errors.push(e);
  }
  if (errors.length === 0) {
    errors.push(...parseBuildErrors(output));
  }
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.message}:${e.file}:${e.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzeMultipleOutputs(runId: string, outputs: string[]): ParsedError[] {
  return outputs.flatMap((o) => analyzeOutput(runId, o));
}

export function buildDiagnosticsReport(runId: string, errors: ParsedError[]): DiagnosticsReport {
  const total   = errors.length;
  const fatals  = errors.filter((e) => e.severity === 'fatal').length;
  const summary = total === 0
    ? 'No errors detected'
    : `${total} error(s) found${fatals > 0 ? ` (${fatals} fatal)` : ''}`;
  return { runId, errors, rootCauses: [], summary, createdAt: Date.now() };
}

import type { LogLine } from './log-buffer.ts';

export interface LogError {
  type:     string;
  severity: 'fatal' | 'error' | 'warning';
  line:     string;
  ts:       number;
}

export interface LogAnalysis {
  hasErrors:        boolean;
  hasFatalError:    boolean;
  hasSuccessSignal: boolean;
  errors:           LogError[];
}

const FATAL_PATTERNS = [
  /EADDRINUSE/,
  /Cannot find module/,
  /SyntaxError/,
  /uncaughtException/,
  /UnhandledPromiseRejection/,
];

const ERROR_PATTERNS = [
  /\bERROR\b/i,
  /\bfailed\b/i,
  /\bException\b/,
  /\bError:/,
];

const SUCCESS_PATTERNS = [
  /listening on/i,
  /server (is )?running/i,
  /ready in/i,
  /started on/i,
  /Local:.*http/i,
];

export function analyzeLines(lines: LogLine[]): LogAnalysis {
  const errors: LogError[] = [];
  let hasFatalError    = false;
  let hasSuccessSignal = false;

  for (const l of lines) {
    if (SUCCESS_PATTERNS.some(p => p.test(l.text))) {
      hasSuccessSignal = true;
    }

    if (FATAL_PATTERNS.some(p => p.test(l.text))) {
      hasFatalError = true;
      errors.push({ type: 'fatal', severity: 'fatal', line: l.text, ts: l.ts });
    } else if (l.stream === 'stderr' || ERROR_PATTERNS.some(p => p.test(l.text))) {
      errors.push({ type: 'error', severity: 'error', line: l.text, ts: l.ts });
    }
  }

  return { hasErrors: errors.length > 0, hasFatalError, hasSuccessSignal, errors };
}

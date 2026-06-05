/**
 * server/terminal/parsers/error-parser.ts
 *
 * Detects and classifies error patterns in terminal output lines.
 */

import { ansiParser } from './ansi-parser.ts';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'none';

export interface ErrorParseResult {
  severity: ErrorSeverity;
  message:  string;
  file:     string | null;
  line:     number | null;
  column:   number | null;
}

const FILE_LOC_RE = /(?:at\s+)?(.+?):(\d+)(?::(\d+))?/;
const PATTERNS: Array<{ re: RegExp; severity: ErrorSeverity }> = [
  { re: /\b(fatal|uncaught exception|segmentation fault)\b/i, severity: 'fatal'   },
  { re: /\b(error|err!|failed|exception|cannot find|not found)\b/i, severity: 'error' },
  { re: /\b(warn(?:ing)?|deprecated)\b/i,                    severity: 'warning' },
];

export const errorParser = {
  parse(raw: string): ErrorParseResult {
    const clean   = ansiParser.strip(raw);
    let severity: ErrorSeverity = 'none';

    for (const { re, severity: sev } of PATTERNS) {
      if (re.test(clean)) { severity = sev; break; }
    }

    const locMatch = FILE_LOC_RE.exec(clean);

    return {
      severity,
      message: clean.trim(),
      file:    locMatch?.[1]?.trim() ?? null,
      line:    locMatch?.[2] ? parseInt(locMatch[2], 10) : null,
      column:  locMatch?.[3] ? parseInt(locMatch[3], 10) : null,
    };
  },

  isError(raw: string): boolean {
    return this.parse(raw).severity !== 'none';
  },

  classify(raw: string): ErrorSeverity {
    return this.parse(raw).severity;
  },
};

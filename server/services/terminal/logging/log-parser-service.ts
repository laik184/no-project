/**
 * server/services/terminal/logging/log-parser-service.ts
 *
 * Parses raw terminal output lines into structured log entries.
 * Detects log level, optional timestamp prefix, and source hint.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'unknown';

export interface ParsedLogEntry {
  raw:       string;
  level:     LogLevel;
  message:   string;
  timestamp: number | null;
}

const LEVEL_PATTERNS: ReadonlyArray<{ pattern: RegExp; level: LogLevel }> = [
  { pattern: /\b(error|err|fatal|critical)\b/i,   level: 'error' },
  { pattern: /\b(warn(?:ing)?)\b/i,               level: 'warn'  },
  { pattern: /\b(info|information|notice)\b/i,    level: 'info'  },
  { pattern: /\b(debug|trace|verbose)\b/i,        level: 'debug' },
];

const ISO_TIMESTAMP = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*/;
const UNIX_MS_PREFIX = /^(\d{13,})\s/;

function detectLevel(line: string): LogLevel {
  for (const { pattern, level } of LEVEL_PATTERNS) {
    if (pattern.test(line)) return level;
  }
  return 'unknown';
}

function extractTimestamp(line: string): { timestamp: number | null; rest: string } {
  let match = ISO_TIMESTAMP.exec(line);
  if (match) {
    const ts = Date.parse(match[1]);
    return { timestamp: Number.isNaN(ts) ? null : ts, rest: line.slice(match[0].length) };
  }

  match = UNIX_MS_PREFIX.exec(line);
  if (match) {
    return { timestamp: parseInt(match[1], 10), rest: line.slice(match[0].length) };
  }

  return { timestamp: null, rest: line };
}

export const logParserService = {
  parse(raw: string): ParsedLogEntry {
    const { timestamp, rest } = extractTimestamp(raw.trim());
    return {
      raw,
      level:     detectLevel(raw),
      message:   rest || raw,
      timestamp,
    };
  },

  parseMany(lines: string[]): ParsedLogEntry[] {
    return lines.map(l => this.parse(l));
  },

  filterByLevel(entries: ParsedLogEntry[], level: LogLevel): ParsedLogEntry[] {
    return entries.filter(e => e.level === level);
  },
};

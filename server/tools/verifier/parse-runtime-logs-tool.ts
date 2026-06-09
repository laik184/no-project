/**
 * server/tools/verifier/parse-runtime-logs-tool.ts
 * Tool: parse_runtime_logs
 *
 * Parses raw runtime log text and extracts structured errors, warnings, and info.
 */

import type { ToolDefinition } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../registry/tool-metadata.ts';

interface LogEntry { level: 'error' | 'warn' | 'info'; message: string; line: number; }

interface ParsedLogs {
  errors:       LogEntry[];
  warnings:     LogEntry[];
  infos:        LogEntry[];
  errorCount:   number;
  warningCount: number;
  hasFatal:     boolean;
}

export const parseRuntimeLogsTool: ToolDefinition = {
  name:        'parse_runtime_logs',
  category:    'verifier',
  description: 'Parse raw runtime log text and extract structured errors, warnings, and info entries.',
  inputSchema: {
    logs:      { type: 'string', description: 'Raw log text to parse', required: true  },
    maxLines:  { type: 'number', description: 'Max log lines to process (default 500)',  required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input): Promise<ParsedLogs> => {
    const raw       = String(input.logs ?? '');
    const maxLines  = Number(input.maxLines ?? 500);
    const lines     = raw.split('\n').slice(0, maxLines);

    const errors:   LogEntry[] = [];
    const warnings: LogEntry[] = [];
    const infos:    LogEntry[] = [];

    lines.forEach((msg, idx) => {
      const line = idx + 1;
      const m    = msg.trim();
      if (!m) return;
      if (/\b(error|err|fatal|critical|exception|crash)\b/i.test(m)) {
        errors.push({ level: 'error', message: m.slice(0, 300), line });
      } else if (/\b(warn|warning|deprecated)\b/i.test(m)) {
        warnings.push({ level: 'warn', message: m.slice(0, 300), line });
      } else {
        infos.push({ level: 'info', message: m.slice(0, 200), line });
      }
    });

    const hasFatal = errors.some(e => /\b(fatal|crash|unhandled|oom)\b/i.test(e.message));

    return {
      errors:       errors.slice(0, 20),
      warnings:     warnings.slice(0, 20),
      infos:        infos.slice(0, 20),
      errorCount:   errors.length,
      warningCount: warnings.length,
      hasFatal,
    };
  },
};

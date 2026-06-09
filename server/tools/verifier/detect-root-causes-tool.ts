/**
 * server/tools/verifier/detect-root-causes-tool.ts
 * Tool: detect_root_causes
 *
 * Analyzes stdout, stderr, and logs to identify root causes of failures.
 */

import type { ToolDefinition } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../registry/tool-metadata.ts';

interface RootCauseResult {
  rootCauses: string[];
  count:      number;
  severity:   'none' | 'low' | 'medium' | 'high' | 'critical';
}

export const detectRootCausesTool: ToolDefinition = {
  name:        'detect_root_causes',
  category:    'verifier',
  description: 'Analyze error output to detect likely root causes of failures.',
  inputSchema: {
    stdout:    { type: 'string', description: 'Standard output from the failing operation', required: false },
    stderr:    { type: 'string', description: 'Standard error from the failing operation',  required: false },
    logs:      { type: 'string', description: 'Additional log text to analyze',             required: false },
    exitCode:  { type: 'number', description: 'Exit code of the failed process',            required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input): Promise<RootCauseResult> => {
    const text = [input.stdout, input.stderr, input.logs]
      .filter(v => typeof v === 'string' && v.length > 0)
      .join('\n');

    const causes: string[] = [];

    if (/cannot find module|module not found/i.test(text))
      causes.push('Missing dependency — run `npm install`');
    if (/enoent|no such file/i.test(text))
      causes.push('File not found — check file paths');
    if (/eaddrinuse/i.test(text))
      causes.push('Port already in use — stop the conflicting process');
    if (/typeerror/i.test(text))
      causes.push('TypeError — check function signatures and variable types');
    if (/syntaxerror/i.test(text))
      causes.push('SyntaxError — check source code for syntax issues');
    if (/permission denied|eacces/i.test(text))
      causes.push('Permission denied — check file system permissions');
    if (/out of memory|heap out of memory/i.test(text))
      causes.push('Out of memory — increase Node.js heap or optimize memory usage');
    if (/timed?\s*out/i.test(text))
      causes.push('Timeout — operation took too long, check for infinite loops');
    if (/cannot connect|connection refused/i.test(text))
      causes.push('Connection refused — ensure the target service is running');
    if (/ts\d{4}|type error/i.test(text))
      causes.push('TypeScript compile error — check types and interfaces');

    if (causes.length === 0 && text.length > 0)
      causes.push('Unknown error — review full logs for details');

    const severity: RootCauseResult['severity'] =
      causes.length === 0   ? 'none'
      : causes.some(c => /out of memory|heap/i.test(c)) ? 'critical'
      : causes.length >= 3  ? 'high'
      : causes.length >= 2  ? 'medium'
      : 'low';

    return { rootCauses: causes, count: causes.length, severity };
  },
};

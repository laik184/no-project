/**
 * server/tools/verifier/analyze-errors-tool.ts
 * Tool: analyze_errors
 *
 * Parses raw error output (TypeScript, build, runtime) and categorizes them.
 * Returns: { errorCount, warningCount, categories, topErrors[], hasFatal }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';

export type ErrorCategory =
  | 'typescript'
  | 'runtime'
  | 'build'
  | 'import'
  | 'dependency'
  | 'syntax'
  | 'unknown';

export interface ParsedError {
  category: ErrorCategory;
  message:  string;
  file?:    string;
  line?:    number;
}

export interface ErrorAnalysisResult {
  errorCount:   number;
  warningCount: number;
  hasFatal:     boolean;
  categories:   ErrorCategory[];
  topErrors:    ParsedError[];
  raw:          string;
}

const TS_ERROR_RE   = /^(.+\.tsx?)\((\d+),\d+\): error TS\d+: (.+)$/;
const WARN_RE       = /warning|Warning/;
const IMPORT_RE     = /Cannot find module|Module not found|Failed to resolve import/i;
const DEP_RE        = /npm ERR!|peer dep|missing package/i;
const SYNTAX_RE     = /SyntaxError|Unexpected token|Expected|Unexpected end/i;
const FATAL_RE      = /FATAL|Segmentation fault|Out of memory|ENOMEM|SIGKILL/i;

function categorize(line: string): ErrorCategory {
  if (/error TS\d+/.test(line))   return 'typescript';
  if (IMPORT_RE.test(line))       return 'import';
  if (DEP_RE.test(line))          return 'dependency';
  if (SYNTAX_RE.test(line))       return 'syntax';
  if (/Build failed|vite build/.test(line)) return 'build';
  if (/TypeError|ReferenceError|Error:/.test(line)) return 'runtime';
  return 'unknown';
}

export const analyzeErrorsTool: ToolDefinition = {
  name:        'analyze_errors',
  category:    'verifier',
  description: 'Parse raw error/build output and return categorized error list.',
  inputSchema: {
    runId:  { type: 'string', description: 'Execution run ID', required: false },
    output: { type: 'string', description: 'Raw output string to analyze', required: true },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext): Promise<ErrorAnalysisResult> => {
    const raw    = String(input.output ?? '');
    const lines  = raw.split('\n').filter(Boolean);

    let errorCount   = 0;
    let warningCount = 0;
    let hasFatal     = false;
    const catSet     = new Set<ErrorCategory>();
    const topErrors: ParsedError[] = [];

    for (const line of lines) {
      if (FATAL_RE.test(line))  hasFatal = true;
      if (WARN_RE.test(line)) { warningCount++; continue; }

      // TypeScript structured error
      const tsMatch = TS_ERROR_RE.exec(line);
      if (tsMatch) {
        errorCount++;
        const cat: ErrorCategory = 'typescript';
        catSet.add(cat);
        if (topErrors.length < 20) {
          topErrors.push({ category: cat, message: tsMatch[3], file: tsMatch[1], line: Number(tsMatch[2]) });
        }
        continue;
      }

      // Generic error line
      if (/\berror\b/i.test(line) && !/^\/\//.test(line.trim())) {
        errorCount++;
        const cat = categorize(line);
        catSet.add(cat);
        if (topErrors.length < 20) {
          topErrors.push({ category: cat, message: line.trim() });
        }
      }
    }

    return {
      errorCount,
      warningCount,
      hasFatal,
      categories: [...catSet],
      topErrors,
      raw:        raw.slice(0, 4_000),
    };
  },
};

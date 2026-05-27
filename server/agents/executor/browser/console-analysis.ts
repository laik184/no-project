/**
 * console-analysis.ts
 * Analyses browser console output to extract actionable error context.
 */

export interface ConsoleError {
  type:    'error' | 'warning' | 'uncaught';
  message: string;
  source?: string;
  line?:   number;
}

export interface ConsoleAnalysis {
  errors:      ConsoleError[];
  hasErrors:   boolean;
  summary:     string;
  suggestions: string[];
}

const ERROR_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern:    /Cannot find module '([^']+)'/,
    suggestion: 'Missing npm package — run npm install for the missing module',
  },
  {
    pattern:    /ReferenceError:\s+(\w+) is not defined/,
    suggestion: 'Undefined variable — check imports or variable declarations',
  },
  {
    pattern:    /TypeError:\s+(.+) is not a function/,
    suggestion: 'Function call on non-function — verify the object type',
  },
  {
    pattern:    /SyntaxError/,
    suggestion: 'Syntax error in script — check the file for malformed code',
  },
  {
    pattern:    /Failed to fetch|Network Error|ERR_CONNECTION_REFUSED/,
    suggestion: 'Network/API error — check that the backend server is running',
  },
  {
    pattern:    /401|403|Unauthorized|Forbidden/,
    suggestion: 'Auth error — check authentication headers and session state',
  },
];

export function analyzeConsoleLogs(rawLogs: string[]): ConsoleAnalysis {
  const errors: ConsoleError[] = [];
  const suggestions: string[] = [];

  for (const log of rawLogs) {
    const type = detectType(log);
    if (type) {
      errors.push({ type, message: log.slice(0, 400) });

      for (const { pattern, suggestion } of ERROR_PATTERNS) {
        if (pattern.test(log) && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
    }
  }

  const summary = errors.length === 0
    ? 'No console errors detected'
    : `${errors.length} console error(s): ${errors[0].message.slice(0, 100)}`;

  return { errors, hasErrors: errors.length > 0, summary, suggestions };
}

function detectType(log: string): ConsoleError['type'] | null {
  const lower = log.toLowerCase();
  if (lower.includes('uncaught') || lower.includes('unhandled')) return 'uncaught';
  if (lower.startsWith('error') || lower.includes('[error]')) return 'error';
  if (lower.startsWith('warning') || lower.includes('[warn]')) return 'warning';
  return null;
}

export function formatConsoleAnalysis(analysis: ConsoleAnalysis): string {
  if (!analysis.hasErrors) return 'Browser: no errors';
  const lines = [
    `Browser console errors (${analysis.errors.length}):`,
    ...analysis.errors.slice(0, 5).map((e) => `  [${e.type}] ${e.message}`),
  ];
  if (analysis.suggestions.length) {
    lines.push('Suggestions:', ...analysis.suggestions.map((s) => `  - ${s}`));
  }
  return lines.join('\n');
}

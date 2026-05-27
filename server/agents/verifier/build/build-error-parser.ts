import type { ParsedError } from '../types/diagnostics.types.ts';
import { parseLines } from '../utils/parser-utils.ts';

const ERROR_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /error ts\d+/i,                          label: 'TypeScript error' },
  { pattern: /\[error\]/i,                             label: 'Build error'      },
  { pattern: /build failed/i,                          label: 'Build failed'     },
  { pattern: /cannot find module/i,                    label: 'Missing module'   },
  { pattern: /unexpected token/i,                      label: 'Syntax error'     },
  { pattern: /failed to resolve/i,                     label: 'Resolution error' },
  { pattern: /rollup.*error/i,                         label: 'Rollup error'     },
  { pattern: /vite.*error/i,                           label: 'Vite error'       },
  { pattern: /esbuild.*error/i,                        label: 'ESBuild error'    },
];

const FILE_LOCATION = /([^\s(]+\.(ts|tsx|js|jsx)):(\d+):(\d+)/;

export function parseBuildErrors(output: string): ParsedError[] {
  const lines  = parseLines(output);
  const errors: ParsedError[] = [];

  for (const line of lines) {
    for (const { pattern } of ERROR_PATTERNS) {
      if (!pattern.test(line)) continue;

      const locMatch = line.match(FILE_LOCATION);
      errors.push({
        message:  line.trim().slice(0, 300),
        severity: 'error',
        category: 'build',
        file:     locMatch ? locMatch[1] : undefined,
        line:     locMatch ? parseInt(locMatch[3], 10) : undefined,
        column:   locMatch ? parseInt(locMatch[4], 10) : undefined,
        raw:      line,
      });
      break;
    }
  }

  return errors;
}

export function hasTerminalBuildError(output: string): boolean {
  return /build failed|fatal error|compilation failed/i.test(output);
}

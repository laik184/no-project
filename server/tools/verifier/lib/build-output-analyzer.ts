import { parseBuildErrors } from './build-error-parser.ts';
import type { ParsedError } from './verifier-types.ts';

export interface BuildOutputAnalysis {
  hasErrors:    boolean;
  hasWarnings:  boolean;
  errors:       ParsedError[];
  warnings:     ParsedError[];
  outputFiles:  string[];
  buildTimeMs?: number;
}

const OUTPUT_FILE_RE  = /(?:dist|build|out)\/[\w./\-]+\.(js|mjs|cjs|css|html)/gi;
const BUILD_TIME_RE   = /built in\s+([\d.]+)\s*ms/i;

export function analyzeBuildOutput(stdout: string, stderr = ''): BuildOutputAnalysis {
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  const parsed   = parseBuildErrors(combined);
  const errors   = parsed.filter((e) => e.severity === 'error' || e.severity === 'fatal');
  const warnings = parsed.filter((e) => e.severity === 'warning');

  const fileMatches = combined.match(OUTPUT_FILE_RE) ?? [];
  const outputFiles = [...new Set(fileMatches)];

  const timeMatch = BUILD_TIME_RE.exec(combined);
  const buildTimeMs = timeMatch ? parseFloat(timeMatch[1]!) : undefined;

  return { hasErrors: errors.length > 0, hasWarnings: warnings.length > 0, errors, warnings, outputFiles, buildTimeMs };
}

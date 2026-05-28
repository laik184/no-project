import type { ParsedError, OutputValidationResult } from '../types.ts';
import { parseLines } from '../utils.ts';

const SUCCESS_MARKERS = [
  'build succeeded', 'successfully compiled', 'built in',
  '✓ built', 'done in', 'compiled successfully',
];

const ERROR_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /error ts\d+/i,           label: 'TypeScript error' },
  { pattern: /\[error\]/i,             label: 'Build error'      },
  { pattern: /build failed/i,          label: 'Build failed'     },
  { pattern: /cannot find module/i,    label: 'Missing module'   },
  { pattern: /unexpected token/i,      label: 'Syntax error'     },
  { pattern: /failed to resolve/i,     label: 'Resolution error' },
  { pattern: /rollup.*error/i,         label: 'Rollup error'     },
  { pattern: /vite.*error/i,           label: 'Vite error'       },
  { pattern: /esbuild.*error/i,        label: 'ESBuild error'    },
];

const FILE_LOCATION = /([^\s(]+\.(ts|tsx|js|jsx)):(\d+):(\d+)/;
const OUTPUT_FILE_PATTERN = /(?:dist|build|\.next|out)\/[\w/.-]+\.(js|css|html)/g;
const SIZE_PATTERN        = /(\d+(?:\.\d+)?)\s*(bytes?|kb|mb)/i;
const BUILD_TIME_PATTERN  = /built in (\d+(?:\.\d+)?)\s*ms/i;

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

export function validateBuildResult(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const combined = `${stdout}\n${stderr}`;

  if (exitCode !== 0) errors.push(`Build process exited with code ${exitCode}`);
  if (hasTerminalBuildError(combined)) errors.push('Terminal build failure detected in output');

  for (const e of parseBuildErrors(stderr || combined).slice(0, 10)) {
    errors.push(e.message);
  }

  const hasSuccess = SUCCESS_MARKERS.some((m) => combined.toLowerCase().includes(m.toLowerCase()));
  if (!hasSuccess && exitCode === 0 && errors.length === 0) {
    warnings.push('No explicit build success marker found');
  }

  return { valid: errors.length === 0, exitCode, errors, warnings };
}

export function isBuildSuccessful(exitCode: number, stdout: string, stderr: string): boolean {
  return validateBuildResult(stdout, stderr, exitCode).valid;
}

export interface BuildOutputAnalysis {
  hasErrors: boolean; hasWarnings: boolean; outputFiles: string[];
  bundleSizeBytes?: number; buildTimeMs?: number; modules?: number; chunks?: number;
}

export function analyzeBuildOutput(stdout: string, stderr: string): BuildOutputAnalysis {
  const combined  = `${stdout}\n${stderr}`;
  const lines     = parseLines(combined);
  const hasErrors   = /error|failed/i.test(stderr) || lines.some((l) => /\berror\b/i.test(l));
  const hasWarnings = /warn/i.test(combined);
  const outputFiles = Array.from(new Set(Array.from(combined.matchAll(OUTPUT_FILE_PATTERN)).map((m) => m[0])));

  const sizeMatch = combined.match(SIZE_PATTERN);
  let bundleSizeBytes: number | undefined;
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit  = sizeMatch[2].toLowerCase();
    bundleSizeBytes = unit.startsWith('mb') ? value * 1_048_576 : unit.startsWith('kb') ? value * 1024 : value;
  }

  const timeMatch   = combined.match(BUILD_TIME_PATTERN);
  const buildTimeMs = timeMatch ? parseFloat(timeMatch[1]) : undefined;
  const modulesMatch = combined.match(/(\d+) modules? transformed/);
  const modules     = modulesMatch ? parseInt(modulesMatch[1], 10) : undefined;
  const chunksMatch  = combined.match(/(\d+) chunk/);
  const chunks      = chunksMatch ? parseInt(chunksMatch[1], 10) : undefined;

  return { hasErrors, hasWarnings, outputFiles, bundleSizeBytes, buildTimeMs, modules, chunks };
}

export function formatBuildAnalysis(analysis: BuildOutputAnalysis): string {
  const lines = [`Status:  ${analysis.hasErrors ? 'FAILED' : analysis.hasWarnings ? 'WARNINGS' : 'OK'}`];
  if (analysis.buildTimeMs !== undefined) lines.push(`Time:    ${analysis.buildTimeMs}ms`);
  if (analysis.outputFiles.length) lines.push(`Outputs: ${analysis.outputFiles.length} file(s)`);
  return lines.join('\n');
}

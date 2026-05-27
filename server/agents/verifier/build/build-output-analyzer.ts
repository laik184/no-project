import { parseLines, extractNumber } from '../utils/parser-utils.ts';

export interface BuildOutputAnalysis {
  hasErrors:        boolean;
  hasWarnings:      boolean;
  outputFiles:      string[];
  bundleSizeBytes?: number;
  buildTimeMs?:     number;
  modules?:         number;
  chunks?:          number;
}

const OUTPUT_FILE_PATTERN = /(?:dist|build|\.next|out)\/[\w/.-]+\.(js|css|html)/g;
const SIZE_PATTERN         = /(\d+(?:\.\d+)?)\s*(bytes?|kb|mb)/i;
const BUILD_TIME_PATTERN   = /built in (\d+(?:\.\d+)?)\s*ms/i;

export function analyzeBuildOutput(stdout: string, stderr: string): BuildOutputAnalysis {
  const combined  = `${stdout}\n${stderr}`;
  const lines     = parseLines(combined);

  const hasErrors   = /error|failed/i.test(stderr) || lines.some((l) => /\berror\b/i.test(l));
  const hasWarnings = /warn/i.test(combined);

  const outputFiles = Array.from(new Set(
    Array.from(combined.matchAll(OUTPUT_FILE_PATTERN)).map((m) => m[0]),
  ));

  const sizeMatch = combined.match(SIZE_PATTERN);
  let bundleSizeBytes: number | undefined;
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit  = sizeMatch[2].toLowerCase();
    bundleSizeBytes = unit.startsWith('mb') ? value * 1_048_576
      : unit.startsWith('kb') ? value * 1024
      : value;
  }

  const timeMatch = combined.match(BUILD_TIME_PATTERN);
  const buildTimeMs = timeMatch ? parseFloat(timeMatch[1]) : undefined;

  const modules = extractNumber(combined, /(\d+) modules? transformed/);
  const chunks  = extractNumber(combined, /(\d+) chunk/);

  return { hasErrors, hasWarnings, outputFiles, bundleSizeBytes, buildTimeMs, modules, chunks };
}

export function formatBuildAnalysis(analysis: BuildOutputAnalysis): string {
  const lines = [
    `Status:  ${analysis.hasErrors ? 'FAILED' : analysis.hasWarnings ? 'WARNINGS' : 'OK'}`,
  ];
  if (analysis.buildTimeMs !== undefined) lines.push(`Time:    ${analysis.buildTimeMs}ms`);
  if (analysis.outputFiles.length) lines.push(`Outputs: ${analysis.outputFiles.length} file(s)`);
  return lines.join('\n');
}

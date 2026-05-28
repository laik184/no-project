/**
 * build/build-output-analyzer.ts
 * Analyzes build output for warnings, errors, and summaries.
 * Called by server/tools/verifier/build/build-output-parser.ts.
 */

export interface BuildOutputAnalysis {
  hasErrors:    boolean;
  hasWarnings:  boolean;
  errorCount:   number;
  warningCount: number;
  errorLines:   string[];
  warningLines: string[];
  outputFiles:  string[];
  buildTimeMs:  number | undefined;
  summary:      string;
}

const ERROR_RE    = /\berror\b|\bfailed\b|\bfailure\b/i;
const WARNING_RE  = /\bwarn(ing)?\b/i;
const OUTPUT_RE   = /(?:dist|build|out)\/.+\.(js|mjs|cjs|css|html)/i;
const TIME_RE     = /built in\s+([\d.]+)\s*(ms|s)/i;

export function analyzeBuildOutput(stdout: string, stderr = ''): BuildOutputAnalysis {
  const combined = `${stdout}\n${stderr}`;
  const lines    = combined.split('\n').map((l) => l.trim()).filter(Boolean);

  const errorLines   = lines.filter((l) => ERROR_RE.test(l) && !WARNING_RE.test(l));
  const warningLines = lines.filter((l) => WARNING_RE.test(l) && !ERROR_RE.test(l));
  const outputFiles  = lines.filter((l) => OUTPUT_RE.test(l)).slice(0, 20);

  let buildTimeMs: number | undefined;
  const timeMatch = TIME_RE.exec(combined);
  if (timeMatch) {
    buildTimeMs = parseFloat(timeMatch[1]) * (timeMatch[2] === 's' ? 1000 : 1);
  }

  const hasErrors   = errorLines.length > 0;
  const hasWarnings = warningLines.length > 0;

  const summary = hasErrors
    ? `Build failed with ${errorLines.length} error(s)`
    : hasWarnings
    ? `Build succeeded with ${warningLines.length} warning(s)`
    : 'Build succeeded';

  return {
    hasErrors,
    hasWarnings,
    errorCount:   errorLines.length,
    warningCount: warningLines.length,
    errorLines:   errorLines.slice(0, 20),
    warningLines: warningLines.slice(0, 10),
    outputFiles,
    buildTimeMs,
    summary,
  };
}

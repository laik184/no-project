import type { CoverageReport } from "../types.js";
import { appendLog } from "../utils/logger.util.js";
import { parseCoverage } from "../utils/output-parser.util.js";

export interface CoverageAnalysisResult {
  readonly report: CoverageReport;
  readonly logs: readonly string[];
}

export function analyzeCoverage(stdout: string): CoverageAnalysisResult {
  let logs = Object.freeze([]) as readonly string[];
  const report = parseCoverage(stdout);

  logs = appendLog(logs, "INFO", `Coverage analyzed: ${report.percentage}%`);
  return Object.freeze({ report, logs });
}

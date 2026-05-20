import type { FailureReport } from "../types.js";
import { appendLog } from "../utils/logger.util.js";
import { parseFailureReasons } from "../utils/output-parser.util.js";

export interface FailureAnalysisResult {
  readonly report: FailureReport;
  readonly logs: readonly string[];
}

export function analyzeFailures(stdout: string, stderr: string): FailureAnalysisResult {
  let logs = Object.freeze([]) as readonly string[];
  const reasons = parseFailureReasons(`${stdout}\n${stderr}`);

  const files = Object.freeze(
    [...new Set(
      `${stdout}\n${stderr}`
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith(".test.ts") || line.endsWith(".spec.ts")),
    )],
  );

  const report: FailureReport = Object.freeze({
    hasFailures: reasons.length > 0,
    reasons,
    files,
  });

  logs = appendLog(logs, report.hasFailures ? "WARN" : "INFO", `Failure analysis completed. hasFailures=${report.hasFailures}`);
  return Object.freeze({ report, logs });
}

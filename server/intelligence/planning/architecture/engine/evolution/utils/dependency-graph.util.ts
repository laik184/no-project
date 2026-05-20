import type { ArchitectureAnalysisReport, PatternMetrics } from "../types.js";

const CYCLE_TOKENS = ["cycle", "cyclic", "loop"];
const COUPLING_TOKENS = ["coupling", "tightly coupled", "shared mutable", "god module"];

function hasAnyToken(message: string, tokens: readonly string[]): boolean {
  const normalized = message.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

export function derivePatternMetrics(report: Readonly<ArchitectureAnalysisReport>): PatternMetrics {
  const serviceCount = report.metadata?.serviceCount ?? 1;
  const moduleCount = report.metadata?.moduleCount ?? Math.max(1, Math.ceil(report.totalViolations / 2));
  const totalSignals = Math.max(1, report.violations.length);

  const cycleSignals = report.violations.filter((violation) =>
    hasAnyToken(`${violation.type} ${violation.message}`, CYCLE_TOKENS),
  ).length;

  const couplingSignals = report.violations.filter((violation) =>
    hasAnyToken(`${violation.type} ${violation.message}`, COUPLING_TOKENS),
  ).length;

  return Object.freeze({
    serviceCount,
    moduleCount,
    violationDensity: report.totalViolations / totalSignals,
    cycleSignals,
    couplingSignals,
  });
}

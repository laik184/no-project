import type { Domain, NormalizedIssue, ReportInput, Severity } from "../types.js";
import { collectIssues } from "./merge.util.js";

const SEVERITY_ALIASES: Readonly<Record<string, Severity>> = Object.freeze({
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
  warning: "MEDIUM",
});

const DOMAIN_ALIASES: Readonly<Record<string, Domain>> = Object.freeze({
  architecture: "Architecture",
  performance: "Performance",
  security: "Security",
  database: "Database",
  data: "Database",
  deployment: "Deployment",
  infrastructure: "Deployment",
});

function normalizeSeverity(value: string | undefined): Severity {
  if (!value) {
    return "MEDIUM";
  }

  return SEVERITY_ALIASES[value.toLowerCase()] ?? "MEDIUM";
}

function normalizeDomain(value: string | undefined): Domain {
  if (!value) {
    return "General";
  }

  return DOMAIN_ALIASES[value.toLowerCase()] ?? "General";
}

function clampText(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
}

export function normalizeInputs(input: ReportInput): readonly NormalizedIssue[] {
  const normalized: NormalizedIssue[] = [];

  for (const [source, output] of Object.entries(input)) {
    const issues = collectIssues(output);

    issues.forEach((issue, index) => {
      const title = clampText(issue.title ?? issue.subject, "Unnamed issue");
      const detail = clampText(issue.message ?? issue.description, "No details provided.");
      const severity = normalizeSeverity(issue.severity ?? issue.impact);
      const domain = normalizeDomain(issue.domain ?? issue.category);
      const type = clampText(issue.type, "general").toLowerCase();

      normalized.push(
        Object.freeze({
          id: issue.id ?? `${source}-${domain}-${type}-${index + 1}`,
          source,
          title,
          detail,
          severity,
          domain,
          type,
          evidence: Object.freeze([...(issue.evidence ?? [])]),
        }),
      );
    });
  }

  return Object.freeze(normalized);
}

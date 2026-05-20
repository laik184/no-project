import type {
  RefinedPrompt,
  ExtractedIntent,
  CapabilityMap,
  MappedCapability,
  CapabilityDomain,
} from "../types.js";
import { computeCapabilityCoverage } from "../utils/confidence-calculator.util.js";

const DOMAIN_CAPABILITY_MAP: ReadonlyArray<{
  readonly domain:        CapabilityDomain;
  readonly triggerTerms:  readonly string[];
  readonly alwaysRequired: boolean;
}> = Object.freeze([
  { domain: "backend-code-generation",  triggerTerms: Object.freeze(["api", "server", "express", "fastify", "controller", "service", "route", "endpoint", "rest", "backend"]),    alwaysRequired: false },
  { domain: "frontend-code-generation", triggerTerms: Object.freeze(["ui", "component", "react", "vue", "angular", "page", "layout", "style", "css", "frontend"]),              alwaysRequired: false },
  { domain: "database-management",      triggerTerms: Object.freeze(["database", "db", "schema", "entity", "migration", "orm", "table", "model", "postgres", "mongo"]),         alwaysRequired: false },
  { domain: "api-design",               triggerTerms: Object.freeze(["api", "endpoint", "route", "rest", "graphql", "contract", "openapi", "swagger", "http"]),                 alwaysRequired: false },
  { domain: "testing",                  triggerTerms: Object.freeze(["test", "spec", "unit", "integration", "jest", "mocha", "coverage", "mock", "e2e"]),                       alwaysRequired: false },
  { domain: "documentation",            triggerTerms: Object.freeze(["document", "readme", "comment", "doc", "describe", "annotation"]),                                         alwaysRequired: false },
  { domain: "deployment",               triggerTerms: Object.freeze(["deploy", "publish", "release", "build", "docker", "ci", "cd", "pipeline", "production"]),                 alwaysRequired: false },
  { domain: "configuration",            triggerTerms: Object.freeze(["config", "env", "environment", "setting", "dotenv", "variable", "option", "setup"]),                     alwaysRequired: true  },
  { domain: "refactoring",              triggerTerms: Object.freeze(["refactor", "restructure", "improve", "clean", "optimize", "reduce", "extract", "rename"]),                alwaysRequired: false },
  { domain: "analysis",                 triggerTerms: Object.freeze(["analyze", "audit", "inspect", "assess", "evaluate", "review", "profile", "check"]),                       alwaysRequired: false },
]);

const MIN_CONFIDENCE = 0.35;

function scoreDomain(
  triggerTerms: readonly string[],
  keywords:     readonly string[],
  domain:       string,
  intDomain:    string,
): number {
  const joined  = keywords.join(" ").toLowerCase();
  const matches = triggerTerms.filter(t => joined.includes(t));
  const baseScore = matches.length / Math.max(triggerTerms.length, 1);
  const domainBonus = intDomain.includes(domain.split("-")[0] ?? "") ? 0.3 : 0;
  return Math.min(1, baseScore * 2 + domainBonus);
}

function determinePrimaryDomain(
  capabilities: readonly MappedCapability[],
  intentDomain: string,
): CapabilityDomain {
  const domainOrder: readonly CapabilityDomain[] = [
    "backend-code-generation",
    "frontend-code-generation",
    "api-design",
    "database-management",
    "testing",
    "documentation",
    "deployment",
    "configuration",
    "refactoring",
    "analysis",
  ];

  for (const d of domainOrder) {
    const cap = capabilities.find(c => c.domain === d);
    if (cap !== undefined && cap.confidence >= 0.5) return d;
  }

  const byDomain = capabilities
    .filter(c => intentDomain.includes(c.domain.split("-")[0] ?? ""))
    .sort((a, b) => b.confidence - a.confidence);

  return byDomain[0]?.domain ?? "backend-code-generation";
}

function computeCoverageScore(capabilities: readonly MappedCapability[]): number {
  const mapped   = capabilities.map(c => c.domain);
  const required = DOMAIN_CAPABILITY_MAP.filter(d => d.alwaysRequired).map(d => d.domain);
  return computeCapabilityCoverage(required, mapped);
}

export function mapCapabilities(
  refined: RefinedPrompt,
  intent:  ExtractedIntent,
): CapabilityMap {
  const capabilities: MappedCapability[] = [];

  for (const entry of DOMAIN_CAPABILITY_MAP) {
    const confidence = scoreDomain(
      entry.triggerTerms,
      refined.cleanedKeywords,
      entry.domain,
      intent.domain,
    );

    if (confidence >= MIN_CONFIDENCE || entry.alwaysRequired) {
      const matched = entry.triggerTerms.filter(t =>
        refined.cleanedKeywords.includes(t)
      );
      capabilities.push(Object.freeze<MappedCapability>({
        domain:       entry.domain,
        required:     entry.alwaysRequired || confidence >= 0.6,
        confidence:   Math.round(Math.max(confidence, entry.alwaysRequired ? 0.5 : 0) * 100) / 100,
        triggerTerms: Object.freeze(matched),
      }));
    }
  }

  const sorted      = capabilities.sort((a, b) => b.confidence - a.confidence);
  const frozen      = Object.freeze(sorted.map(c => Object.freeze(c)));
  const primaryDomain = determinePrimaryDomain(frozen, intent.domain);
  const coverageScore = computeCoverageScore(frozen);

  return Object.freeze<CapabilityMap>({
    capabilities:  frozen,
    primaryDomain,
    coverageScore,
  });
}

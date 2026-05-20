import type { CapabilityMap, CapabilityRoute, StructuredIntent } from "../types.ts";

interface CapabilityEntry {
  readonly capability: string;
  readonly agentType: string;
  readonly triggerTerms: readonly string[];
}

const CAPABILITY_REGISTRY: ReadonlyArray<CapabilityEntry> = Object.freeze([
  { capability: "code-generation", agentType: "code-gen-agent", triggerTerms: ["generate", "create", "scaffold", "build", "write", "code"] },
  { capability: "code-analysis", agentType: "analysis-agent", triggerTerms: ["analyze", "audit", "review", "inspect", "check"] },
  { capability: "code-fix", agentType: "code-fixer-agent", triggerTerms: ["fix", "debug", "repair", "resolve", "patch"] },
  { capability: "refactoring", agentType: "refactor-agent", triggerTerms: ["refactor", "optimize", "improve", "restructure", "clean"] },
  { capability: "testing", agentType: "test-agent", triggerTerms: ["test", "spec", "unit", "integration", "coverage"] },
  { capability: "deployment", agentType: "deploy-agent", triggerTerms: ["deploy", "publish", "release", "ci", "cd", "pipeline"] },
  { capability: "database", agentType: "db-agent", triggerTerms: ["database", "schema", "migration", "query", "model", "orm"] },
  { capability: "api", agentType: "api-agent", triggerTerms: ["api", "endpoint", "route", "rest", "graphql", "controller"] },
  { capability: "auth", agentType: "auth-agent", triggerTerms: ["auth", "authentication", "authorization", "jwt", "oauth", "login"] },
  { capability: "frontend", agentType: "frontend-agent", triggerTerms: ["component", "ui", "react", "vue", "page", "form", "style"] },
  { capability: "mobile", agentType: "mobile-agent", triggerTerms: ["mobile", "ios", "android", "react-native", "expo"] },
  { capability: "devops", agentType: "devops-agent", triggerTerms: ["docker", "kubernetes", "github-actions", "workflow", "container"] },
]);

const MIN_CONFIDENCE = 0.25;

function scoreCapability(entry: CapabilityEntry, requiredCapabilities: readonly string[], keywords: readonly string[]): number {
  const allTerms = [...keywords, ...requiredCapabilities.map((c) => c.toLowerCase())];

  const matchCount = entry.triggerTerms.filter((term) =>
    allTerms.some((t) => t.includes(term) || term.includes(t)),
  ).length;

  const confidence = Math.min(1, matchCount / Math.max(1, entry.triggerTerms.length) * 1.5);
  return parseFloat(confidence.toFixed(2));
}

export function mapCapabilities(intent: Readonly<StructuredIntent>): Readonly<CapabilityMap> {
  const keywordsFromObjective = intent.primaryObjective
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const allKeywords = [...keywordsFromObjective, ...intent.requiredCapabilities.map((c) => c.toLowerCase())];

  const routes: CapabilityRoute[] = [];
  const coveredCapabilities = new Set<string>();

  for (const entry of CAPABILITY_REGISTRY) {
    const confidence = scoreCapability(entry, intent.requiredCapabilities, allKeywords);
    if (confidence >= MIN_CONFIDENCE) {
      routes.push(Object.freeze({
        capability: entry.capability,
        agentType: entry.agentType,
        available: true,
        confidence,
      }));
      coveredCapabilities.add(entry.capability);
    }
  }

  const missingCapabilities = intent.requiredCapabilities.filter(
    (cap) => !coveredCapabilities.has(cap.toLowerCase()),
  );

  const coverageScore = intent.requiredCapabilities.length === 0
    ? routes.length > 0 ? 1.0 : 0.0
    : parseFloat(
        Math.min(1, coveredCapabilities.size / intent.requiredCapabilities.length).toFixed(2),
      );

  return Object.freeze({
    routes: Object.freeze(routes),
    missingCapabilities: Object.freeze(missingCapabilities),
    coverageScore,
  });
}

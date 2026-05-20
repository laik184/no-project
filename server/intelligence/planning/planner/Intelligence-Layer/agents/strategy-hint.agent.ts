import type {
  ExtractedIntent,
  AmbiguityReport,
  CapabilityMap,
  StrategyHint,
  ExecutionHint,
  IntentType,
  CapabilityDomain,
} from "../types.js";
import { normalizeScore } from "../utils/confidence-calculator.util.js";

const COMPLEXITY_BY_CAPABILITY_COUNT = Object.freeze([
  { min: 0, max: 1,  value: 0.2 },
  { min: 2, max: 3,  value: 0.4 },
  { min: 4, max: 6,  value: 0.6 },
  { min: 7, max: 10, value: 0.8 },
]);

const HIGH_RISK_INTENTS  = new Set<IntentType>(["DELETE", "DEPLOY", "MIGRATE"]);
const PARALLEL_DOMAINS   = new Set<CapabilityDomain>(["testing", "documentation"]);
const MUTATION_DOMAINS   = new Set<CapabilityDomain>(["database-management", "deployment"]);

function estimateComplexity(capabilityCount: number, ambiguityScore: number): number {
  const entry = COMPLEXITY_BY_CAPABILITY_COUNT.find(
    r => capabilityCount >= r.min && capabilityCount <= r.max
  );
  const base  = entry?.value ?? 0.9;
  return normalizeScore(base + ambiguityScore * 0.2);
}

function selectHints(
  intent:       ExtractedIntent,
  ambiguity:    AmbiguityReport,
  capabilities: CapabilityMap,
): readonly ExecutionHint[] {
  const hints = new Set<ExecutionHint>();

  const capCount = capabilities.capabilities.length;

  if (capCount >= 4) {
    hints.add("prefer-sequential");
  }

  const hasParallelDomain = capabilities.capabilities.some(c => PARALLEL_DOMAINS.has(c.domain));
  if (hasParallelDomain && capCount >= 3) {
    hints.add("prefer-parallel");
  }

  if (HIGH_RISK_INTENTS.has(intent.primaryIntent)) {
    hints.add("checkpoint-recommended");
    hints.add("dry-run-first");
  }

  const hasMutationDomain = capabilities.capabilities.some(c => MUTATION_DOMAINS.has(c.domain));
  if (hasMutationDomain) {
    hints.add("snapshot-before-mutate");
  }

  if (ambiguity.isHighlyAmbiguous) {
    hints.add("validate-early");
  }

  if (intent.confidence >= 0.8 && !ambiguity.isHighlyAmbiguous && capCount <= 3) {
    hints.add("high-confidence-fast-path");
  }

  if (intent.scope === "full-application") {
    hints.add("incremental-approach");
    hints.add("checkpoint-recommended");
  }

  return Object.freeze([...hints]);
}

function buildPreferredOrder(capabilities: CapabilityMap): readonly string[] {
  const order: string[] = [];
  const domainPriority: readonly CapabilityDomain[] = [
    "configuration",
    "database-management",
    "backend-code-generation",
    "api-design",
    "frontend-code-generation",
    "testing",
    "documentation",
    "deployment",
    "refactoring",
    "analysis",
  ];

  for (const d of domainPriority) {
    const cap = capabilities.capabilities.find(c => c.domain === d);
    if (cap !== undefined) order.push(d);
  }

  return Object.freeze(order);
}

function buildWarnings(
  intent:    ExtractedIntent,
  ambiguity: AmbiguityReport,
): readonly string[] {
  const warnings: string[] = [];

  if (ambiguity.isHighlyAmbiguous) {
    warnings.push("Goal has high ambiguity. Refine the prompt before executing the plan.");
  }

  if (HIGH_RISK_INTENTS.has(intent.primaryIntent)) {
    warnings.push(`Intent "${intent.primaryIntent}" is destructive. Require explicit confirmation.`);
  }

  if (intent.confidence < 0.4) {
    warnings.push("Intent confidence is low. Primary action verb may be missing or unclear.");
  }

  return Object.freeze(warnings);
}

function buildRationale(
  hints:      readonly ExecutionHint[],
  complexity: number,
  domain:     string,
): string {
  const hintSummary  = hints.length > 0 ? hints.slice(0, 3).join(", ") : "standard execution";
  const complexLabel = complexity >= 0.7 ? "high" : complexity >= 0.4 ? "medium" : "low";
  return `Domain "${domain}" with ${complexLabel} complexity. Suggested strategy: ${hintSummary}.`;
}

export function buildStrategyHint(
  intent:      ExtractedIntent,
  ambiguity:   AmbiguityReport,
  capabilities: CapabilityMap,
): StrategyHint {
  const hints               = selectHints(intent, ambiguity, capabilities);
  const estimatedComplexity = estimateComplexity(capabilities.capabilities.length, ambiguity.overallAmbiguity);
  const preferredOrder      = buildPreferredOrder(capabilities);
  const warnings            = buildWarnings(intent, ambiguity);
  const rationale           = buildRationale(hints, estimatedComplexity, intent.domain);

  return Object.freeze<StrategyHint>({
    hints,
    estimatedComplexity,
    preferredOrder,
    warnings,
    rationale,
  });
}

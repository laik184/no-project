import {
  runArchitectureEvolution,
  getEvolutionState,
  getLastPlan,
  clearEvolutionState,
} from "./index.js";
import type {
  ArchitectureAnalysisReport,
  AnalysisViolation,
  ArchitectureEvolutionPlan,
  ArchitecturePattern,
} from "./index.js";
import { detectArchitecturePattern } from "./agents/pattern-detector.agent.js";
import { buildEvolutionStrategy } from "./agents/evolution-strategy.agent.js";
import { generateMigrationPlan } from "./agents/migration-planner.agent.js";
import { analyzeEvolutionRisks } from "./agents/risk-analyzer.agent.js";
import { evaluateTradeoffs } from "./agents/tradeoff-evaluator.agent.js";
import { scoreEvolutionPlan } from "./utils/scoring.util.js";
import { derivePatternMetrics } from "./utils/dependency-graph.util.js";
import { inferPatternFromMetrics } from "./utils/pattern-map.util.js";
import { selectTargetPattern, buildStrategyNarrative } from "./utils/strategy-builder.util.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function violation(
  id:       string,
  type:     string,
  severity: AnalysisViolation["severity"],
  message:  string = "",
): AnalysisViolation {
  return Object.freeze({ id, type, severity, message });
}

function report(
  violations: readonly AnalysisViolation[] = [],
  meta?: ArchitectureAnalysisReport["metadata"],
): ArchitectureAnalysisReport {
  return Object.freeze({
    reportId:        `t-${Date.now()}`,
    analyzedAt:      Date.now(),
    totalViolations: violations.length,
    violations,
    metadata:        meta,
  });
}

function reset(): void {
  clearEvolutionState();
}

reset();

// ─── utils/dependency-graph.util ─────────────────────────────────────────────
console.log("\n── utils/dependency-graph.util ──");
{
  const metrics = derivePatternMetrics(report([]));
  assert("derivePatternMetrics: returns object",             typeof metrics === "object");
  assert("derivePatternMetrics: serviceCount ≥0",            metrics.serviceCount >= 0);
  assert("derivePatternMetrics: moduleCount ≥0",             metrics.moduleCount >= 0);
  assert("derivePatternMetrics: violationDensity ≥0",        metrics.violationDensity >= 0);

  const richReport = report(
    [
      violation("v1", "CIRCULAR_DEPENDENCY", "CRITICAL", "cyclic"),
      violation("v2", "TIGHT_COUPLING",      "HIGH",     "coupling"),
    ],
    { serviceCount: 4, moduleCount: 8 },
  );
  const richMetrics = derivePatternMetrics(richReport);
  assert("derivePatternMetrics: cycleSignals ≥1 for cycle violation",   richMetrics.cycleSignals >= 1);
  assert("derivePatternMetrics: couplingSignals ≥1 for coupling viol",  richMetrics.couplingSignals >= 1);
  assert("derivePatternMetrics: serviceCount=4 from metadata",          richMetrics.serviceCount === 4);
}

// ─── utils/pattern-map.util ──────────────────────────────────────────────────
console.log("\n── utils/pattern-map.util ──");
{
  const microPattern = inferPatternFromMetrics({
    serviceCount: 5, moduleCount: 10, violationDensity: 0.1,
    cycleSignals: 0, couplingSignals: 0,
  });
  assert("inferPattern: many services → microservices or modular",
    microPattern === "microservices" || microPattern === "modular");

  const monolithPattern = inferPatternFromMetrics({
    serviceCount: 0, moduleCount: 1, violationDensity: 0.8,
    cycleSignals: 3, couplingSignals: 5,
  });
  assert("inferPattern: low modules + high density → monolith or layered",
    monolithPattern === "monolith" || monolithPattern === "layered");
}

// ─── utils/strategy-builder.util ─────────────────────────────────────────────
console.log("\n── utils/strategy-builder.util ──");
{
  const r = report();
  const target = selectTargetPattern("monolith", r);
  assert("selectTargetPattern: returns ArchitecturePattern",
    ["monolith","layered","modular","microservices"].includes(target));

  const narrative = buildStrategyNarrative("monolith", "modular");
  assert("buildStrategyNarrative: returns non-empty string",
    typeof narrative === "string" && narrative.length > 0);

  const sameNarrative = buildStrategyNarrative("modular", "modular");
  assert("buildStrategyNarrative: same → same/maintain message",
    typeof sameNarrative === "string");
}

// ─── utils/scoring.util ──────────────────────────────────────────────────────
console.log("\n── utils/scoring.util ──");
{
  const score = scoreEvolutionPlan("LOW", ["step1", "step2"], []);
  assert("scoreEvolutionPlan: returns 0–100",             score >= 0 && score <= 100);
  assert("scoreEvolutionPlan: LOW risk → higher score",   score >= 50);

  const highRiskScore = scoreEvolutionPlan("HIGH", ["s1","s2","s3","s4","s5","s6","s7"], ["cyclic dependencies","tight coupling"]);
  assert("scoreEvolutionPlan: HIGH risk → lower score",   highRiskScore < score);
}

// ─── agents/pattern-detector ─────────────────────────────────────────────────
console.log("\n── agents/pattern-detector.agent ──");
{
  const empty = detectArchitecturePattern(report());
  assert("detectArchitecturePattern: returns currentPattern",
    ["monolith","layered","modular","microservices"].includes(empty.currentPattern));
  assert("detectArchitecturePattern: confidence 0–100",    empty.confidence >= 0 && empty.confidence <= 100);
  assert("detectArchitecturePattern: antiPatterns array",  Array.isArray(empty.antiPatterns));

  const cyclicReport = report([
    violation("c1", "CIRCULAR_DEPENDENCY", "CRITICAL", "cycle cycle cycle"),
    violation("c2", "TIGHT_COUPLING",       "HIGH",    "tightly coupled"),
  ]);
  const detected = detectArchitecturePattern(cyclicReport);
  assert("detectArchitecturePattern: cycle viol → antiPatterns includes cycle",
    detected.antiPatterns.includes("cyclic dependencies"));
  assert("detectArchitecturePattern: coupling viol → antiPatterns includes coupling",
    detected.antiPatterns.includes("tight coupling"));
}

// ─── agents/evolution-strategy ───────────────────────────────────────────────
console.log("\n── agents/evolution-strategy.agent ──");
{
  const detected = detectArchitecturePattern(report([], { moduleCount: 5, scale: "medium" }));
  const strategy = buildEvolutionStrategy(report([], { moduleCount: 5, scale: "medium" }), detected);

  assert("buildEvolutionStrategy: targetPattern is valid",
    ["monolith","layered","modular","microservices"].includes(strategy.targetPattern));
  assert("buildEvolutionStrategy: strategy is non-empty string",
    typeof strategy.strategy === "string" && strategy.strategy.length > 0);
  assert("buildEvolutionStrategy: rationale is non-empty array",
    Array.isArray(strategy.rationale) && strategy.rationale.length > 0);
}

// ─── agents/migration-planner ────────────────────────────────────────────────
console.log("\n── agents/migration-planner.agent ──");
{
  const detected = { currentPattern: "monolith" as ArchitecturePattern, antiPatterns: Object.freeze([]), confidence: 70 };
  const strategy = { targetPattern: "microservices" as ArchitecturePattern, strategy: "Extract services", rationale: Object.freeze([]) };

  const plan = generateMigrationPlan(detected, strategy);
  assert("generateMigrationPlan: migrationSteps is array",     Array.isArray(plan.migrationSteps));
  assert("generateMigrationPlan: at least 3 steps",            plan.migrationSteps.length >= 3);
  assert("generateMigrationPlan: steps are strings",           plan.migrationSteps.every((s) => typeof s === "string"));

  const cycleDetected = { currentPattern: "monolith" as ArchitecturePattern, antiPatterns: Object.freeze(["cyclic dependencies"]), confidence: 60 };
  const cyclePlan = generateMigrationPlan(cycleDetected, strategy);
  assert("generateMigrationPlan: includes cycle-break step when cycle detected",
    cyclePlan.migrationSteps.some((s) => s.toLowerCase().includes("cycl") || s.toLowerCase().includes("depend")));
}

// ─── agents/risk-analyzer ────────────────────────────────────────────────────
console.log("\n── agents/risk-analyzer.agent ──");
{
  const lowRisk = analyzeEvolutionRisks(
    { currentPattern: "modular" as ArchitecturePattern, antiPatterns: Object.freeze([]), confidence: 80 },
    { migrationSteps: Object.freeze(["step1", "step2"]) },
  );
  assert("analyzeEvolutionRisks: riskLevel is LOW|MEDIUM|HIGH",
    ["LOW","MEDIUM","HIGH"].includes(lowRisk.riskLevel));
  assert("analyzeEvolutionRisks: risks array non-empty",      lowRisk.risks.length >= 1);

  const highRisk = analyzeEvolutionRisks(
    { currentPattern: "monolith" as ArchitecturePattern, antiPatterns: Object.freeze(["cyclic dependencies","tight coupling"]), confidence: 40 },
    { migrationSteps: Object.freeze(["s1","s2","s3","s4","s5","s6","s7","s8"]) },
  );
  assert("analyzeEvolutionRisks: many steps + anti-patterns → MEDIUM or HIGH",
    highRisk.riskLevel === "MEDIUM" || highRisk.riskLevel === "HIGH");
}

// ─── agents/tradeoff-evaluator ───────────────────────────────────────────────
console.log("\n── agents/tradeoff-evaluator.agent ──");
{
  const microTradeoff = evaluateTradeoffs("microservices");
  assert("evaluateTradeoffs: microservices → non-empty tradeoffs",    microTradeoff.tradeoffs.length >= 3);
  assert("evaluateTradeoffs: microservices → has distributed warning",
    microTradeoff.tradeoffs.some((t) => t.toLowerCase().includes("distribut") || t.toLowerCase().includes("latency")));

  const modularTradeoff = evaluateTradeoffs("modular");
  assert("evaluateTradeoffs: modular → non-empty tradeoffs",         modularTradeoff.tradeoffs.length >= 3);
  assert("evaluateTradeoffs: modular → lower risk note",
    modularTradeoff.tradeoffs.some((t) => t.toLowerCase().includes("risk") || t.toLowerCase().includes("migration")));
}

// ─── state ───────────────────────────────────────────────────────────────────
console.log("\n── state ──");
{
  reset();
  assert("getEvolutionState: null before run",  getEvolutionState() === null);
  assert("getLastPlan: null before run",        getLastPlan() === null);
}

// ─── runArchitectureEvolution (orchestrator) ──────────────────────────────────
console.log("\n── runArchitectureEvolution (orchestrator) ──");
{
  reset();

  const simpleReport = report(
    [
      violation("e1", "CIRCULAR_DEPENDENCY", "CRITICAL", "cycle"),
      violation("e2", "TIGHT_COUPLING",      "HIGH",     "coupling"),
    ],
    { moduleCount: 6, teamSize: 4, scale: "medium" },
  );

  const plan: ArchitectureEvolutionPlan = runArchitectureEvolution(simpleReport);

  assert("runArchitectureEvolution: currentArchitecture is valid",
    ["monolith","layered","modular","microservices"].includes(plan.currentArchitecture));
  assert("runArchitectureEvolution: targetArchitecture is valid",
    ["monolith","layered","modular","microservices"].includes(plan.targetArchitecture));
  assert("runArchitectureEvolution: strategy is non-empty string",
    typeof plan.strategy === "string" && plan.strategy.length > 0);
  assert("runArchitectureEvolution: migrationSteps non-empty",
    plan.migrationSteps.length >= 3);
  assert("runArchitectureEvolution: risks non-empty",
    plan.risks.length >= 1);
  assert("runArchitectureEvolution: tradeoffs non-empty",
    plan.tradeoffs.length >= 3);
  assert("runArchitectureEvolution: score 0–100",
    plan.score >= 0 && plan.score <= 100);

  const state = getEvolutionState();
  assert("getEvolutionState: not null after run",            state !== null);
  assert("getEvolutionState: stepsGenerated ≥3",            (state?.stepsGenerated ?? 0) >= 3);

  const savedPlan = getLastPlan();
  assert("getLastPlan: not null after run",                  savedPlan !== null);
  assert("getLastPlan: matches returned plan strategy",
    savedPlan?.strategy === plan.strategy);

  reset();
  assert("clearEvolutionState: resets state to null",        getEvolutionState() === null);
  assert("clearEvolutionState: resets plan to null",         getLastPlan() === null);
}

// ─── runArchitectureEvolution: invalid input ─────────────────────────────────
console.log("\n── runArchitectureEvolution: error handling ──");
{
  let threw = false;
  try {
    runArchitectureEvolution(null as unknown as ArchitectureAnalysisReport);
  } catch (_) {
    threw = true;
  }
  assert("runArchitectureEvolution: throws on null input",   threw);

  let threw2 = false;
  try {
    runArchitectureEvolution({ reportId: "x", analyzedAt: 0, totalViolations: 0, violations: null as unknown as readonly AnalysisViolation[] });
  } catch (_) {
    threw2 = true;
  }
  assert("runArchitectureEvolution: throws on null violations", threw2);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`evolution: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

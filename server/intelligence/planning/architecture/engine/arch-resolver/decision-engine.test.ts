import {
  buildDecisionPlan,
  getDecisionState,
} from "./index.js";
import type {
  ArchitectureAnalysisReport,
  AnalysisViolation,
  DecisionPlan,
} from "./index.js";
import { setDecisionState, toDecisionPlan } from "./state.js";
import { classifyViolation } from "./classification/violation.classifier.js";
import { scoreSeverity } from "./scoring/severity.scorer.js";
import { scoreImpact } from "./scoring/impact.scorer.js";
import { scoreRisk } from "./scoring/risk.scorer.js";
import { calculatePriority } from "./prioritization/priority.calculator.js";
import { detectUrgency } from "./prioritization/urgency.detector.js";
import { buildFixStrategy } from "./strategy/fix-strategy.builder.js";
import { buildIsolationStrategy } from "./strategy/isolation.strategy.js";
import { buildRefactorStrategy } from "./strategy/refactor.strategy.js";
import { clampScore } from "./utils/normalization.util.js";
import { weightedScore, composeWeightedScore } from "./utils/weight.util.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function violation(
  id: string,
  type: string,
  severity: AnalysisViolation["severity"],
  message: string = "violation",
  extra: Partial<AnalysisViolation> = {},
): AnalysisViolation {
  return Object.freeze({ id, type, severity, message, ...extra });
}

function report(violations: readonly AnalysisViolation[]): ArchitectureAnalysisReport {
  return Object.freeze({
    reportId:        `test-${Date.now()}`,
    analyzedAt:      Date.now(),
    totalViolations: violations.length,
    violations,
  });
}

// ─── utils/normalization ─────────────────────────────────────────────────────
console.log("\n── utils/normalization.util ──");
{
  assert("clampScore: 50 → 50",         clampScore(50) === 50);
  assert("clampScore: 0 → 0",           clampScore(0) === 0);
  assert("clampScore: 100 → 100",       clampScore(100) === 100);
  assert("clampScore: -5 → 0",          clampScore(-5) === 0);
  assert("clampScore: 110 → 100",       clampScore(110) === 100);
  assert("clampScore: NaN → 0",         clampScore(NaN) === 0);
  assert("clampScore: Infinity → 100",  clampScore(Infinity) === 100);
  assert("clampScore: -Infinity → 0",   clampScore(-Infinity) === 0);
}

// ─── utils/weight ─────────────────────────────────────────────────────────────
console.log("\n── utils/weight.util ──");
{
  assert("weightedScore: 100 * 0.5 = 50",  weightedScore(100, 0.5) === 50);
  assert("weightedScore: 0 * 1 = 0",       weightedScore(0, 1) === 0);
  assert("weightedScore: 50 * 0.1 = 5",    weightedScore(50, 0.1) === 5);

  const composed = composeWeightedScore([
    { value: 100, weight: 0.5 },
    { value: 100, weight: 0.3 },
    { value: 100, weight: 0.2 },
  ]);
  assert("composeWeightedScore: all-100 = 100", composed === 100);

  const partial = composeWeightedScore([
    { value: 100, weight: 0.5 },
    { value: 0,   weight: 0.5 },
  ]);
  assert("composeWeightedScore: 100+0 weights 0.5/0.5 = 50", partial === 50);
}

// ─── scoring/severity ────────────────────────────────────────────────────────
console.log("\n── scoring/severity.scorer ──");
{
  assert("CRITICAL → 100", scoreSeverity(violation("v1", "X", "CRITICAL")) === 100);
  assert("HIGH → 75",      scoreSeverity(violation("v2", "X", "HIGH"))     === 75);
  assert("MEDIUM → 50",    scoreSeverity(violation("v3", "X", "MEDIUM"))   === 50);
  assert("LOW → 25",       scoreSeverity(violation("v4", "X", "LOW"))      === 25);
}

// ─── scoring/impact ──────────────────────────────────────────────────────────
console.log("\n── scoring/impact.scorer ──");
{
  const stateViolation = violation("v5", "STATE_MUTATION", "CRITICAL",
    "state mutation outside orchestrator",
    { file: "a.ts", source: "b.ts", from: "c.ts", to: "d.ts" });
  const impact = scoreImpact(stateViolation);
  assert("scoreImpact: returns 0–100",         impact >= 0 && impact <= 100);
  assert("scoreImpact: CRITICAL state is high", impact >= 60);

  const lowViolation = violation("v6", "UTIL_ISSUE", "LOW", "util concern", { file: "x.ts" });
  const lowImpact = scoreImpact(lowViolation);
  assert("scoreImpact: LOW violation is lower",  lowImpact <= impact);
}

// ─── scoring/risk ────────────────────────────────────────────────────────────
console.log("\n── scoring/risk.scorer ──");
{
  const circular = violation("v7", "CIRCULAR_DEPENDENCY", "CRITICAL", "circular cycle detected");
  const riskScore = scoreRisk(circular);
  assert("scoreRisk: returns 0–100",              riskScore >= 0 && riskScore <= 100);
  assert("scoreRisk: CIRCULAR is high risk",       riskScore >= 60);

  const low = violation("v8", "MINOR_ISSUE", "LOW", "minor style note");
  assert("scoreRisk: LOW is lower than CIRCULAR",  scoreRisk(low) < riskScore);
}

// ─── prioritization/priority ─────────────────────────────────────────────────
console.log("\n── prioritization/priority.calculator ──");
{
  const high = calculatePriority(100, 100, 100);
  assert("calculatePriority: all-100 → HIGH",   high.priority === "HIGH");
  assert("calculatePriority: all-100 score ≥75", high.score >= 75);

  const low = calculatePriority(25, 25, 25);
  assert("calculatePriority: all-25 → LOW",      low.priority === "LOW");
  assert("calculatePriority: all-25 score <50",   low.score < 50);

  const med = calculatePriority(60, 50, 45);
  assert("calculatePriority: medium → MEDIUM",   med.priority === "MEDIUM");
}

// ─── prioritization/urgency ──────────────────────────────────────────────────
console.log("\n── prioritization/urgency.detector ──");
{
  const blockerViolation = violation("v9", "CIRCULAR_DEPENDENCY", "CRITICAL", "cycle");
  const u1 = detectUrgency(blockerViolation, 90);
  assert("detectUrgency: CIRCULAR → blocksDeployment", u1.blocksDeployment === true);
  assert("detectUrgency: blocksDeployment → urgent",   u1.urgent === true);

  const nonBlocker = violation("v10", "MINOR", "LOW", "minor");
  const u2 = detectUrgency(nonBlocker, 30);
  assert("detectUrgency: LOW+30 → not blocking",       u2.blocksDeployment === false);
  assert("detectUrgency: LOW+30 → not urgent",         u2.urgent === false);

  const highScore = violation("v11", "OTHER", "MEDIUM", "medium");
  const u3 = detectUrgency(highScore, 90);
  assert("detectUrgency: score≥85 → urgent",           u3.urgent === true);
}

// ─── classification/violation.classifier ─────────────────────────────────────
console.log("\n── classification/violation.classifier ──");
{
  assert("classify: CIRCULAR_DEPENDENCY → dependency",
    classifyViolation(violation("c1", "CIRCULAR_DEPENDENCY", "HIGH", "cycle"))   === "dependency");
  assert("classify: LAYER_BOUNDARY_VIOLATION → boundary",
    classifyViolation(violation("c2", "LAYER_BOUNDARY_VIOLATION", "HIGH", "boundary")) === "boundary");
  assert("classify: SRP_VIOLATION → responsibility",
    classifyViolation(violation("c3", "SRP_VIOLATION", "MEDIUM", "responsibility srp")) === "responsibility");
  assert("classify: HVP_ORCHESTRATOR → hvp",
    classifyViolation(violation("c4", "HVP_ORCHESTRATOR_BYPASS", "CRITICAL", "hvp bypass")) === "hvp");
}

// ─── strategy/isolation ──────────────────────────────────────────────────────
console.log("\n── strategy/isolation.strategy ──");
{
  const stateV = violation("s1", "STATE_MUTATION", "CRITICAL", "state mutation");
  const s1 = buildIsolationStrategy(stateV);
  assert("isolationStrategy: STATE → route through orchestrator",
    s1.strategy.toLowerCase().includes("state") || s1.strategy.toLowerCase().includes("orchestrator"));

  const leakV = violation("s2", "DOMAIN_LEAKAGE", "HIGH", "boundary leakage");
  const s2 = buildIsolationStrategy(leakV);
  assert("isolationStrategy: LEAKAGE → move file",
    s2.strategy.toLowerCase().includes("move") || s2.strategy.toLowerCase().includes("boundary") || s2.strategy.toLowerCase().includes("isolat"));
}

// ─── strategy/refactor ───────────────────────────────────────────────────────
console.log("\n── strategy/refactor.strategy ──");
{
  const cycleV = violation("r1", "CIRCULAR_DEPENDENCY", "HIGH", "cycle");
  const r1 = buildRefactorStrategy(cycleV);
  assert("refactorStrategy: CIRCULAR → extract interface",
    r1.strategy.toLowerCase().includes("interface") || r1.strategy.toLowerCase().includes("invert") || r1.strategy.toLowerCase().includes("abstract"));

  const srpV = violation("r2", "MIXED_CONCERNS", "MEDIUM", "mixed concerns");
  const r2 = buildRefactorStrategy(srpV);
  assert("refactorStrategy: MIXED_CONCERNS → split",
    r2.strategy.toLowerCase().includes("split") || r2.strategy.toLowerCase().includes("decompos"));
}

// ─── state ───────────────────────────────────────────────────────────────────
console.log("\n── state ──");
{
  const stateResult = getDecisionState();
  assert("getDecisionState: returns object", typeof stateResult === "object");
  assert("getDecisionState: has decisions array", Array.isArray(stateResult.decisions));

  setDecisionState([], 12345);
  const afterSet = getDecisionState();
  assert("setDecisionState: updates lastRunAt", afterSet.lastRunAt === 12345);
  assert("setDecisionState: empty decisions", afterSet.decisions.length === 0);

  const plan = toDecisionPlan([]);
  assert("toDecisionPlan: empty → totalIssues=0", plan.totalIssues === 0);
  assert("toDecisionPlan: empty → all zeros",      plan.highPriority === 0 && plan.mediumPriority === 0 && plan.lowPriority === 0);
}

// ─── buildDecisionPlan (orchestrator) ────────────────────────────────────────
console.log("\n── buildDecisionPlan (orchestrator) ──");
{
  const emptyReport = report([]);
  const emptyPlan = buildDecisionPlan(emptyReport);
  assert("empty report → totalIssues=0",    emptyPlan.totalIssues === 0);
  assert("empty report → decisions=[]",     emptyPlan.decisions.length === 0);

  const violations: AnalysisViolation[] = [
    violation("d1", "CIRCULAR_DEPENDENCY",     "CRITICAL", "cycle detected"),
    violation("d2", "LAYER_BOUNDARY_VIOLATION","HIGH",     "layer breach"),
    violation("d3", "SRP_VIOLATION",           "MEDIUM",   "mixed concerns"),
    violation("d4", "MINOR_UTIL_NOTE",         "LOW",      "utility note"),
  ];
  const mixedPlan: DecisionPlan = buildDecisionPlan(report(violations));

  assert("mixed report → totalIssues=4",    mixedPlan.totalIssues === 4);
  assert("mixed report → decisions.length=4", mixedPlan.decisions.length === 4);
  assert("mixed report → HIGH count ≥1",    mixedPlan.highPriority >= 1);

  const sorted = mixedPlan.decisions;
  const firstSeverity  = sorted[0].severity;
  const secondSeverity = sorted[1]?.severity ?? 0;
  assert("decisions sorted: first ≥ second severity", firstSeverity >= secondSeverity);

  for (const d of sorted) {
    assert(`decision ${d.id}: has strategy string`,  typeof d.strategy === "string" && d.strategy.length > 0);
    assert(`decision ${d.id}: priority is valid`,    ["HIGH","MEDIUM","LOW"].includes(d.priority));
    assert(`decision ${d.id}: severity in 0–100`,   d.severity >= 0 && d.severity <= 100);
  }
}

// ─── getDecisionState reflects last run ──────────────────────────────────────
console.log("\n── getDecisionState reflects last run ──");
{
  const v = violation("e1", "CIRCULAR_DEPENDENCY", "CRITICAL", "cycle");
  buildDecisionPlan(report([v]));
  const s = getDecisionState();
  assert("state.decisions.length=1 after run", s.decisions.length === 1);
  assert("state.lastRunAt > 0",                s.lastRunAt > 0);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`decision-engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

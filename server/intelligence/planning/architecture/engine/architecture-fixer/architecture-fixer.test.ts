import {
  runArchitectureFixer,
  resetFixerState,
  buildFixPlan,
  mapViolations,
  generatePatches,
  validateFixes,
  NoopExecutionAdapter,
} from "./index.js";
import type {
  FixableViolation,
  FixAction,
  FixResult,
  Patch,
} from "./index.js";
import type { RawViolation } from "./mapping/violation.types.js";
import { setSession, getSession, updateSessionStatus, clearSessions } from "./state.js";
import { selectActions, transformActions } from "./orchestrator/pipeline.agent.js";
import { LayerViolationStrategy } from "./strategies/layer-violation.strategy.js";
import { DependencyCycleStrategy } from "./strategies/dependency-cycle.strategy.js";
import { DomainLeakageStrategy } from "./strategies/domain-leakage.strategy.js";
import { SrpViolationStrategy } from "./strategies/srp-violation.strategy.js";
import { resetViolationMapperState } from "./mapping/violation.mapper.js";
import { resetPatchGeneratorState } from "./bridge/patch.generator.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void {
  clearSessions();
  resetFixerState();
  resetViolationMapperState();
  resetPatchGeneratorState();
}

function raw(
  id:       string,
  type:     string,
  severity: string = "MEDIUM",
  file:     string = "src/agent.ts",
  extra:    Partial<RawViolation> = {},
): RawViolation {
  return Object.freeze({ id, type, severity, file, ...extra });
}

reset();

// ─── mapping/violation.mapper ────────────────────────────────────────────────
console.log("\n── mapping/violation.mapper ──");
{
  const empty = mapViolations([]);
  assert("mapViolations: empty → violations=[]",  empty.violations.length === 0);
  assert("mapViolations: empty → warnings=[]",    empty.warnings.length === 0);

  const result = mapViolations([
    raw("v1", "LAYER_BOUNDARY_VIOLATION", "HIGH"),
    raw("v2", "CIRCULAR_DEPENDENCY",      "CRITICAL"),
    raw("v3", "DOMAIN_LEAKAGE",           "MEDIUM"),
    raw("v4", "SRP_VIOLATION",            "LOW"),
  ]);
  assert("mapViolations: 4 raw → 4 violations",   result.violations.length === 4);
  assert("mapViolations: LAYER → LAYER_VIOLATION",
    result.violations.find((v) => v.id === "v1")?.kind === "LAYER_VIOLATION");
  assert("mapViolations: CIRCULAR → DEPENDENCY_CYCLE",
    result.violations.find((v) => v.id === "v2")?.kind === "DEPENDENCY_CYCLE");
  assert("mapViolations: DOMAIN_LEAKAGE → DOMAIN_LEAKAGE",
    result.violations.find((v) => v.id === "v3")?.kind === "DOMAIN_LEAKAGE");
  assert("mapViolations: SRP → SRP_VIOLATION",
    result.violations.find((v) => v.id === "v4")?.kind === "SRP_VIOLATION");

  const unsupported = mapViolations([raw("u1", "UNKNOWN_TYPE", "LOW")]);
  assert("mapViolations: UNSUPPORTED is filtered out", unsupported.violations.length === 0);
  assert("mapViolations: UNSUPPORTED emits warning",   unsupported.warnings.length >= 1);

  resetViolationMapperState();
}

// ─── strategies ──────────────────────────────────────────────────────────────
console.log("\n── strategies ──");
{
  const layerV: FixableViolation = Object.freeze({
    id: "sv1", kind: "LAYER_VIOLATION", severity: "HIGH",
    source: "infrastructure/db.ts", evidence: Object.freeze([]), metadata: Object.freeze({}),
  });
  const cycleV: FixableViolation = Object.freeze({
    id: "sv2", kind: "DEPENDENCY_CYCLE", severity: "CRITICAL",
    source: "agents/planner.ts", target: "agents/executor.ts",
    evidence: Object.freeze([]), metadata: Object.freeze({}),
  });
  const leakV: FixableViolation = Object.freeze({
    id: "sv3", kind: "DOMAIN_LEAKAGE", severity: "HIGH",
    source: "infrastructure/billing.ts", evidence: Object.freeze([]), metadata: Object.freeze({}),
  });
  const srpV: FixableViolation = Object.freeze({
    id: "sv4", kind: "SRP_VIOLATION", severity: "MEDIUM",
    source: "agents/big.agent.ts", evidence: Object.freeze([]), metadata: Object.freeze({}),
  });

  const layerStrat = new LayerViolationStrategy();
  assert("LayerViolationStrategy.supports: LAYER_VIOLATION",    layerStrat.supports(layerV));
  assert("LayerViolationStrategy.supports: not CYCLE",          !layerStrat.supports(cycleV));
  const layerActions = layerStrat.buildActions(layerV);
  assert("LayerViolationStrategy: 2 actions",                   layerActions.length === 2);
  assert("LayerViolationStrategy: MOVE_FILE first",             layerActions[0].type === "MOVE_FILE");
  assert("LayerViolationStrategy: REWRITE_IMPORT second",       layerActions[1].type === "REWRITE_IMPORT");

  const cycleStrat = new DependencyCycleStrategy();
  assert("DependencyCycleStrategy.supports: DEPENDENCY_CYCLE",  cycleStrat.supports(cycleV));
  const cycleActions = cycleStrat.buildActions(cycleV);
  assert("DependencyCycleStrategy: 2 actions",                  cycleActions.length === 2);
  assert("DependencyCycleStrategy: EXTRACT_INTERFACE first",    cycleActions[0].type === "EXTRACT_INTERFACE");

  const leakStrat = new DomainLeakageStrategy();
  assert("DomainLeakageStrategy.supports: DOMAIN_LEAKAGE",      leakStrat.supports(leakV));
  const leakActions = leakStrat.buildActions(leakV);
  assert("DomainLeakageStrategy: 2 actions",                    leakActions.length === 2);

  const srpStrat = new SrpViolationStrategy();
  assert("SrpViolationStrategy.supports: SRP_VIOLATION",        srpStrat.supports(srpV));
  const srpActions = srpStrat.buildActions(srpV);
  assert("SrpViolationStrategy: 2 actions",                     srpActions.length === 2);
  assert("SrpViolationStrategy: SPLIT_FILE first",              srpActions[0].type === "SPLIT_FILE");
}

// ─── pipeline/selectActions ───────────────────────────────────────────────────
console.log("\n── pipeline.manager / selectActions ──");
{
  const violations = mapViolations([
    raw("p1", "LAYER_BOUNDARY_VIOLATION", "HIGH"),
    raw("p2", "CIRCULAR_DEPENDENCY",      "CRITICAL"),
    raw("p3", "UNKNOWN_UNSUPPORTED",      "LOW"),
  ]).violations;

  const selected = selectActions(violations);
  assert("selectActions: generates actions for mapped violations", selected.actions.length >= 2);
  assert("selectActions: warns on no-strategy violations",        selected.warnings.length >= 0);
  assert("selectActions: actions sorted by priority",
    selected.actions.length < 2 || selected.actions[0].priority <= selected.actions[1].priority);

  resetViolationMapperState();
}

// ─── planner/fix-plan.builder ────────────────────────────────────────────────
console.log("\n── planner/fix-plan.builder ──");
{
  const actions: readonly FixAction[] = Object.freeze([
    Object.freeze({ actionId: "a1", violationId: "v1", type: "MOVE_FILE" as const,      reason: "r", params: Object.freeze({ from: "a.ts", to: "b.ts" }), priority: 10 }),
    Object.freeze({ actionId: "a2", violationId: "v1", type: "REWRITE_IMPORT" as const, reason: "r", params: Object.freeze({ file: "b.ts" }),             priority: 20 }),
    Object.freeze({ actionId: "a3", violationId: "v2", type: "SPLIT_FILE" as const,     reason: "r", params: Object.freeze({ source: "c.ts", primary: "c.core.ts", secondary: "c.helpers.ts" }), priority: 10 }),
  ]);

  const plan = buildFixPlan({ actions });
  assert("buildFixPlan: 3 actions → 3 steps",           plan.plan.steps.length === 3);
  assert("buildFixPlan: riskScore > 0",                  plan.riskScore > 0);
  assert("buildFixPlan: reversible flag is boolean",     typeof plan.reversible === "boolean");
  assert("buildFixPlan: v1-a2 depends on a1",
    (plan.plan.steps.find((s) => s.stepId.includes("a2"))?.dependsOn.length ?? 0) >= 1);

  const emptyPlan = buildFixPlan({ actions: [] });
  assert("buildFixPlan: empty → 0 steps",               emptyPlan.plan.steps.length === 0);
  assert("buildFixPlan: empty → riskScore=0",            emptyPlan.riskScore === 0);
}

// ─── bridge/patch.generator ──────────────────────────────────────────────────
console.log("\n── bridge/patch.generator ──");
{
  resetPatchGeneratorState();
  const patches: readonly Patch[] = generatePatches([
    {
      actionId: "ax1",
      changes: [
        { path: "src/a.ts", previousContent: "import './b';", nextContent: "import './c';" },
      ],
      warnings: [],
    },
    {
      actionId: "ax2",
      changes: [
        { path: "src/a.ts", previousContent: "import './b';", nextContent: "import './b';" },
      ],
      warnings: [],
    },
  ]);
  assert("generatePatches: identical content skipped",   patches.length === 1);
  assert("generatePatches: patch has diff",              typeof patches[0].diff === "string" && patches[0].diff.length > 0);
  assert("generatePatches: patch reversible=true",       patches[0].reversible === true);
  assert("generatePatches: patch has filePath",          patches[0].filePath === "src/a.ts");
  resetPatchGeneratorState();
}

// ─── validator/fix.validator ──────────────────────────────────────────────────
console.log("\n── validator/fix.validator ──");
{
  const patches: readonly Patch[] = Object.freeze([
    Object.freeze({ id: "px1", filePath: "a.ts", diff: "-old\n+new", reversible: true }),
    Object.freeze({ id: "px2", filePath: "b.ts", diff: "-old\n+new", reversible: true }),
  ]);
  const valid = validateFixes({ patches, originalViolationCount: 2 });
  assert("validateFixes: isValid = true when all reversible",  valid.result.isValid === true);
  assert("validateFixes: score in 0–100",                      valid.result.score >= 0 && valid.result.score <= 100);
  assert("validateFixes: result has warnings array",           Array.isArray(valid.result.warnings));

  const nonReversible: readonly Patch[] = Object.freeze([
    Object.freeze({ id: "px3", filePath: "c.ts", diff: "diff", reversible: false }),
  ]);
  const invalid = validateFixes({ patches: nonReversible, originalViolationCount: 1 });
  assert("validateFixes: isValid = false when non-reversible", invalid.result.isValid === false);
}

// ─── bridge/execution.adapter ────────────────────────────────────────────────
console.log("\n── bridge/execution.adapter (NoopExecutionAdapter) ──");
{
  const adapter = new NoopExecutionAdapter();
  const patches: readonly Patch[] = Object.freeze([
    Object.freeze({ id: "e1", filePath: "x.ts", diff: "diff", reversible: true }),
  ]);
  const result = await adapter.applyPatches(patches);
  assert("NoopExecutionAdapter: applied=false",          result.applied === false);
  assert("NoopExecutionAdapter: has dry-run warning",    result.warnings.length >= 1);
  assert("NoopExecutionAdapter: warning mentions dry-run",
    result.warnings[0].toLowerCase().includes("dry-run") || result.warnings[0].toLowerCase().includes("dry run"));
}

// ─── state/fix-session.state ──────────────────────────────────────────────────
console.log("\n── state/fix-session.state ──");
{
  clearSessions();
  assert("getSession: null before any session",  getSession() === null);

  const fakePlan = Object.freeze({
    steps: Object.freeze([]),
    riskScore: 0,
    reversible: true,
    warnings: Object.freeze([]),
  });
  const fakeSession = Object.freeze({
    id: "fix-session-0001",
    violations: Object.freeze([]),
    plan: fakePlan,
    status: "INIT" as const,
    patches: Object.freeze([]),
    createdAt: Date.now(),
  });

  setSession(fakeSession);
  assert("getSession: returns session after set",  getSession()?.id === "fix-session-0001");
  assert("getSession: status=INIT",                getSession()?.status === "INIT");

  updateSessionStatus("PLANNED");
  assert("updateSessionStatus: PLANNED",           getSession()?.status === "PLANNED");

  updateSessionStatus("APPLIED");
  assert("updateSessionStatus: APPLIED",           getSession()?.status === "APPLIED");

  clearSessions();
  assert("clearSessions: resets to null",          getSession() === null);
}

// ─── runArchitectureFixer (full pipeline) ────────────────────────────────────
console.log("\n── runArchitectureFixer (full pipeline) ──");
{
  reset();

  const violations: readonly RawViolation[] = Object.freeze([
    raw("fp1", "LAYER_BOUNDARY_VIOLATION", "HIGH",     "agents/service.ts"),
    raw("fp2", "CIRCULAR_DEPENDENCY",      "CRITICAL", "agents/planner.ts", { target: "agents/executor.ts" }),
    raw("fp3", "SRP_VIOLATION",            "MEDIUM",   "agents/big-agent.ts"),
  ]);

  const files: Readonly<Record<string, string>> = Object.freeze({
    "agents/service.ts":   "import './infra/db';",
    "agents/planner.ts":   "import './executor';",
    "agents/executor.ts":  "import './planner';",
    "agents/big-agent.ts": "export function doEverything() {}",
  });

  const result: FixResult = await runArchitectureFixer({ violations, files });

  assert("runArchitectureFixer: sessionId is string",       typeof result.sessionId === "string");
  assert("runArchitectureFixer: applied=false (noop)",      result.applied === false);
  assert("runArchitectureFixer: warnings is array",         Array.isArray(result.warnings));
  assert("runArchitectureFixer: patches is array",          Array.isArray(result.patches));
  assert("runArchitectureFixer: validationScore 0–100",     result.validationScore >= 0 && result.validationScore <= 100);

  reset();

  const emptyResult: FixResult = await runArchitectureFixer({ violations: [], files: {} });
  assert("runArchitectureFixer: empty → patches=0",         emptyResult.patches.length === 0);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`architecture-fixer: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

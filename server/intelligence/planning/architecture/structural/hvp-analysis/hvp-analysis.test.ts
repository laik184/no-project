import {
  analyzeHVP, analyzeMultiple, getLastReport,
  getReportHistory, resetAnalyzer,
} from "./index.js";
import type { ProjectStructure, FileNode, LayerDefinition } from "./index.js";
import { HVP_DEFAULT_LAYERS } from "./index.js";
import { clearAll } from "./state.js";

import {
  resetLayerStructureCounter,
  validateLayerStructure,
} from "./validators/layer-structure.validator.js";
import {
  resetImportDirectionCounter,
  validateImportDirection,
} from "./validators/import-direction.validator.js";
import {
  resetCrossLayerCounter,
  validateCrossLayerImports,
} from "./validators/cross-layer.validator.js";
import {
  resetOrchestratorCounter,
  validateOrchestratorRules,
} from "./validators/orchestrator-rule.validator.js";
import {
  resetStateIsolationCounter,
  validateStateIsolation,
} from "./validators/state-isolation.validator.js";

import { buildLayerMap, buildLayerLookup, getAllowedTargetLevels }
  from "./utils/layer-map.builder.util.js";
import {
  buildImportGraph, detectCycles, filterViolatingEdges,
} from "./utils/import-graph.builder.util.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function resetCounters(): void {
  resetLayerStructureCounter();
  resetImportDirectionCounter();
  resetCrossLayerCounter();
  resetOrchestratorCounter();
  resetStateIsolationCounter();
}

function before(): void { clearAll(); resetAnalyzer(); resetCounters(); }

const DEFS = HVP_DEFAULT_LAYERS;

function makeFile(
  path:      string,
  role:      FileNode["role"],
  layer:     number,
  imports:   string[] = [],
  lineCount: number   = 50,
): FileNode {
  return Object.freeze({
    path, role, layer, lineCount,
    imports:  Object.freeze(imports),
    exports:  Object.freeze([]),
  });
}

const COMPLIANT_FILES: readonly FileNode[] = Object.freeze([
  makeFile("orch.ts",    "orchestrator", 1, ["validator.ts", "state.ts"]),
  makeFile("validator.ts", "validator",  2, ["utils.ts", "types.ts"]),
  makeFile("state.ts",   "state",        3, ["types.ts"]),
  makeFile("utils.ts",   "util",         3, []),
  makeFile("types.ts",   "type",         3, []),
]);

const COMPLIANT_PROJECT: ProjectStructure = Object.freeze({
  projectId:        "test-project",
  files:            COMPLIANT_FILES,
  layerDefinitions: DEFS,
});

before();

// ─── utils/layer-map.builder ─────────────────────────────────────────────────
console.log("\n── utils/layer-map.builder ──");
{
  const map = buildLayerMap(COMPLIANT_FILES);
  assert("layerMap: frozen",                   Object.isFrozen(map));
  assert("layerMap: definedLevels=[1,2,3]",    JSON.stringify([...map.definedLevels]) === "[1,2,3]");
  assert("layerMap: byLevel[1] has 1 file",    map.byLevel[1]?.length === 1);
  assert("layerMap: byLevel[2] has 1 file",    map.byLevel[2]?.length === 1);
  assert("layerMap: byLevel[3] has 3 files",   map.byLevel[3]?.length === 3);
  assert("layerMap: byPath has orch.ts",       "orch.ts" in map.byPath);
  assert("layerMap: byRole.orchestrator len=1", map.byRole.orchestrator?.length === 1);
  assert("layerMap: byRole.validator len=1",    map.byRole.validator?.length === 1);

  const empty = buildLayerMap([]);
  assert("layerMap: empty → definedLevels=[]", empty.definedLevels.length === 0);
  assert("layerMap: empty frozen",             Object.isFrozen(empty));

  const lookup = buildLayerLookup(COMPLIANT_FILES);
  assert("lookup: frozen",                     Object.isFrozen(lookup));
  assert("lookup: levelByPath[orch.ts]=1",     lookup.levelByPath["orch.ts"] === 1);
  assert("lookup: roleByPath[state.ts]=state", lookup.roleByPath["state.ts"] === "state");

  const allowed = getAllowedTargetLevels(1, DEFS);
  assert("allowedLevels: l1 may import [2,3]", allowed.includes(2) && allowed.includes(3));
  const l3Allowed = getAllowedTargetLevels(3, DEFS);
  assert("allowedLevels: l3 may import []",    l3Allowed.length === 0);
}

// ─── utils/import-graph.builder ──────────────────────────────────────────────
console.log("\n── utils/import-graph.builder ──");
{
  const graph = buildImportGraph(COMPLIANT_FILES, DEFS);
  assert("graph: frozen",                      Object.isFrozen(graph));
  assert("graph: edges frozen",                Object.isFrozen(graph.edges));
  assert("graph: nodeCount=5",                 graph.nodeCount === 5);
  assert("graph: edgeCount > 0",              graph.edgeCount > 0);

  const orchEdges = graph.edges.filter((e) => e.from === "orch.ts");
  assert("graph: orch has 2 edges",            orchEdges.length === 2);
  assert("graph: orch→validator allowed",
    orchEdges.find((e) => e.to === "validator.ts")?.allowed === true);
  assert("graph: orch→state allowed",
    orchEdges.find((e) => e.to === "state.ts")?.allowed === true);

  const empty = buildImportGraph([], DEFS);
  assert("graph: empty → edgeCount=0",        empty.edgeCount === 0);
  assert("graph: empty → nodeCount=0",        empty.nodeCount === 0);

  const bad = filterViolatingEdges(graph.edges);
  assert("graph: compliant → 0 violations",   bad.length === 0);

  const cycleFiles: readonly FileNode[] = [
    makeFile("a.ts", "validator", 2, ["b.ts"]),
    makeFile("b.ts", "validator", 2, ["a.ts"]),
    makeFile("types.ts", "type",  3, []),
  ];
  const cycleGraph = buildImportGraph(cycleFiles, DEFS);
  const cycles = detectCycles(cycleGraph.edges);
  assert("graph: cycle detected",             cycles.length > 0);
  assert("graph: cycle frozen",              Object.isFrozen(cycles));
}

// ─── validators/layer-structure ──────────────────────────────────────────────
console.log("\n── validators/layer-structure ──");
{
  resetCounters();

  const r1 = validateLayerStructure(COMPLIANT_FILES, DEFS);
  assert("layerStruct: compliant → 0 violations", r1.violations.length === 0);
  assert("layerStruct: result frozen",             Object.isFrozen(r1));
  assert("layerStruct: checkedFiles=5",            r1.checkedFiles === 5);

  const missingLayer: readonly FileNode[] = [
    makeFile("orch.ts",  "orchestrator", 1, []),
    makeFile("types.ts", "type",         3, []),
  ];
  const r2 = validateLayerStructure(missingLayer, DEFS);
  assert("layerStruct: missing layer 2 → violation", r2.violations.length > 0);
  assert("layerStruct: MISSING_REQUIRED_LAYER type",
    r2.violations.some((v) => v.type === "MISSING_REQUIRED_LAYER"));

  const wrongRole: readonly FileNode[] = [
    ...COMPLIANT_FILES,
    makeFile("extra.ts", "util", 1, []),
  ];
  const r3 = validateLayerStructure(wrongRole, DEFS);
  assert("layerStruct: util in layer 1 → violation",
    r3.violations.some((v) => v.type === "LAYER_STRUCTURE_INVALID"));

  const r4 = validateLayerStructure([], DEFS);
  assert("layerStruct: empty files → 0 violations", r4.violations.length === 0);
  assert("layerStruct: empty → checkedFiles=0",     r4.checkedFiles === 0);
}

// ─── validators/import-direction ─────────────────────────────────────────────
console.log("\n── validators/import-direction ──");
{
  resetCounters();

  const r1 = validateImportDirection(COMPLIANT_FILES, DEFS);
  assert("importDir: compliant → 0 violations", r1.violations.length === 0);
  assert("importDir: result frozen",            Object.isFrozen(r1));

  const reversed: readonly FileNode[] = [
    makeFile("orch.ts",    "orchestrator", 1, ["validator.ts", "state.ts"]),
    makeFile("validator.ts", "validator",  2, ["orch.ts"]),
    makeFile("state.ts",   "state",        3, ["types.ts"]),
    makeFile("utils.ts",   "util",         3, []),
    makeFile("types.ts",   "type",         3, []),
  ];
  const r2 = validateImportDirection(reversed, DEFS);
  assert("importDir: reversed import → violation",  r2.violations.length > 0);
  assert("importDir: IMPORT_DIRECTION_REVERSED",
    r2.violations.some((v) => v.type === "IMPORT_DIRECTION_REVERSED"));
  assert("importDir: violation frozen",             Object.isFrozen(r2.violations[0]));
  assert("importDir: evidence frozen",              Object.isFrozen(r2.violations[0]?.evidence));

  const r3 = validateImportDirection([], DEFS);
  assert("importDir: empty → 0 violations",         r3.violations.length === 0);
}

// ─── validators/cross-layer ───────────────────────────────────────────────────
console.log("\n── validators/cross-layer ──");
{
  resetCounters();

  const r1 = validateCrossLayerImports(COMPLIANT_FILES, DEFS);
  assert("crossLayer: compliant → 0 violations", r1.violations.length === 0);
  assert("crossLayer: result frozen",             Object.isFrozen(r1));

  const valImportsVal: readonly FileNode[] = [
    makeFile("orch.ts",  "orchestrator", 1, ["v1.ts", "v2.ts", "state.ts"]),
    makeFile("v1.ts",    "validator",    2, ["v2.ts"]),
    makeFile("v2.ts",    "validator",    2, []),
    makeFile("state.ts", "state",        3, ["types.ts"]),
    makeFile("types.ts", "type",         3, []),
  ];
  const r2 = validateCrossLayerImports(valImportsVal, DEFS);
  assert("crossLayer: validator→validator → violation",
    r2.violations.some((v) => v.type === "VALIDATOR_IMPORTS_VALIDATOR"));
  assert("crossLayer: severity=CRITICAL",
    r2.violations.some((v) => v.severity === "CRITICAL"));

  const stateImportsUtil: readonly FileNode[] = [
    makeFile("orch.ts",  "orchestrator", 1, ["state.ts"]),
    makeFile("state.ts", "state",        3, ["utils.ts", "types.ts"]),
    makeFile("utils.ts", "util",         3, []),
    makeFile("types.ts", "type",         3, []),
  ];
  const r3 = validateCrossLayerImports(stateImportsUtil, DEFS);
  assert("crossLayer: state→util → violation",
    r3.violations.some((v) => v.type === "STATE_IMPORTS_UTIL"));

  const utilImportsValidator: readonly FileNode[] = [
    makeFile("orch.ts",  "orchestrator", 1, ["validator.ts"]),
    makeFile("validator.ts", "validator", 2, []),
    makeFile("utils.ts", "util",         3, ["validator.ts"]),
    makeFile("types.ts", "type",         3, []),
  ];
  const r4 = validateCrossLayerImports(utilImportsValidator, DEFS);
  assert("crossLayer: util→validator → violation",
    r4.violations.some((v) => v.type === "UTIL_IMPORTS_VALIDATOR"));
}

// ─── validators/orchestrator-rule ────────────────────────────────────────────
console.log("\n── validators/orchestrator-rule ──");
{
  resetCounters();

  const r1 = validateOrchestratorRules(COMPLIANT_FILES, DEFS);
  assert("orchRule: compliant → 0 violations", r1.violations.length === 0);
  assert("orchRule: result frozen",            Object.isFrozen(r1));

  const agentImportsOrch: readonly FileNode[] = [
    makeFile("orch.ts",      "orchestrator", 1, ["validator.ts"]),
    makeFile("validator.ts", "validator",    2, ["orch.ts"]),
    makeFile("state.ts",     "state",        3, ["types.ts"]),
    makeFile("types.ts",     "type",         3, []),
  ];
  const r2 = validateOrchestratorRules(agentImportsOrch, DEFS);
  assert("orchRule: validator→orch → bypass violation",
    r2.violations.some((v) => v.type === "ORCHESTRATOR_BYPASS"));
  assert("orchRule: bypass is CRITICAL",
    r2.violations.some((v) => v.severity === "CRITICAL" && v.type === "ORCHESTRATOR_BYPASS"));

  const agentImportsAgent: readonly FileNode[] = [
    makeFile("orch.ts",  "orchestrator", 1, ["a.ts", "b.ts"]),
    makeFile("a.ts",     "agent",        2, ["b.ts"]),
    makeFile("b.ts",     "agent",        2, []),
    makeFile("types.ts", "type",         3, []),
  ];
  const r3 = validateOrchestratorRules(agentImportsAgent, DEFS);
  assert("orchRule: agent→agent → bypass violation",
    r3.violations.some((v) => v.type === "ORCHESTRATOR_BYPASS"));
  assert("orchRule: agent→agent is HIGH",
    r3.violations.some((v) => v.severity === "HIGH" && v.type === "ORCHESTRATOR_BYPASS"));
}

// ─── validators/state-isolation ──────────────────────────────────────────────
console.log("\n── validators/state-isolation ──");
{
  resetCounters();

  const r1 = validateStateIsolation(COMPLIANT_FILES, DEFS);
  assert("stateIso: compliant → 0 violations", r1.violations.length === 0);
  assert("stateIso: result frozen",            Object.isFrozen(r1));

  const validatorAccessesState: readonly FileNode[] = [
    makeFile("orch.ts",      "orchestrator", 1, ["validator.ts", "state.ts"]),
    makeFile("validator.ts", "validator",    2, ["state.ts"]),
    makeFile("state.ts",     "state",        3, ["types.ts"]),
    makeFile("types.ts",     "type",         3, []),
  ];
  const r2 = validateStateIsolation(validatorAccessesState, DEFS);
  assert("stateIso: validator→state → violation",
    r2.violations.some((v) => v.type === "STATE_MUTATION_OUTSIDE_ORCHESTRATOR"));
  assert("stateIso: severity=CRITICAL",
    r2.violations.some((v) => v.severity === "CRITICAL"));

  const stateImportsValidator: readonly FileNode[] = [
    makeFile("orch.ts",      "orchestrator", 1, ["state.ts"]),
    makeFile("state.ts",     "state",        3, ["validator.ts", "types.ts"]),
    makeFile("validator.ts", "validator",    2, []),
    makeFile("types.ts",     "type",         3, []),
  ];
  const r3 = validateStateIsolation(stateImportsValidator, DEFS);
  assert("stateIso: state→validator import → violation",
    r3.violations.some((v) => v.type === "STATE_IMPORTS_VALIDATOR"));
}

// ─── orchestrator (full integration) ─────────────────────────────────────────
console.log("\n── orchestrator (full integration) ──");
{
  before();

  const report = analyzeHVP(COMPLIANT_PROJECT);
  assert("orch: report frozen",              Object.isFrozen(report));
  assert("orch: violations frozen",          Object.isFrozen(report.violations));
  assert("orch: layerReports frozen",        Object.isFrozen(report.layerReports));
  assert("orch: isCompliant=true",           report.isCompliant === true);
  assert("orch: complianceScore=100",        report.complianceScore === 100);
  assert("orch: totalFiles=5",               report.totalFiles === 5);
  assert("orch: totalViolations=0",          report.totalViolations === 0);
  assert("orch: reportId set",               report.reportId.startsWith("hvp-"));
  assert("orch: analyzedAt > 0",             report.analyzedAt > 0);
  assert("orch: summary mentions compliant", report.summary.includes("compliant"));
  assert("orch: layerReports.length=3",      report.layerReports.length === 3);
  assert("orch: each layerReport frozen",    report.layerReports.every((lr) => Object.isFrozen(lr)));
  assert("orch: criticalCount=0",            report.criticalCount === 0);
}

// ─── integration: violation project ──────────────────────────────────────────
console.log("\n── integration: violation project ──");
{
  before();

  const violatingProject: ProjectStructure = Object.freeze({
    projectId: "bad-project",
    files: Object.freeze([
      makeFile("orch.ts",      "orchestrator", 1, ["v1.ts", "state.ts"]),
      makeFile("v1.ts",        "validator",    2, ["v2.ts", "state.ts"]),
      makeFile("v2.ts",        "validator",    2, ["v1.ts"]),
      makeFile("state.ts",     "state",        3, ["utils.ts", "types.ts"]),
      makeFile("utils.ts",     "util",         3, ["v1.ts"]),
      makeFile("types.ts",     "type",         3, []),
    ]),
    layerDefinitions: DEFS,
  });

  const report = analyzeHVP(violatingProject);
  assert("violation: not compliant",          report.isCompliant === false);
  assert("violation: score < 100",            report.complianceScore < 100);
  assert("violation: violations > 0",         report.totalViolations > 0);
  assert("violation: has CRITICAL",           report.criticalCount > 0);
  assert("violation: frozen",                 Object.isFrozen(report));
  assert("violation: validator→validator",
    report.violations.some((v) => v.type === "VALIDATOR_IMPORTS_VALIDATOR"));
  assert("violation: state→util",
    report.violations.some((v) => v.type === "STATE_IMPORTS_UTIL"));
  assert("violation: validator→state",
    report.violations.some((v) => v.type === "STATE_MUTATION_OUTSIDE_ORCHESTRATOR"));
  assert("violation: summary mentions violations", report.summary.includes("violation"));
}

// ─── invalid input ────────────────────────────────────────────────────────────
console.log("\n── invalid input ──");
{
  before();

  const r1 = analyzeHVP(null as any);
  assert("invalid: null → frozen",           Object.isFrozen(r1));
  assert("invalid: null → isCompliant=false", r1.isCompliant === false);
  assert("invalid: null → score=0",          r1.complianceScore === 0);
  assert("invalid: null → summary set",      r1.summary.length > 0);

  const r2 = analyzeHVP({ projectId: "", files: [], layerDefinitions: DEFS });
  assert("invalid: empty files → frozen",    Object.isFrozen(r2));
  assert("invalid: empty files → 0 violations", r2.totalViolations === 0);
  assert("invalid: empty files → score=100",  r2.complianceScore === 100);
}

// ─── analyzeMultiple ──────────────────────────────────────────────────────────
console.log("\n── analyzeMultiple ──");
{
  before();

  const projects = [COMPLIANT_PROJECT, COMPLIANT_PROJECT];
  const reports  = analyzeMultiple(projects);
  assert("batch: frozen",                    Object.isFrozen(reports));
  assert("batch: length=2",                  reports.length === 2);
  assert("batch: each frozen",               reports.every((r) => Object.isFrozen(r)));
  assert("batch: each compliant",            reports.every((r) => r.isCompliant));

  const empty = analyzeMultiple([]);
  assert("batch: empty → []",               empty.length === 0);
  assert("batch: null → []",               analyzeMultiple(null as any).length === 0);
}

// ─── getLastReport + getReportHistory ────────────────────────────────────────
console.log("\n── state: getLastReport + history ──");
{
  before();

  const last = getLastReport();
  assert("state: no report → null",          last === null);

  analyzeHVP(COMPLIANT_PROJECT);
  const report = getLastReport();
  assert("state: lastReport set",            report !== null);
  assert("state: lastReport frozen",         Object.isFrozen(report));
  assert("state: lastReport isCompliant",    report?.isCompliant === true);

  analyzeHVP(COMPLIANT_PROJECT);
  analyzeHVP(COMPLIANT_PROJECT);
  const history = getReportHistory();
  assert("state: history frozen",            Object.isFrozen(history));
  assert("state: history length ≥ 3",       history.length >= 3);
}

// ─── determinism ──────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  before();
  const r1 = analyzeHVP(COMPLIANT_PROJECT);
  before();
  const r2 = analyzeHVP(COMPLIANT_PROJECT);

  assert("det: same isCompliant",            r1.isCompliant     === r2.isCompliant);
  assert("det: same score",                  r1.complianceScore === r2.complianceScore);
  assert("det: same totalFiles",             r1.totalFiles      === r2.totalFiles);
  assert("det: same violations count",       r1.totalViolations === r2.totalViolations);
  assert("det: same layerReports count",     r1.layerReports.length === r2.layerReports.length);
}

// ─── scoring ──────────────────────────────────────────────────────────────────
console.log("\n── scoring ──");
{
  before();

  const oneViolationProject: ProjectStructure = Object.freeze({
    projectId: "one-viol",
    files: Object.freeze([
      makeFile("orch.ts",  "orchestrator", 1, ["v1.ts", "state.ts"]),
      makeFile("v1.ts",    "validator",    2, ["v2.ts"]),
      makeFile("v2.ts",    "validator",    2, []),
      makeFile("state.ts", "state",        3, ["types.ts"]),
      makeFile("types.ts", "type",         3, []),
    ]),
    layerDefinitions: DEFS,
  });
  const r = analyzeHVP(oneViolationProject);
  assert("score: VALIDATOR_IMPORTS_VALIDATOR deducts 25", r.complianceScore === 60);
  assert("score: criticalCount=1",                        r.criticalCount === 1);
  assert("score: totalViolations=2",                      r.totalViolations === 2);

  const maxViolation: ProjectStructure = Object.freeze({
    projectId: "max-viol",
    files: Object.freeze([
      makeFile("orch.ts",  "orchestrator", 1, ["a.ts", "state.ts"]),
      makeFile("a.ts",     "validator",    2, ["b.ts", "state.ts"]),
      makeFile("b.ts",     "validator",    2, ["a.ts"]),
      makeFile("state.ts", "state",        3, ["types.ts"]),
      makeFile("types.ts", "type",         3, []),
    ]),
    layerDefinitions: DEFS,
  });
  const r2 = analyzeHVP(maxViolation);
  assert("score: 0 floor",                               r2.complianceScore >= 0);
  assert("score: multiple violations reduce score",      r2.complianceScore < 75);
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

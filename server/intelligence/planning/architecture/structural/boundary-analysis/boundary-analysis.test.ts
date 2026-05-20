import {
  analyzeBoundaries, analyzeMultiple,
  getLastReport, getReportHistory, resetAnalyzer,
} from "./index.js";
import type { ArchitectureGraph, ArchNode, ArchEdge } from "./index.js";
import { clearAll, getSession } from "./state.js";

import {
  buildNodeIndex, resolveEdgeNodes, edgesFrom, edgesTo,
  nodesByLayer, nodesByDomain, detectCycles, isValidGraph,
} from "./utils/graph.util.js";
import {
  checkLayerDirection, checkDependencyDirection,
  checkDomainLeakage, checkInfrastructureLeakage,
} from "./utils/rule.engine.util.js";
import {
  validateLayerBoundaries,
  resetLayerValidatorCounter,
  upwardImports,
  layerBoundaryViolations,
} from "./agents/layer-boundary.validator.agent.js";
import {
  validateDependencyDirections,
  resetDirectionValidatorCounter,
  illegalDirectionCount,
  circularDependencyCount,
} from "./agents/dependency-direction.validator.agent.js";
import {
  detectDomainLeakage,
  resetDomainLeakageCounter,
  crossDomainViolations,
  infrastructureLeakageViolations,
} from "./agents/domain-leakage.detector.agent.js";
import {
  compileReport,
  violationsByDomain,
  criticalViolations,
  sortedByScore,
} from "./agents/violation-reporter.agent.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void {
  clearAll();
  resetAnalyzer();
  resetLayerValidatorCounter();
  resetDirectionValidatorCounter();
  resetDomainLeakageCounter();
}

function node(
  id: string, path: string,
  layer: ArchNode["layer"],
  domain: string,
  role: ArchNode["role"],
): ArchNode {
  return Object.freeze({ id, path, layer, domain, role });
}

function edge(from: string, to: string, importType: ArchEdge["importType"] = "direct"): ArchEdge {
  return Object.freeze({ from, to, importType });
}

reset();

// ─── utils/graph.helper ───────────────────────────────────────────────────────
console.log("\n── utils/graph.helper ──");
{
  const nodes = [
    node("n1", "orch.ts",   1, "analysis", "orchestrator"),
    node("n2", "agent.ts",  2, "analysis", "agent"),
    node("n3", "util.ts",   3, "analysis", "util"),
    node("n4", "types.ts",  4, "analysis", "type"),
  ];
  const edges = [
    edge("n1", "n2"), edge("n2", "n3"), edge("n3", "n4"),
  ];

  const idx = buildNodeIndex(nodes);
  assert("nodeIndex: byId has n1",                  idx.byId.has("n1"));
  assert("nodeIndex: byPath has orch.ts",           idx.byPath.has("orch.ts"));

  const resolved = resolveEdgeNodes(edges[0]!, idx);
  assert("resolveEdge: from = orch.ts",             resolved?.from.path === "orch.ts");
  assert("resolveEdge: to = agent.ts",              resolved?.to.path   === "agent.ts");
  assert("resolveEdge: result frozen",              Object.isFrozen(resolved));

  const fromN1 = edgesFrom(edges, "n1");
  assert("edgesFrom: n1 has 1 edge",                fromN1.length === 1);
  assert("edgesFrom: frozen",                       Object.isFrozen(fromN1));

  const toN3 = edgesTo(edges, "n3");
  assert("edgesTo: n3 has 1 edge",                  toN3.length === 1);

  const layer1 = nodesByLayer(nodes, 1);
  assert("nodesByLayer: 1 node in layer 1",         layer1.length === 1);
  assert("nodesByLayer: frozen",                    Object.isFrozen(layer1));

  const analysis = nodesByDomain(nodes, "analysis");
  assert("nodesByDomain: 4 nodes in analysis",      analysis.length === 4);

  assert("isValidGraph: valid graph",               isValidGraph({ projectId: "x", nodes: [], edges: [] }));
  assert("isValidGraph: null → false",              !isValidGraph(null));
  assert("isValidGraph: missing nodes → false",     !isValidGraph({ projectId: "x" }));

  const noCycle = detectCycles(nodes, edges);
  assert("detectCycles: no cycle → []",             noCycle.length === 0);

  const cycleNodes  = [node("a", "a.ts", 2, "d", "agent"), node("b", "b.ts", 2, "d", "agent")];
  const cycleEdges  = [edge("a", "b"), edge("b", "a")];
  const cycles      = detectCycles(cycleNodes, cycleEdges);
  assert("detectCycles: cycle detected",            cycles.length > 0);
  assert("detectCycles: result frozen",             Object.isFrozen(cycles));

  const noResolved = resolveEdgeNodes(edge("x", "y"), idx);
  assert("resolveEdge: unknown nodes → null",       noResolved === null);
}

// ─── utils/rule.engine ───────────────────────────────────────────────────────
console.log("\n── utils/rule.engine ──");
{
  const upward = checkLayerDirection(2, 1, "agent.ts", "orch.ts");
  assert("ruleEngine: L2→L1 = UPWARD_IMPORT",       upward.violated === true);
  assert("ruleEngine: L2→L1 = CRITICAL",            upward.severity === "CRITICAL");
  assert("ruleEngine: upward type set",             upward.type === "UPWARD_IMPORT");
  assert("ruleEngine: rule is frozen",              Object.isFrozen(upward));

  const allowed = checkLayerDirection(1, 2, "orch.ts", "agent.ts");
  assert("ruleEngine: L1→L2 = not violated",        allowed.violated === false);

  const lateral = checkLayerDirection(2, 1, "agent.ts", "orch.ts");
  assert("ruleEngine: lateral = violated",          lateral.violated === true);

  const l3l2 = checkLayerDirection(3, 2, "util.ts", "agent.ts");
  assert("ruleEngine: L3→L2 = UPWARD_IMPORT",       l3l2.violated && l3l2.type === "UPWARD_IMPORT");

  const illegalDir = checkDependencyDirection("util", "agent", "util.ts", "agent.ts");
  assert("ruleEngine: util→agent = violated",       illegalDir.violated === true);
  assert("ruleEngine: util→agent = MEDIUM",         illegalDir.severity === "MEDIUM");

  const stateToOrch = checkDependencyDirection("state", "orchestrator", "s.ts", "o.ts");
  assert("ruleEngine: state→orch = violated",       stateToOrch.violated === true);

  const agentToUtil = checkDependencyDirection("agent", "util", "a.ts", "u.ts");
  assert("ruleEngine: agent→util = not violated",   agentToUtil.violated === false);

  const typeToAgent = checkDependencyDirection("type", "agent", "t.ts", "a.ts");
  assert("ruleEngine: type→agent = HIGH",           typeToAgent.violated && typeToAgent.severity === "HIGH");

  const crossDomain = checkDomainLeakage("planning", "runtime", "plan.ts", "run.ts");
  assert("ruleEngine: planning→runtime = CRITICAL", crossDomain.violated && crossDomain.severity === "CRITICAL");
  assert("ruleEngine: cross-domain type set",       crossDomain.type === "CROSS_DOMAIN_LEAKAGE");

  const okDomain = checkDomainLeakage("analysis", "analysis", "a.ts", "b.ts");
  assert("ruleEngine: same domain = not violated",  okDomain.violated === false);

  const infraLeak = checkInfrastructureLeakage("runtime", "planning", "r.ts", "p.ts");
  assert("ruleEngine: runtime→planning = HIGH",     infraLeak.violated && infraLeak.severity === "HIGH");

  const noInfraLeak = checkInfrastructureLeakage("analysis", "planning", "a.ts", "p.ts");
  assert("ruleEngine: analysis→planning = not infra leak", noInfraLeak.violated === false);
}

// ─── layer-boundary.validator ────────────────────────────────────────────────
console.log("\n── layer-boundary.validator.agent ──");
{
  reset();

  const goodGraph: ArchitectureGraph = {
    projectId: "good",
    nodes: [
      node("n1", "orch.ts",  1, "a", "orchestrator"),
      node("n2", "agent.ts", 2, "a", "agent"),
      node("n3", "util.ts",  3, "a", "util"),
    ],
    edges: [edge("n1", "n2"), edge("n2", "n3")],
  };
  const goodResult = validateLayerBoundaries(goodGraph);
  assert("layerVal: compliant → 0 violations",      goodResult.violations.length === 0);
  assert("layerVal: checkedEdges=2",                goodResult.checkedEdges === 2);
  assert("layerVal: result frozen",                 Object.isFrozen(goodResult));
  assert("layerVal: violations frozen",             Object.isFrozen(goodResult.violations));

  const badGraph: ArchitectureGraph = {
    projectId: "bad",
    nodes: [
      node("n1", "orch.ts",  1, "a", "orchestrator"),
      node("n2", "agent.ts", 2, "a", "agent"),
    ],
    edges: [edge("n2", "n1")],
  };
  const badResult = validateLayerBoundaries(badGraph);
  assert("layerVal: upward import detected",        badResult.violations.length > 0);
  assert("layerVal: UPWARD_IMPORT type",            badResult.violations[0]?.type === "UPWARD_IMPORT");
  assert("layerVal: CRITICAL severity",             badResult.violations[0]?.severity === "CRITICAL");
  assert("layerVal: violation frozen",              Object.isFrozen(badResult.violations[0]));

  const ups = upwardImports(badResult);
  assert("upwardImports: length=1",                 ups.length === 1);
  assert("upwardImports: frozen",                   Object.isFrozen(ups));

  const lbv = layerBoundaryViolations(goodResult);
  assert("layerBoundaryViolations: empty",          lbv.length === 0);

  const emptyGraph: ArchitectureGraph = { projectId: "e", nodes: [], edges: [] };
  const emptyResult = validateLayerBoundaries(emptyGraph);
  assert("layerVal: empty graph → 0 violations",   emptyResult.violations.length === 0);
}

// ─── dependency-direction.validator ──────────────────────────────────────────
console.log("\n── dependency-direction.validator.agent ──");
{
  reset();

  const cleanGraph: ArchitectureGraph = {
    projectId: "clean",
    nodes: [
      node("n1", "orch.ts",  1, "a", "orchestrator"),
      node("n2", "agent.ts", 2, "a", "agent"),
      node("n3", "util.ts",  3, "a", "util"),
    ],
    edges: [edge("n1", "n2"), edge("n2", "n3")],
  };
  const cleanResult = validateDependencyDirections(cleanGraph);
  assert("dirVal: clean → 0 violations",            cleanResult.violations.length === 0);
  assert("dirVal: frozen",                          Object.isFrozen(cleanResult));

  const illegalGraph: ArchitectureGraph = {
    projectId: "illegal",
    nodes: [
      node("u", "util.ts",  3, "a", "util"),
      node("ag", "agent.ts", 2, "a", "agent"),
      node("st", "state.ts", 3, "a", "state"),
      node("or", "orch.ts",  1, "a", "orchestrator"),
    ],
    edges: [edge("u", "ag"), edge("st", "or")],
  };
  const illResult = validateDependencyDirections(illegalGraph);
  assert("dirVal: illegal direction detected",      illResult.violations.some((v) => v.type === "ILLEGAL_DEPENDENCY_DIRECTION"));
  assert("dirVal: each violation frozen",           illResult.violations.every((v) => Object.isFrozen(v)));
  assert("illegalDirCount: > 0",                   illegalDirectionCount(illResult) > 0);

  const cycleGraph: ArchitectureGraph = {
    projectId: "cycle",
    nodes: [
      node("a", "a.ts", 2, "d", "agent"),
      node("b", "b.ts", 2, "d", "agent"),
    ],
    edges: [edge("a", "b"), edge("b", "a")],
  };
  const cycleResult = validateDependencyDirections(cycleGraph);
  assert("dirVal: cycle detected",                  cycleResult.violations.some((v) => v.type === "CIRCULAR_DEPENDENCY"));
  assert("circularCount: > 0",                     circularDependencyCount(cycleResult) > 0);

  const emptyResult = validateDependencyDirections({ projectId: "e", nodes: [], edges: [] });
  assert("dirVal: empty → 0 violations",            emptyResult.violations.length === 0);
}

// ─── domain-leakage.detector ─────────────────────────────────────────────────
console.log("\n── domain-leakage.detector.agent ──");
{
  reset();

  const cleanDomainGraph: ArchitectureGraph = {
    projectId: "clean-domain",
    nodes: [
      node("p1", "plan.agent.ts", 2, "planning", "agent"),
      node("p2", "plan.util.ts",  3, "planning", "util"),
    ],
    edges: [edge("p1", "p2")],
  };
  const cleanResult = detectDomainLeakage(cleanDomainGraph);
  assert("domainLeak: same domain → 0 violations",  cleanResult.violations.length === 0);
  assert("domainLeak: frozen",                      Object.isFrozen(cleanResult));

  const leakGraph: ArchitectureGraph = {
    projectId: "leaking",
    nodes: [
      node("pl", "planner.ts",  2, "planning",  "agent"),
      node("rt", "runtime.ts",  2, "runtime",   "agent"),
      node("st", "stability.ts",2, "stability", "agent"),
      node("an", "analysis.ts", 2, "analysis",  "agent"),
    ],
    edges: [
      edge("pl", "rt"),
      edge("st", "an"),
    ],
  };
  const leakResult = detectDomainLeakage(leakGraph);
  assert("domainLeak: planning→runtime = CRITICAL",
    leakResult.violations.some((v) => v.type === "CROSS_DOMAIN_LEAKAGE" && v.severity === "CRITICAL"));
  assert("domainLeak: violations frozen",           Object.isFrozen(leakResult.violations));
  assert("domainLeak: each frozen",                 leakResult.violations.every((v) => Object.isFrozen(v)));

  const crossV = crossDomainViolations(leakResult);
  assert("crossDomainViolations: non-empty",        crossV.length > 0);
  assert("crossDomainViolations: frozen",           Object.isFrozen(crossV));

  const infraGraph: ArchitectureGraph = {
    projectId: "infra-leak",
    nodes: [
      node("r", "runtime.ts",  2, "runtime",  "agent"),
      node("b", "business.ts", 2, "business", "agent"),
    ],
    edges: [edge("r", "b")],
  };
  const infraResult = detectDomainLeakage(infraGraph);
  assert("domainLeak: runtime→business = INFRASTRUCTURE_LEAKAGE",
    infraResult.violations.some((v) => v.type === "INFRASTRUCTURE_LEAKAGE"));

  const infraV = infrastructureLeakageViolations(infraResult);
  assert("infraLeakageViolations: non-empty",       infraV.length > 0);
  assert("infraLeakageViolations: frozen",          Object.isFrozen(infraV));

  const emptyResult = detectDomainLeakage({ projectId: "e", nodes: [], edges: [] });
  assert("domainLeak: empty → 0 violations",        emptyResult.violations.length === 0);
}

// ─── violation-reporter ───────────────────────────────────────────────────────
console.log("\n── violation-reporter.agent ──");
{
  reset();

  const now = Date.now();
  const emptyReport = compileReport("r1", now, 5, 3, [], [], []);
  assert("reporter: no violations → score=100",     emptyReport.overallScore === 100);
  assert("reporter: no violations → isCompliant",   emptyReport.isCompliant === true);
  assert("reporter: frozen",                        Object.isFrozen(emptyReport));
  assert("reporter: violations frozen",             Object.isFrozen(emptyReport.violations));
  assert("reporter: summary mentions compliant",    emptyReport.summary.includes("compliant"));

  const fakeViolation = Object.freeze({
    id: "v1", type: "CROSS_DOMAIN_LEAKAGE" as const,
    severity: "CRITICAL" as const,
    from: "plan.ts", to: "run.ts", message: "test", rule: "test",
    layer: null, domain: "planning",
  });
  const violReport = compileReport("r2", now, 4, 2,
    [fakeViolation], [], [],
  );
  assert("reporter: CRITICAL → score=75",           violReport.overallScore === 75);
  assert("reporter: criticalCount=1",               violReport.criticalCount === 1);
  assert("reporter: isCompliant=false",             violReport.isCompliant === false);
  assert("reporter: totalViolations=1",             violReport.totalViolations === 1);

  const byDomain = violationsByDomain([fakeViolation], "planning");
  assert("violsByDomain: length=1",                 byDomain.length === 1);
  assert("violsByDomain: frozen",                   Object.isFrozen(byDomain));

  const crits = criticalViolations([fakeViolation]);
  assert("criticalViolations: length=1",            crits.length === 1);
  assert("criticalViolations: frozen",              Object.isFrozen(crits));

  const highViol = Object.freeze({
    ...fakeViolation, id: "v2", severity: "HIGH" as const,
  });
  const sorted = sortedByScore([highViol, fakeViolation]);
  assert("sortedByScore: CRITICAL first",           sorted[0]!.severity === "CRITICAL");
  assert("sortedByScore: frozen",                   Object.isFrozen(sorted));

  const zeroReport = compileReport("r0", now, 0, 0, [], [], []);
  assert("reporter: 0 nodes → empty summary",       zeroReport.summary.includes("No architecture"));
}

// ─── orchestrator: compliant graph ───────────────────────────────────────────
console.log("\n── orchestrator: compliant graph ──");
{
  reset();

  const graph: ArchitectureGraph = {
    projectId: "layered-service",
    nodes: [
      node("o",  "orch.ts",   1, "analysis", "orchestrator"),
      node("a1", "agent1.ts", 2, "analysis", "agent"),
      node("a2", "agent2.ts", 2, "analysis", "agent"),
      node("u",  "util.ts",   3, "analysis", "util"),
      node("t",  "types.ts",  4, "analysis", "type"),
    ],
    edges: [
      edge("o",  "a1"),
      edge("o",  "a2"),
      edge("a1", "u"),
      edge("a2", "u"),
      edge("u",  "t"),
    ],
  };

  const report = analyzeBoundaries(graph);
  assert("compliant: frozen",                       Object.isFrozen(report));
  assert("compliant: violations frozen",            Object.isFrozen(report.violations));
  assert("compliant: totalNodes=5",                 report.totalNodes === 5);
  assert("compliant: totalEdges=5",                 report.totalEdges === 5);
  assert("compliant: totalViolations=0",            report.totalViolations === 0);
  assert("compliant: overallScore=100",             report.overallScore === 100);
  assert("compliant: isCompliant=true",             report.isCompliant === true);
  assert("compliant: reportId set",                 report.reportId.startsWith("boundary-"));
  assert("compliant: analyzedAt > 0",               report.analyzedAt > 0);
  assert("compliant: summary mentions compliant",   report.summary.includes("compliant"));
  assert("compliant: criticalCount=0",              report.criticalCount === 0);
}

// ─── orchestrator: violation graph ───────────────────────────────────────────
console.log("\n── orchestrator: violation graph ──");
{
  reset();

  const graph: ArchitectureGraph = {
    projectId: "broken-service",
    nodes: [
      node("o",  "orch.ts",   1, "analysis",  "orchestrator"),
      node("ag", "agent.ts",  2, "analysis",  "agent"),
      node("ut", "util.ts",   3, "analysis",  "util"),
      node("pl", "plan.ts",   2, "planning",  "agent"),
      node("rt", "runtime.ts",2, "runtime",   "agent"),
    ],
    edges: [
      edge("ag", "o"),
      edge("ut", "ag"),
      edge("pl", "rt"),
    ],
  };

  const report = analyzeBoundaries(graph);
  assert("violation: totalViolations > 0",          report.totalViolations > 0);
  assert("violation: isCompliant=false",            report.isCompliant === false);
  assert("violation: overallScore < 100",           report.overallScore < 100);
  assert("violation: frozen",                       Object.isFrozen(report));
  assert("violation: UPWARD_IMPORT present",
    report.violations.some((v) => v.type === "UPWARD_IMPORT"));
  assert("violation: CROSS_DOMAIN_LEAKAGE present",
    report.violations.some((v) => v.type === "CROSS_DOMAIN_LEAKAGE"));
  assert("violation: summary mentions violation",   report.summary.includes("violation"));
}

// ─── orchestrator: circular dependency ───────────────────────────────────────
console.log("\n── orchestrator: circular dependency ──");
{
  reset();

  const graph: ArchitectureGraph = {
    projectId: "cyclic-service",
    nodes: [
      node("a", "a.agent.ts", 2, "core", "agent"),
      node("b", "b.agent.ts", 2, "core", "agent"),
      node("c", "c.agent.ts", 2, "core", "agent"),
    ],
    edges: [edge("a", "b"), edge("b", "c"), edge("c", "a")],
  };

  const report = analyzeBoundaries(graph);
  assert("cycle: CIRCULAR_DEPENDENCY detected",
    report.violations.some((v) => v.type === "CIRCULAR_DEPENDENCY" && v.severity === "CRITICAL"));
  assert("cycle: isCompliant=false",                report.isCompliant === false);
  assert("cycle: frozen",                           Object.isFrozen(report));
}

// ─── invalid / edge cases ────────────────────────────────────────────────────
console.log("\n── invalid / edge cases ──");
{
  reset();

  const r1 = analyzeBoundaries(null as any);
  assert("invalid: null → frozen",                  Object.isFrozen(r1));
  assert("invalid: null → overallScore=0",          r1.overallScore === 0);
  assert("invalid: null → isCompliant=false",       r1.isCompliant === false);
  assert("invalid: null → summary set",             r1.summary.length > 0);

  const r2 = analyzeBoundaries({ projectId: "x", nodes: [], edges: [] });
  assert("invalid: empty nodes → frozen",           Object.isFrozen(r2));
  assert("invalid: empty nodes → 0 violations",     r2.totalViolations === 0);
  assert("invalid: empty nodes → score=100",        r2.overallScore === 100);
  assert("invalid: empty nodes → isCompliant",      r2.isCompliant === true);
}

// ─── analyzeMultiple ─────────────────────────────────────────────────────────
console.log("\n── analyzeMultiple ──");
{
  reset();

  const g1: ArchitectureGraph = {
    projectId: "g1",
    nodes: [node("a", "a.ts", 1, "d", "orchestrator"), node("b", "b.ts", 2, "d", "agent")],
    edges: [edge("a", "b")],
  };
  const g2: ArchitectureGraph = {
    projectId: "g2",
    nodes: [node("x", "x.ts", 2, "d", "agent"), node("y", "y.ts", 1, "d", "orchestrator")],
    edges: [edge("x", "y")],
  };

  const reports = analyzeMultiple([g1, g2]);
  assert("batch: frozen",                           Object.isFrozen(reports));
  assert("batch: length=2",                         reports.length === 2);
  assert("batch: each frozen",                      reports.every((r) => Object.isFrozen(r)));
  assert("batch: g1 compliant",                     reports[0]!.isCompliant === true);
  assert("batch: g2 has upward violation",          reports[1]!.violations.some((v) => v.type === "UPWARD_IMPORT"));

  const empty = analyzeMultiple([]);
  assert("batch: empty → []",                       empty.length === 0);
  const nullBatch = analyzeMultiple(null as any);
  assert("batch: null → []",                        nullBatch.length === 0);
}

// ─── state: session + report history ─────────────────────────────────────────
console.log("\n── state: session + history ──");
{
  reset();
  assert("state: before analysis → no report",      getLastReport() === null);
  assert("state: before analysis → no session",     getSession() === null);

  const g: ArchitectureGraph = {
    projectId: "h",
    nodes: [node("a", "a.ts", 1, "d", "orchestrator"), node("b", "b.ts", 2, "d", "agent")],
    edges: [edge("a", "b")],
  };
  analyzeBoundaries(g);
  analyzeBoundaries(g);

  const last = getLastReport();
  assert("state: lastReport frozen",                Object.isFrozen(last));
  assert("state: lastReport reportId set",          last?.reportId.startsWith("boundary-"));
  assert("state: session phase=COMPLETE",           getSession()?.phase === "COMPLETE");

  const hist = getReportHistory();
  assert("state: history frozen",                   Object.isFrozen(hist));
  assert("state: history length ≥ 2",               hist.length >= 2);
}

// ─── determinism ─────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const g: ArchitectureGraph = {
    projectId: "det",
    nodes: [
      node("o",  "orch.ts",   1, "analysis", "orchestrator"),
      node("a",  "agent.ts",  2, "analysis", "agent"),
      node("pl", "plan.ts",   2, "planning", "agent"),
      node("rt", "runtime.ts",2, "runtime",  "agent"),
    ],
    edges: [edge("a", "o"), edge("pl", "rt")],
  };

  reset(); const r1 = analyzeBoundaries(g);
  reset(); const r2 = analyzeBoundaries(g);

  assert("det: same totalNodes",      r1.totalNodes      === r2.totalNodes);
  assert("det: same totalEdges",      r1.totalEdges      === r2.totalEdges);
  assert("det: same totalViolations", r1.totalViolations === r2.totalViolations);
  assert("det: same overallScore",    r1.overallScore    === r2.overallScore);
  assert("det: same criticalCount",   r1.criticalCount   === r2.criticalCount);
  assert("det: same isCompliant",     r1.isCompliant     === r2.isCompliant);
}

// ─── Results ─────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

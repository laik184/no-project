import {
  analyzeDependencies, analyzeMultiple,
  getLastResult, getResultHistory, resetAnalyzer,
} from "./index.js";
import type { DependencyInput, SourceModule } from "./index.js";
import { clearAll, getSession } from "./state.js";

import {
  buildAdjacency, buildReverseAdjacency,
  outDegree, inDegree, nodeById, edgesFrom,
  deduplicateEdges, graphDensity, isValidInput,
} from "./utils/graph.util.js";
import {
  computeInstability, riskFromInstability, riskFromCycleSize,
  clusterCohesion, computeHealthScore, avgInstabilityScore,
} from "./utils/score.util.js";
import {
  dfs, bfs, topologicalSort, longestPath, weaklyConnectedComponents,
} from "./utils/traversal.util.js";
import {
  buildDependencyGraph, findRoots, findLeaves,
} from "./agents/graph-builder.agent.js";
import {
  detectCycles, resetCycleDetectorCounter, cycleCount, modulesInCycles,
} from "./agents/cycle-detector.agent.js";
import {
  analyzeCoupling, mostUnstable, mostStable,
  highestFanOut, highestFanIn, criticalModules,
} from "./agents/coupling-analyzer.agent.js";
import {
  detectClusters, resetClusterDetectorCounter,
  largestCluster, isolatedModules, avgClusterCohesion,
} from "./agents/cluster-detector.agent.js";
import {
  computeMetrics, healthGrade, metricsSnapshot,
} from "./agents/metrics-computer.agent.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void {
  clearAll(); resetAnalyzer();
  resetCycleDetectorCounter();
  resetClusterDetectorCounter();
}

function mod(
  id:      string,
  imports: string[] = [],
  opts:    Partial<Pick<SourceModule, "layer" | "domain">> = {},
): SourceModule {
  return Object.freeze({
    id,
    path:    `${id}.ts`,
    imports: Object.freeze(imports),
    ...opts,
  });
}

function makeInput(
  projectId: string,
  modules:   SourceModule[],
): DependencyInput {
  return Object.freeze({ projectId, modules: Object.freeze(modules) });
}

reset();

// ─── utils/graph.util ────────────────────────────────────────────────────────
console.log("\n── utils/graph.util ──");
{
  const edges = Object.freeze([
    Object.freeze({ from: "a", to: "b", kind: "direct" as const }),
    Object.freeze({ from: "b", to: "c", kind: "direct" as const }),
    Object.freeze({ from: "a", to: "c", kind: "direct" as const }),
  ]);

  const adj = buildAdjacency(edges);
  assert("adj: a → [b, c]",          adj.get("a")?.includes("b") && adj.get("a")?.includes("c") ? true : false);
  assert("adj: b → [c]",             adj.get("b")?.includes("c") ?? false);
  assert("adj: c → nothing",         (adj.get("c")?.length ?? 0) === 0);

  const revAdj = buildReverseAdjacency(edges);
  assert("revAdj: c ← [b, a]",       revAdj.get("c")?.includes("a") && revAdj.get("c")?.includes("b") ? true : false);

  assert("outDegree: a=2",           outDegree(adj, "a") === 2);
  assert("outDegree: c=0",           outDegree(adj, "c") === 0);
  assert("inDegree: c=2",            inDegree(revAdj, "c") === 2);
  assert("inDegree: a=0",            inDegree(revAdj, "a") === 0);

  const dupes = Object.freeze([
    ...edges,
    Object.freeze({ from: "a", to: "b", kind: "direct" as const }),
  ]);
  const deduped = deduplicateEdges(dupes);
  assert("dedup: 4→3",               deduped.length === 3);
  assert("dedup: frozen",            Object.isFrozen(deduped));

  assert("density: 3 nodes 2 edges", graphDensity(3, 2) === 0.333);
  assert("density: 0 nodes = 0",     graphDensity(0, 0) === 0);
  assert("density: 1 node = 0",      graphDensity(1, 0) === 0);

  assert("isValidInput: valid",      isValidInput({ projectId: "x", modules: [] }));
  assert("isValidInput: null→false", !isValidInput(null));
  assert("isValidInput: no proj→false", !isValidInput({ modules: [] }));
}

// ─── utils/score.util ────────────────────────────────────────────────────────
console.log("\n── utils/score.util ──");
{
  assert("instability: 0/0 = 0",        computeInstability(0, 0) === 0);
  assert("instability: 0/1 = 0",        computeInstability(5, 0) === 0);
  assert("instability: 1/0 = 1",        computeInstability(0, 3) === 1);
  assert("instability: 2/5 = 0.286",    computeInstability(3, 2) === 0.4);
  assert("instability: symmetric",      computeInstability(5, 5) === 0.5);

  assert("risk: 0 → LOW",              riskFromInstability(0) === "LOW");
  assert("risk: 0.24 → LOW",           riskFromInstability(0.24) === "LOW");
  assert("risk: 0.5 → HIGH",           riskFromInstability(0.5) === "HIGH");
  assert("risk: 0.8 → CRITICAL",       riskFromInstability(0.8) === "CRITICAL");
  assert("risk: 1 → CRITICAL",         riskFromInstability(1) === "CRITICAL");

  assert("cycleRisk: 2 → LOW",         riskFromCycleSize(2) === "LOW");
  assert("cycleRisk: 3 → MEDIUM",      riskFromCycleSize(3) === "MEDIUM");
  assert("cycleRisk: 5 → HIGH",        riskFromCycleSize(5) === "HIGH");
  assert("cycleRisk: 10 → CRITICAL",   riskFromCycleSize(10) === "CRITICAL");

  assert("cohesion: 5int 0ext = 1",    clusterCohesion(5, 0) === 1);
  assert("cohesion: 0int 5ext = 0",    clusterCohesion(0, 5) === 0);
  assert("cohesion: 5int 5ext = 0.5",  clusterCohesion(5, 5) === 0.5);
  assert("cohesion: 0/0 = 1",          clusterCohesion(0, 0) === 1);

  const health = computeHealthScore({
    cycleCount: 2, largeCycleCount: 1,
    highRiskCount: 3, criticalRiskCount: 1, density: 0.3,
  });
  assert("health: deductions applied",  health === Math.max(0, 100 - 20 - 20 - 15 - 10));

  const highDensity = computeHealthScore({
    cycleCount: 0, largeCycleCount: 0,
    highRiskCount: 0, criticalRiskCount: 0, density: 0.6,
  });
  assert("health: high density -15",    highDensity === 85);

  assert("avgInstab: empty = 0",        avgInstabilityScore([]) === 0);
  assert("avgInstab: [0,1] = 0.5",      avgInstabilityScore([0, 1]) === 0.5);
}

// ─── utils/traversal.util ────────────────────────────────────────────────────
console.log("\n── utils/traversal.util ──");
{
  const adj = new Map([
    ["a", ["b", "c"]],
    ["b", ["d"]],
    ["c", ["d"]],
    ["d", []],
  ]);

  const dfsResult = dfs(["a"], adj, ["a", "b", "c", "d"]);
  assert("dfs: all visited",           dfsResult.visited.length === 4);
  assert("dfs: frozen",                Object.isFrozen(dfsResult));

  const bfsResult = bfs("a", adj);
  assert("bfs: starts with a",         bfsResult[0] === "a");
  assert("bfs: all 4 nodes",           bfsResult.length === 4);
  assert("bfs: frozen",                Object.isFrozen(bfsResult));

  const topo = topologicalSort(["a", "b", "c", "d"], adj);
  assert("topo: returns sorted list",   topo !== null && topo.length === 4);
  assert("topo: a before d",           topo !== null && topo.indexOf("a") < topo.indexOf("d"));
  assert("topo: frozen",               topo !== null && Object.isFrozen(topo));

  const cycleAdj = new Map([["x", ["y"]], ["y", ["x"]]]);
  const cyclic = topologicalSort(["x", "y"], cycleAdj);
  assert("topo: cycle → null",         cyclic === null);

  const depth = longestPath(["a", "b", "c", "d"], adj);
  assert("longestPath: a→b→d = 2",     depth === 2);

  const cycleLongest = longestPath(["x", "y"], cycleAdj);
  assert("longestPath: cycle → -1",    cycleLongest === -1);

  const revAdj = new Map([["d", ["a", "b"]], ["b", ["a"]]]);
  const comps  = weaklyConnectedComponents(["a", "b", "c", "d"], adj, revAdj);
  assert("wcc: non-empty",             comps.length > 0);
  assert("wcc: frozen",               Object.isFrozen(comps));
}

// ─── graph-builder ────────────────────────────────────────────────────────────
console.log("\n── graph-builder.agent ──");
{
  const input = makeInput("proj", [
    mod("a", ["b", "c"]),
    mod("b", ["c"]),
    mod("c", []),
    mod("x", ["a"]),
  ]);

  const graph = buildDependencyGraph(input);
  assert("builder: frozen",             Object.isFrozen(graph));
  assert("builder: nodes frozen",       Object.isFrozen(graph.nodes));
  assert("builder: edges frozen",       Object.isFrozen(graph.edges));
  assert("builder: 4 nodes",           graph.nodes.length === 4);
  assert("builder: 4 edges (a→b,a→c,b→c,x→a)", graph.edges.length === 4);
  assert("builder: projectId set",      graph.projectId === "proj");

  const nodeA = nodeById(graph, "a");
  assert("builder: nodeById=a",         nodeA?.id === "a");
  assert("builder: path set",           nodeA?.path === "a.ts");

  const fromA = edgesFrom(graph, "a");
  assert("builder: edgesFrom a = 2",    fromA.length === 2);

  const roots = findRoots(graph);
  assert("builder: root = x (no incoming)", roots.some((r) => r.id === "x"));

  const leaves = findLeaves(graph);
  assert("builder: leaf = c (no outgoing)", leaves.some((l) => l.id === "c"));

  const selfLoop = makeInput("sl", [mod("a", ["a"])]);
  const slGraph  = buildDependencyGraph(selfLoop);
  assert("builder: self-loop removed",  slGraph.edges.length === 0);

  const unknownImport = makeInput("ui", [mod("a", ["nonexistent"])]);
  const uiGraph = buildDependencyGraph(unknownImport);
  assert("builder: unknown import skipped", uiGraph.edges.length === 0);

  const empty = buildDependencyGraph(makeInput("e", []));
  assert("builder: empty → 0 nodes",   empty.nodes.length === 0);
  assert("builder: empty frozen",       Object.isFrozen(empty));

  const invalid = buildDependencyGraph(null as any);
  assert("builder: null → empty graph", invalid.nodes.length === 0);
}

// ─── cycle-detector ──────────────────────────────────────────────────────────
console.log("\n── cycle-detector.agent ──");
{
  resetCycleDetectorCounter();

  const noCycleGraph = buildDependencyGraph(makeInput("nc", [
    mod("a", ["b"]), mod("b", ["c"]), mod("c", []),
  ]));
  const noCycles = detectCycles(noCycleGraph);
  assert("cycle: no cycle → []",        noCycles.length === 0);
  assert("cycle: frozen",               Object.isFrozen(noCycles));

  const cycleGraph = buildDependencyGraph(makeInput("cy", [
    mod("a", ["b"]), mod("b", ["c"]), mod("c", ["a"]),
    mod("x", ["y"]), mod("y", ["x"]),
  ]));
  const cycles = detectCycles(cycleGraph);
  assert("cycle: 2 SCCs detected",      cycles.length === 2);
  assert("cycle: each frozen",          cycles.every((c) => Object.isFrozen(c)));
  assert("cycle: members frozen",       Object.isFrozen(cycles[0]!.members));
  assert("cycle: id set",              cycles[0]!.id.startsWith("cyc-"));
  assert("cycle: severity set",        ["LOW","MEDIUM","HIGH","CRITICAL"].includes(cycles[0]!.severity));

  assert("cycleCount: 2",              cycleCount(cycles) === 2);
  assert("modulesInCycles: 5",         modulesInCycles(cycles) === 5);

  const emptyGraph = buildDependencyGraph(makeInput("e", []));
  const emptyCycles = detectCycles(emptyGraph);
  assert("cycle: empty graph → []",    emptyCycles.length === 0);
}

// ─── coupling-analyzer ───────────────────────────────────────────────────────
console.log("\n── coupling-analyzer.agent ──");
{
  const input = makeInput("coup", [
    mod("shared", []),
    mod("a", ["shared"]),
    mod("b", ["shared"]),
    mod("c", ["shared", "a"]),
    mod("isolated", []),
  ]);
  const graph  = buildDependencyGraph(input);
  const scores = analyzeCoupling(graph);

  assert("coupling: frozen",            Object.isFrozen(scores));
  assert("coupling: 5 scores",          scores.length === 5);
  assert("coupling: each frozen",        scores.every((s) => Object.isFrozen(s)));

  const shared = scores.find((s) => s.moduleId === "shared");
  assert("coupling: shared Ca=3",        shared?.afferentCoupling === 3);
  assert("coupling: shared Ce=0",        shared?.efferentCoupling === 0);
  assert("coupling: shared instab=0",   shared?.instability === 0);
  assert("coupling: shared risk=LOW",   shared?.risk === "LOW");

  const isolated = scores.find((s) => s.moduleId === "isolated");
  assert("coupling: isolated Ca=0",     isolated?.afferentCoupling === 0);
  assert("coupling: isolated Ce=0",     isolated?.efferentCoupling === 0);
  assert("coupling: isolated instab=0", isolated?.instability === 0);

  const mostU = mostUnstable(scores);
  assert("mostUnstable: not null",       mostU !== null);

  const mostS = mostStable(scores);
  assert("mostStable: shared or isolated", ["shared","isolated"].includes(mostS?.moduleId ?? ""));

  const fanOut = highestFanOut(scores);
  assert("highestFanOut: not null",     fanOut !== null);

  const fanIn = highestFanIn(scores);
  assert("highestFanIn: shared Ca=3",   fanIn?.moduleId === "shared");

  const critical = criticalModules(scores);
  assert("criticalModules: frozen",     Object.isFrozen(critical));

  const emptyScores = analyzeCoupling(buildDependencyGraph(makeInput("e", [])));
  assert("coupling: empty → []",        emptyScores.length === 0);

  assert("mostUnstable: empty → null",  mostUnstable([]) === null);
  assert("mostStable: empty → null",    mostStable([]) === null);
}

// ─── cluster-detector ────────────────────────────────────────────────────────
console.log("\n── cluster-detector.agent ──");
{
  resetClusterDetectorCounter();

  const input = makeInput("clust", [
    mod("a", ["b"]), mod("b", []),
    mod("x", ["y"]), mod("y", []),
    mod("solo", []),
  ]);
  const graph    = buildDependencyGraph(input);
  const clusters = detectClusters(graph);

  assert("cluster: frozen",             Object.isFrozen(clusters));
  assert("cluster: 3 components",       clusters.length === 3);
  assert("cluster: each frozen",        clusters.every((c) => Object.isFrozen(c)));
  assert("cluster: members frozen",     Object.isFrozen(clusters[0]!.members));
  assert("cluster: id starts clust-",   clusters[0]!.id.startsWith("clust-"));
  assert("cluster: cohesion 0–1",       clusters.every((c) => c.cohesion >= 0 && c.cohesion <= 1));

  const largest = largestCluster(clusters);
  assert("largestCluster: not null",    largest !== null);
  assert("largestCluster: frozen",      Object.isFrozen(largest));

  const isolated = isolatedModules(clusters);
  assert("isolatedModules: solo found", isolated.some((c) => c.members.includes("solo")));
  assert("isolatedModules: frozen",     Object.isFrozen(isolated));

  const avgCoh = avgClusterCohesion(clusters);
  assert("avgCohesion: 0–1",           avgCoh >= 0 && avgCoh <= 1);
  assert("avgCohesion: empty=0",       avgClusterCohesion([]) === 0);

  const empty = detectClusters(buildDependencyGraph(makeInput("e", [])));
  assert("cluster: empty → []",        empty.length === 0);
}

// ─── metrics-computer ────────────────────────────────────────────────────────
console.log("\n── metrics-computer.agent ──");
{
  const input = makeInput("met", [
    mod("a", ["b", "c"]),
    mod("b", ["d"]),
    mod("c", ["d"]),
    mod("d", []),
  ]);
  const graph    = buildDependencyGraph(input);
  const cycles   = detectCycles(graph);
  const coupling = analyzeCoupling(graph);
  const clusters = detectClusters(graph);
  const metrics  = computeMetrics(graph, cycles, coupling, clusters);

  assert("metrics: frozen",             Object.isFrozen(metrics));
  assert("metrics: totalModules=4",     metrics.totalModules === 4);
  assert("metrics: totalEdges=4",       metrics.totalEdges === 4);
  assert("metrics: cycleCount=0",       metrics.cycleCount === 0);
  assert("metrics: clusterCount=1",     metrics.clusterCount === 1);
  assert("metrics: maxFanOut=2",        metrics.maxFanOut === 2);
  assert("metrics: maxFanIn=2",         metrics.maxFanIn === 2);
  assert("metrics: maxDepth≥2",         metrics.maxDepth >= 2);
  assert("metrics: health=80 (1 CRITICAL, 2 HIGH)",  metrics.overallHealthScore === 80);
  assert("metrics: density≥0",         metrics.graphDensity >= 0);

  const empty = computeMetrics(buildDependencyGraph(makeInput("e", [])), [], [], []);
  assert("metrics: empty → health=100", empty.overallHealthScore === 100);
  assert("metrics: empty → frozen",     Object.isFrozen(empty));

  assert("healthGrade: 100 → A",        healthGrade(100) === "A");
  assert("healthGrade: 80 → B",         healthGrade(80)  === "B");
  assert("healthGrade: 65 → C",         healthGrade(65)  === "C");
  assert("healthGrade: 45 → D",         healthGrade(45)  === "D");
  assert("healthGrade: 20 → F",         healthGrade(20)  === "F");

  const snapshot = metricsSnapshot(metrics);
  assert("snapshot: contains modules=",  snapshot.includes("modules=4"));
  assert("snapshot: contains cycles=",   snapshot.includes("cycles=0"));
}

// ─── orchestrator: clean graph ────────────────────────────────────────────────
console.log("\n── orchestrator: clean graph ──");
{
  reset();

  const input = makeInput("clean", [
    mod("orch",  []),
    mod("agent1",["orch"]),
    mod("agent2",["orch"]),
    mod("util",  []),
    mod("agent1util", ["util", "orch"]),
  ]);

  const result = analyzeDependencies(input);
  assert("clean: frozen",              Object.isFrozen(result));
  assert("clean: graph frozen",        Object.isFrozen(result.graph));
  assert("clean: cycles frozen",       Object.isFrozen(result.cycles));
  assert("clean: coupling frozen",     Object.isFrozen(result.coupling));
  assert("clean: clusters frozen",     Object.isFrozen(result.clusters));
  assert("clean: metrics frozen",      Object.isFrozen(result.metrics));
  assert("clean: resultId set",        result.resultId.startsWith("dep-"));
  assert("clean: analyzedAt > 0",      result.analyzedAt > 0);
  assert("clean: 5 modules",          result.graph.nodes.length === 5);
  assert("clean: 0 cycles",           result.cycles.length === 0);
  assert("clean: no cycles → health > 0", result.metrics.overallHealthScore > 0 && result.metrics.cycleCount === 0);
  assert("clean: summary set",         result.summary.includes("5 modules"));
  assert("clean: summary no cycles",   result.summary.includes("No cycles"));
}

// ─── orchestrator: cyclic graph ───────────────────────────────────────────────
console.log("\n── orchestrator: cyclic graph ──");
{
  reset();

  const input = makeInput("cyclic", [
    mod("a", ["b"]), mod("b", ["c"]), mod("c", ["a"]),
    mod("x", ["y"]), mod("y", ["x"]),
    mod("z", []),
  ]);

  const result = analyzeDependencies(input);
  assert("cyclic: 2 cycles",           result.cycles.length === 2);
  assert("cyclic: 5 in cycles",        result.metrics.modulesInCycles === 5);
  assert("cyclic: health < 100",       result.metrics.overallHealthScore < 100);
  assert("cyclic: frozen",             Object.isFrozen(result));
  assert("cyclic: summary has cycle",  result.summary.includes("cycle(s)"));
  assert("cyclic: maxDepth = -1",      result.metrics.maxDepth === -1);
}

// ─── orchestrator: coupling heavy ────────────────────────────────────────────
console.log("\n── orchestrator: coupling analysis ──");
{
  reset();

  const input = makeInput("coupled", [
    mod("hub",  []),
    mod("m1", ["hub"]), mod("m2", ["hub"]), mod("m3", ["hub"]),
    mod("m4", ["hub"]), mod("m5", ["hub"]),
    mod("leaf", ["m1", "m2", "m3", "m4", "m5", "hub"]),
  ]);

  const result = analyzeDependencies(input);
  const hub = result.coupling.find((s) => s.moduleId === "hub");
  assert("coupling: hub Ca=6",          hub?.afferentCoupling === 6);
  assert("coupling: hub Ce=0",          hub?.efferentCoupling === 0);
  assert("coupling: hub instab=0",     hub?.instability === 0);

  const leaf = result.coupling.find((s) => s.moduleId === "leaf");
  assert("coupling: leaf Ce=6",         leaf?.efferentCoupling === 6);
  assert("coupling: leaf instab=1",     leaf?.instability === 1);
  assert("coupling: leaf CRITICAL",     leaf?.risk === "CRITICAL");
  assert("coupling: frozen result",     Object.isFrozen(result));
}

// ─── orchestrator: invalid / edge cases ──────────────────────────────────────
console.log("\n── invalid / edge cases ──");
{
  reset();

  const r1 = analyzeDependencies(null as any);
  assert("invalid: null → frozen",      Object.isFrozen(r1));
  assert("invalid: null → health=0",    r1.metrics.overallHealthScore === 0);
  assert("invalid: null → summary set", r1.summary.length > 0);

  const r2 = analyzeDependencies(makeInput("e", []));
  assert("empty: frozen",              Object.isFrozen(r2));
  assert("empty: 0 nodes",            r2.graph.nodes.length === 0);
  assert("empty: health=100",         r2.metrics.overallHealthScore === 100);
  assert("empty: no cycles",          r2.cycles.length === 0);
}

// ─── analyzeMultiple ─────────────────────────────────────────────────────────
console.log("\n── analyzeMultiple ──");
{
  reset();

  const inputs = [
    makeInput("p1", [mod("a", ["b"]), mod("b", [])]),
    makeInput("p2", [mod("x", ["y"]), mod("y", ["x"])]),
  ];
  const results = analyzeMultiple(inputs);
  assert("batch: frozen",              Object.isFrozen(results));
  assert("batch: length=2",            results.length === 2);
  assert("batch: each frozen",         results.every((r) => Object.isFrozen(r)));
  assert("batch: p1 no cycles",        results[0]!.cycles.length === 0);
  assert("batch: p2 has cycle",        results[1]!.cycles.length >= 1);

  const empty = analyzeMultiple([]);
  assert("batch: empty → []",          empty.length === 0);

  const nullBatch = analyzeMultiple(null as any);
  assert("batch: null → []",           nullBatch.length === 0);
}

// ─── state: session + history ────────────────────────────────────────────────
console.log("\n── state: session + history ──");
{
  reset();
  assert("state: before → null result", getLastResult() === null);
  assert("state: before → null session",getSession() === null);

  const input = makeInput("h", [mod("a", ["b"]), mod("b", [])]);
  analyzeDependencies(input);
  analyzeDependencies(input);

  const last = getLastResult();
  assert("state: lastResult frozen",    Object.isFrozen(last));
  assert("state: resultId starts dep-", last?.resultId.startsWith("dep-"));
  assert("state: phase=COMPLETE",       getSession()?.phase === "COMPLETE");

  const hist = getResultHistory();
  assert("state: history frozen",       Object.isFrozen(hist));
  assert("state: length ≥ 2",          hist.length >= 2);
}

// ─── determinism ─────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const input = makeInput("det", [
    mod("a", ["b", "c"]),
    mod("b", ["d"]),
    mod("c", ["b"]),
    mod("d", []),
    mod("e", ["a", "d"]),
  ]);

  reset(); const r1 = analyzeDependencies(input);
  reset(); const r2 = analyzeDependencies(input);

  assert("det: same totalModules",     r1.metrics.totalModules    === r2.metrics.totalModules);
  assert("det: same totalEdges",       r1.metrics.totalEdges      === r2.metrics.totalEdges);
  assert("det: same cycleCount",       r1.metrics.cycleCount      === r2.metrics.cycleCount);
  assert("det: same health",           r1.metrics.overallHealthScore === r2.metrics.overallHealthScore);
  assert("det: same density",          r1.metrics.graphDensity    === r2.metrics.graphDensity);
  assert("det: same clusterCount",     r1.metrics.clusterCount    === r2.metrics.clusterCount);
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

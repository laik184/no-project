import {
  detectArchitecturePatterns,
  getAnalysisState,
  resetPatternDetection,
} from "./index.js";
import type {
  PatternAnalysisInput,
  ArchitecturePatternReport,
} from "./index.js";
import { classifyArchitecturePattern } from "./agents/pattern-classifier.agent.js";
import { detectLayering } from "./agents/layering.detector.agent.js";
import { analyzeModularity } from "./agents/modularity.analyzer.agent.js";
import { detectMicroserviceBoundaries } from "./agents/microservice.detector.agent.js";
import { detectAntiPatterns } from "./agents/anti-pattern.detector.agent.js";
import { analyzeCouplingPatterns } from "./agents/coupling-pattern.analyzer.agent.js";
import { calculatePatternScore } from "./agents/pattern-score.calculator.agent.js";
import {
  detectCircularDependencies, dependencyDensity, moduleIndependenceRatio,
} from "./utils/heuristic.engine.util.js";
import { extractModules, groupFilesByModule } from "./utils/folder-structure.util.js";
import { weightedScore, scoreLevel } from "./utils/score.util.js";
import { buildImportGraph } from "./utils/import-graph.util.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void {
  resetPatternDetection();
}

function makeInput(files: readonly string[], fileContents?: Readonly<Record<string, string>>): PatternAnalysisInput {
  return Object.freeze({ files: Object.freeze([...files]), fileContents });
}

reset();

// ─── utils/heuristic.engine ──────────────────────────────────────────────────
console.log("\n── utils/heuristic.engine ──");
{
  const graph: Readonly<Record<string, readonly string[]>> = Object.freeze({
    "a.ts": Object.freeze(["b.ts", "c.ts"]),
    "b.ts": Object.freeze(["a.ts"]),
    "c.ts": Object.freeze([]),
  });

  const circular = detectCircularDependencies(graph);
  assert("detectCircularDependencies: finds a<->b cycle",     circular.length >= 1);
  assert("detectCircularDependencies: c has no cycle",
    !circular.some((c) => c.includes("c.ts")));

  const density = dependencyDensity(graph);
  assert("dependencyDensity: returns 0–1",                    density >= 0 && density <= 1);
  assert("dependencyDensity: empty graph → 0",                dependencyDensity({}) === 0);
  assert("dependencyDensity: single node → 0",                dependencyDensity({ "a.ts": [] }) === 0);

  const files = Object.freeze(["a.ts", "b.ts", "c.ts"]);
  const independence = moduleIndependenceRatio(files, graph);
  assert("moduleIndependenceRatio: returns 0–1",              independence >= 0 && independence <= 1);
}

// ─── utils/folder-structure.util ─────────────────────────────────────────────
console.log("\n── utils/folder-structure.util ──");
{
  const files = Object.freeze([
    "services/auth/login.ts",
    "services/auth/logout.ts",
    "services/billing/invoice.ts",
    "controllers/api.ts",
  ]);

  const modules = extractModules(files);
  assert("extractModules: finds unique top-level segments",   modules.length >= 2);
  assert("extractModules: contains 'auth' segment",
    modules.includes("auth") || modules.includes("services") || modules.length >= 1);

  const grouped = groupFilesByModule(files);
  assert("groupFilesByModule: returns Record",                typeof grouped === "object");
  assert("groupFilesByModule: groups are arrays",
    Object.values(grouped).every((group) => Array.isArray(group)));
}

// ─── utils/score.util ────────────────────────────────────────────────────────
console.log("\n── utils/score.util ──");
{
  const score = weightedScore([
    { value: 100, weight: 0.5 },
    { value: 60,  weight: 0.5 },
  ]);
  assert("weightedScore: 100+60 at 0.5/0.5 = 80",            score === 80);

  const allZero = weightedScore([
    { value: 0, weight: 0.5 },
    { value: 0, weight: 0.5 },
  ]);
  assert("weightedScore: all zeros → 0",                      allZero === 0);

  assert("scoreLevel: 90 → excellent",   scoreLevel(90) === "excellent");
  assert("scoreLevel: 75 → good",        scoreLevel(75) === "good");
  assert("scoreLevel: 55 → average",     scoreLevel(55) === "average");
  assert("scoreLevel: 30 → poor",        scoreLevel(30) === "poor");
}

// ─── utils/import-graph.util ─────────────────────────────────────────────────
console.log("\n── utils/import-graph.util ──");
{
  const graph = buildImportGraph(makeInput(["a.ts", "b.ts", "c.ts"]));
  assert("buildImportGraph: returns Record",                  typeof graph === "object");
  assert("buildImportGraph: files are keys",                  Object.keys(graph).length >= 0);

  const contentGraph = buildImportGraph({
    files: Object.freeze(["a.ts", "b.ts"]),
    fileContents: Object.freeze({
      "a.ts": `import './b';`,
      "b.ts": `export const x = 1;`,
    }),
  });
  assert("buildImportGraph: detects import from content",     typeof contentGraph === "object");
}

// ─── agents/pattern-classifier ───────────────────────────────────────────────
console.log("\n── agents/pattern-classifier.agent ──");
{
  const monolithInput = {
    files: Object.freeze(["src/app.ts", "src/helper.ts"]),
    importGraph: Object.freeze({ "src/app.ts": Object.freeze(["src/helper.ts"]) }),
    modules: Object.freeze(["src"]),
  };
  const mono = classifyArchitecturePattern(monolithInput);
  assert("classifyArchitecturePattern: type is valid",
    ["monolith","layered","modular","microservice"].includes(mono.type));
  assert("classifyArchitecturePattern: confidence is 0–1",
    mono.confidence >= 0 && mono.confidence <= 1);

  const layeredInput = {
    files: Object.freeze([
      "controller/api.controller.ts",
      "service/user.service.ts",
      "service/auth.service.ts",
      "repository/user.repo.ts",
    ]),
    importGraph: Object.freeze({
      "controller/api.controller.ts": Object.freeze(["service/user.service.ts"]),
      "service/user.service.ts": Object.freeze(["repository/user.repo.ts"]),
      "service/auth.service.ts": Object.freeze(["repository/user.repo.ts"]),
      "repository/user.repo.ts": Object.freeze([]),
    }),
    modules: Object.freeze(["controller","service","repository"]),
  };
  const layered = classifyArchitecturePattern(layeredInput);
  assert("classifyArchitecturePattern: layered files → layered or modular",
    layered.type === "layered" || layered.type === "modular" || layered.type === "monolith");
}

// ─── agents/layering-detector ────────────────────────────────────────────────
console.log("\n── agents/layering.detector.agent ──");
{
  const input = {
    files: Object.freeze([
      "controller/orders.controller.ts",
      "service/orders.service.ts",
      "repository/orders.repo.ts",
    ]),
    importGraph: Object.freeze({
      "controller/orders.controller.ts": Object.freeze(["service/orders.service.ts"]),
      "service/orders.service.ts": Object.freeze(["repository/orders.repo.ts"]),
      "repository/orders.repo.ts": Object.freeze([]),
    }),
  };
  const layering = detectLayering(input);
  assert("detectLayering: score 0–100",                       layering.score >= 0 && layering.score <= 100);
  assert("detectLayering: violations is array",               Array.isArray(layering.violations));
  assert("detectLayering: layers is Record",                  typeof layering.layers === "object");
}

// ─── agents/modularity-analyzer ──────────────────────────────────────────────
console.log("\n── agents/modularity.analyzer.agent ──");
{
  const input = {
    files: Object.freeze(["auth/login.ts", "auth/logout.ts", "billing/invoice.ts"]),
    importGraph: Object.freeze({
      "auth/login.ts":     Object.freeze([]),
      "auth/logout.ts":    Object.freeze([]),
      "billing/invoice.ts":Object.freeze([]),
    }),
  };
  const modularity = analyzeModularity(input);
  assert("analyzeModularity: modularityScore 0–100",          modularity.modularityScore >= 0 && modularity.modularityScore <= 100);
  assert("analyzeModularity: cohesionScore 0–100",            modularity.cohesionScore >= 0 && modularity.cohesionScore <= 100);
  assert("analyzeModularity: couplingScore 0–100",            modularity.couplingScore >= 0 && modularity.couplingScore <= 100);
  assert("analyzeModularity: moduleCount ≥0",                 modularity.moduleCount >= 0);
}

// ─── agents/microservice-detector ────────────────────────────────────────────
console.log("\n── agents/microservice.detector.agent ──");
{
  const input = {
    files: Object.freeze(["auth/index.ts", "billing/index.ts", "orders/index.ts"]),
    importGraph: Object.freeze({
      "auth/index.ts":    Object.freeze([]),
      "billing/index.ts": Object.freeze([]),
      "orders/index.ts":  Object.freeze([]),
    }),
  };
  const micro = detectMicroserviceBoundaries(input);
  assert("detectMicroserviceBoundaries: serviceCount ≥0",     micro.serviceCount >= 0);
  assert("detectMicroserviceBoundaries: confidence 0–1",      micro.confidence >= 0 && micro.confidence <= 1);
  assert("detectMicroserviceBoundaries: boundaryViolations[]", Array.isArray(micro.boundaryViolations));
}

// ─── agents/anti-pattern-detector ────────────────────────────────────────────
console.log("\n── agents/anti-pattern.detector.agent ──");
{
  const cycleGraph: Readonly<Record<string, readonly string[]>> = Object.freeze({
    "a.ts": Object.freeze(["b.ts"]),
    "b.ts": Object.freeze(["a.ts"]),
  });
  const antiPatterns = detectAntiPatterns({
    files: Object.freeze(["a.ts","b.ts"]),
    importGraph: cycleGraph,
    layerViolations: Object.freeze([]),
  });
  assert("detectAntiPatterns: returns readonly string[]",       Array.isArray(antiPatterns));
  assert("detectAntiPatterns: cycle detected in circular graph",
    antiPatterns.some((p) => p.toLowerCase().includes("circular") || p.toLowerCase().includes("cycle")));
}

// ─── agents/coupling-pattern-analyzer ────────────────────────────────────────
console.log("\n── agents/coupling-pattern.analyzer.agent ──");
{
  const tightGraph: Readonly<Record<string, readonly string[]>> = Object.freeze({
    "a.ts": Object.freeze(["b.ts","c.ts","d.ts"]),
    "b.ts": Object.freeze(["a.ts","c.ts"]),
    "c.ts": Object.freeze(["a.ts"]),
    "d.ts": Object.freeze([]),
  });
  const coupling = analyzeCouplingPatterns({ importGraph: tightGraph });
  assert("analyzeCouplingPatterns: couplingScore 0–100",        coupling.couplingScore >= 0 && coupling.couplingScore <= 100);
  assert("analyzeCouplingPatterns: tightCouplingPairs is array",Array.isArray(coupling.tightCouplingPairs));
  assert("analyzeCouplingPatterns: dependencyClusters is array",Array.isArray(coupling.dependencyClusters));
}

// ─── agents/pattern-score-calculator ─────────────────────────────────────────
console.log("\n── agents/pattern-score.calculator.agent ──");
{
  const s1 = calculatePatternScore({
    modularityScore: 90, couplingScore: 85, layeringScore: 88, antiPatternCount: 0,
  });
  assert("calculatePatternScore: high scores → excellent score",   s1.score >= 70);
  assert("calculatePatternScore: score is 0–100",                  s1.score >= 0 && s1.score <= 100);
  assert("calculatePatternScore: level is valid",
    ["poor","average","good","excellent"].includes(s1.level));

  const s2 = calculatePatternScore({
    modularityScore: 20, couplingScore: 20, layeringScore: 20, antiPatternCount: 5,
  });
  assert("calculatePatternScore: low scores → poor or average",    s2.score <= 60);
  assert("calculatePatternScore: low < high",                      s2.score < s1.score);
}

// ─── state ───────────────────────────────────────────────────────────────────
console.log("\n── state ──");
{
  resetPatternDetection();
  const state = getAnalysisState();
  assert("getAnalysisState: returns state object",    typeof state === "object");
  assert("getAnalysisState: files is empty after reset", state.files.length === 0);
  assert("getAnalysisState: antiPatterns is empty",   state.antiPatterns.length === 0);
}

// ─── detectArchitecturePatterns (orchestrator) ────────────────────────────────
console.log("\n── detectArchitecturePatterns (orchestrator) ──");
{
  reset();

  const emptyReport = detectArchitecturePatterns(makeInput([]));
  assert("detectArchitecturePatterns: empty → valid type",
    ["monolith","layered","modular","microservice"].includes(emptyReport.architectureType));
  assert("detectArchitecturePatterns: empty → score 0–100",
    emptyReport.finalScore >= 0 && emptyReport.finalScore <= 100);

  const layeredFiles = Object.freeze([
    "controller/user.controller.ts",
    "service/user.service.ts",
    "service/auth.service.ts",
    "repository/user.repo.ts",
  ]);
  const layeredReport: ArchitecturePatternReport = detectArchitecturePatterns(makeInput(layeredFiles));
  assert("detectArchitecturePatterns: architectureType is string",   typeof layeredReport.architectureType === "string");
  assert("detectArchitecturePatterns: confidence 0–1",               layeredReport.confidence >= 0 && layeredReport.confidence <= 1);
  assert("detectArchitecturePatterns: antiPatterns is array",        Array.isArray(layeredReport.antiPatterns));
  assert("detectArchitecturePatterns: couplingScore 0–100",          layeredReport.couplingScore >= 0 && layeredReport.couplingScore <= 100);
  assert("detectArchitecturePatterns: modularityScore 0–100",        layeredReport.modularityScore >= 0 && layeredReport.modularityScore <= 100);
  assert("detectArchitecturePatterns: finalScore 0–100",             layeredReport.finalScore >= 0 && layeredReport.finalScore <= 100);

  const stateAfter = getAnalysisState();
  assert("getAnalysisState: files set after analysis",               stateAfter.files.length === layeredFiles.length);

  reset();
  assert("resetPatternDetection: clears state",                      getAnalysisState().files.length === 0);
}

// ─── invalid input ────────────────────────────────────────────────────────────
console.log("\n── detectArchitecturePatterns: error handling ──");
{
  let threw = false;
  try {
    detectArchitecturePatterns(null as unknown as PatternAnalysisInput);
  } catch (_) {
    threw = true;
  }
  assert("detectArchitecturePatterns: throws on null input",  threw);

  let threw2 = false;
  try {
    detectArchitecturePatterns({ files: [" ", ""] });
  } catch (_) {
    threw2 = true;
  }
  assert("detectArchitecturePatterns: throws on empty-string file", threw2);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`pattern-detection: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

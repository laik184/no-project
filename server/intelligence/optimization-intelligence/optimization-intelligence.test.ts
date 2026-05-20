import {
  analyze,
  analyzeRuntime,
  analyzeCode,
  resetCounter,
} from "./index.js";
import type {
  RuntimeAnalysisInput,
  CodeStructureInput,
  OptimizationReport,
  MemoryMetric,
  CpuMetric,
  EndpointProfile,
  FunctionProfile,
  ResponseProfile,
  CacheProfile,
} from "./index.js";
import { analyzeCpuPatterns }         from "./performance/agents/cpu-pattern.agent.js";
import { analyzeMemoryPatterns }      from "./performance/agents/memory-pattern.agent.js";
import { analyzeLatencyPatterns }     from "./performance/agents/latency-pattern.agent.js";
import { suggestAsyncRefactors }      from "./code-optimization/agents/async-suggestion.agent.js";
import { detectSyncBlocking }         from "./code-optimization/agents/sync-blocking.agent.js";
import { recommendWorkerThreads }     from "./code-optimization/agents/worker-thread.agent.js";
import { detectCachingOpportunities } from "./code-optimization/agents/caching-opportunity.agent.js";
import { analyzePayloadOptimization } from "./payload/agents/payload-optimizer.agent.js";
import { rankSuggestions, buildSummary } from "./ranking/impact-ranker.js";
import {
  impactToScore, scoreToImpact, clampScore,
  countByImpact, topFinding, makeFindingId, resetSeq,
} from "./utils/scoring.util.js";
import { clearAll } from "./state.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function beforeEach(fn: () => void) { fn(); }
beforeEach(() => { clearAll(); resetCounter(); resetSeq(); });

// ─── factories ───────────────────────────────────────────────────────────────

const LOW_CPU:  CpuMetric    = Object.freeze({ usagePercent: 20, userMs: 200,  systemMs: 50 });
const HIGH_CPU: CpuMetric    = Object.freeze({ usagePercent: 92, userMs: 5000, systemMs: 1500 });
const LOW_MEM:  MemoryMetric = Object.freeze({ heapUsedMb: 100, heapTotalMb: 512, externalMb: 10, rssMb: 200 });
const HIGH_MEM: MemoryMetric = Object.freeze({ heapUsedMb: 500, heapTotalMb: 512, externalMb: 250, rssMb: 900 });

const SLOW_EP: EndpointProfile = Object.freeze({
  route: "/api/users", method: "GET", avgLatencyMs: 2500,
  p99LatencyMs: 4000, callCount: 3000, errorRate: 0.15,
});
const FAST_EP: EndpointProfile = Object.freeze({
  route: "/health", method: "GET", avgLatencyMs: 5,
  p99LatencyMs: 10, callCount: 100, errorRate: 0,
});

const SYNC_FN: FunctionProfile = Object.freeze({
  name: "loadData", isAsync: false, hasSyncIoCalls: true,
  hasLoops: false, lineCount: 40, callFrequency: 80,
});
const ASYNC_FN: FunctionProfile = Object.freeze({
  name: "fetchUser", isAsync: true, hasSyncIoCalls: false,
  hasLoops: false, lineCount: 20, callFrequency: 10,
});
const HEAVY_FN: FunctionProfile = Object.freeze({
  name: "processMatrix", isAsync: false, hasSyncIoCalls: false,
  hasLoops: true, lineCount: 120, callFrequency: 30,
});

const BIG_RESP: ResponseProfile = Object.freeze({
  route: "/api/data", avgPayloadBytes: 620_000, hasCompression: false, hasFieldFilter: false,
});
const SMALL_RESP: ResponseProfile = Object.freeze({
  route: "/ping", avgPayloadBytes: 50, hasCompression: true, hasFieldFilter: true,
});

const LOW_CACHE: CacheProfile = Object.freeze({
  route: "/api/search", cacheHitRate: 0.10, avgComputeMs: 300, callFrequency: 200,
});
const HIGH_CACHE: CacheProfile = Object.freeze({
  route: "/api/catalog", cacheHitRate: 0.92, avgComputeMs: 50, callFrequency: 40,
});

function makeRuntime(overrides: Partial<RuntimeAnalysisInput> = {}): RuntimeAnalysisInput {
  return Object.freeze({
    memory:    LOW_MEM,
    cpu:       LOW_CPU,
    endpoints: Object.freeze([FAST_EP]),
    metrics:   Object.freeze([]),
    ...overrides,
  });
}

function makeCode(overrides: Partial<CodeStructureInput> = {}): CodeStructureInput {
  return Object.freeze({
    functions: Object.freeze([]),
    responses: Object.freeze([]),
    caches:    Object.freeze([]),
    ...overrides,
  });
}

// ─── utils/scoring.util ──────────────────────────────────────────────────────
console.log("\n── utils/scoring.util ──");
{
  assert("impactToScore: CRITICAL → 100",  impactToScore("CRITICAL") === 100);
  assert("impactToScore: HIGH → 60",       impactToScore("HIGH")     === 60);
  assert("impactToScore: MEDIUM → 30",     impactToScore("MEDIUM")   === 30);
  assert("impactToScore: LOW → 10",        impactToScore("LOW")      === 10);
  assert("scoreToImpact: 100 → CRITICAL",  scoreToImpact(100)        === "CRITICAL");
  assert("scoreToImpact: 60 → HIGH",       scoreToImpact(60)         === "HIGH");
  assert("scoreToImpact: 30 → MEDIUM",     scoreToImpact(30)         === "MEDIUM");
  assert("scoreToImpact: 5 → LOW",         scoreToImpact(5)          === "LOW");
  assert("clampScore: 120 → 100",          clampScore(120)           === 100);
  assert("clampScore: -5 → 0",             clampScore(-5)            === 0);
  assert("clampScore: 50 → 50",            clampScore(50)            === 50);
  assert("makeFindingId: format",          makeFindingId("cpu", 1).startsWith("cpu-"));
  resetSeq();
  assert("nextSeq: resets to 1",           makeFindingId("x", 1) === "x-0001");
}

// ─── performance/cpu-pattern.agent ───────────────────────────────────────────
console.log("\n── performance/cpu-pattern.agent ──");
{
  resetSeq();
  const findings = analyzeCpuPatterns(HIGH_CPU, [SYNC_FN, HEAVY_FN]);
  assert("cpu: has findings",              findings.length > 0);
  assert("cpu: category=CPU_PATTERN",      findings.every((f) => f.category === "CPU_PATTERN"));
  assert("cpu: high usage → CRITICAL",     findings.some((f) => f.impact === "CRITICAL"));
  assert("cpu: findings frozen",           Object.isFrozen(findings));
  assert("cpu: each finding frozen",       findings.every((f) => Object.isFrozen(f)));
  assert("cpu: evidence arrays frozen",    findings.every((f) => Object.isFrozen(f.evidence)));

  resetSeq();
  const noFind = analyzeCpuPatterns(LOW_CPU, [ASYNC_FN]);
  assert("cpu: low usage → 0 findings",    noFind.length === 0);

  resetSeq();
  const loopFind = analyzeCpuPatterns(LOW_CPU, [HEAVY_FN]);
  assert("cpu: heavy loop fn detected",    loopFind.some((f) => f.target.includes("processMatrix")));
}

// ─── performance/memory-pattern.agent ────────────────────────────────────────
console.log("\n── performance/memory-pattern.agent ──");
{
  resetSeq();
  const findings = analyzeMemoryPatterns(HIGH_MEM);
  assert("mem: has findings",              findings.length > 0);
  assert("mem: category=MEMORY_PATTERN",   findings.every((f) => f.category === "MEMORY_PATTERN"));
  assert("mem: heap → HIGH or CRITICAL",   findings.some((f) => f.impact === "HIGH" || f.impact === "CRITICAL"));
  assert("mem: external detected",         findings.some((f) => f.target.includes("external")));
  assert("mem: findings frozen",           Object.isFrozen(findings));

  resetSeq();
  const noFind = analyzeMemoryPatterns(LOW_MEM);
  assert("mem: low usage → 0 findings",    noFind.length === 0);
}

// ─── performance/latency-pattern.agent ───────────────────────────────────────
console.log("\n── performance/latency-pattern.agent ──");
{
  resetSeq();
  const findings = analyzeLatencyPatterns([SLOW_EP], [{ name: "db.query", valueMs: 2000, threshold: 300 }]);
  assert("latency: has findings",          findings.length > 0);
  assert("latency: LATENCY_PATTERN",       findings.every((f) => f.category === "LATENCY_PATTERN"));
  assert("latency: slow EP → CRITICAL",    findings.some((f) => f.impact === "CRITICAL"));
  assert("latency: metric breach found",   findings.some((f) => f.target.includes("db.query")));
  assert("latency: findings frozen",       Object.isFrozen(findings));

  resetSeq();
  const noFind = analyzeLatencyPatterns([FAST_EP], []);
  assert("latency: fast EP → 0 findings",  noFind.length === 0);
}

// ─── code-optimization/async-suggestion.agent ────────────────────────────────
console.log("\n── code-optimization/async-suggestion.agent ──");
{
  resetSeq();
  const findings = suggestAsyncRefactors([SYNC_FN, ASYNC_FN]);
  assert("async: has findings",            findings.length > 0);
  assert("async: ASYNC_SUGGESTION",        findings.every((f) => f.category === "ASYNC_SUGGESTION"));
  assert("async: targets SYNC_FN",         findings.some((f) => f.target.includes("loadData")));
  assert("async: skips ASYNC_FN",          !findings.some((f) => f.target.includes("fetchUser")));
  assert("async: CRITICAL for freq>50",    findings.some((f) => f.impact === "CRITICAL"));
  assert("async: findings frozen",         Object.isFrozen(findings));

  resetSeq();
  const noFind = suggestAsyncRefactors([ASYNC_FN]);
  assert("async: no sync fn → 0",          noFind.length === 0);
}

// ─── code-optimization/sync-blocking.agent ───────────────────────────────────
console.log("\n── code-optimization/sync-blocking.agent ──");
{
  resetSeq();
  const findings = detectSyncBlocking([SYNC_FN], [SLOW_EP]);
  assert("sync: has findings",             findings.length > 0);
  assert("sync: SYNC_BLOCKING",            findings.every((f) => f.category === "SYNC_BLOCKING"));
  assert("sync: SYNC_FN detected",         findings.some((f) => f.target.includes("loadData")));
  assert("sync: findings frozen",          Object.isFrozen(findings));

  resetSeq();
  const noFind = detectSyncBlocking([ASYNC_FN], [FAST_EP]);
  assert("sync: clean → 0",               noFind.length === 0);
}

// ─── code-optimization/worker-thread.agent ───────────────────────────────────
console.log("\n── code-optimization/worker-thread.agent ──");
{
  resetSeq();
  const findings = recommendWorkerThreads([HEAVY_FN], HIGH_CPU);
  assert("wt: has findings",               findings.length > 0);
  assert("wt: WORKER_THREAD",             findings.every((f) => f.category === "WORKER_THREAD"));
  assert("wt: targets processMatrix",      findings.some((f) => f.target.includes("processMatrix")));
  assert("wt: CRITICAL with high CPU",     findings.some((f) => f.impact === "CRITICAL"));
  assert("wt: findings frozen",            Object.isFrozen(findings));

  resetSeq();
  const noFind = recommendWorkerThreads([ASYNC_FN], LOW_CPU);
  assert("wt: small fn → 0",              noFind.length === 0);
}

// ─── code-optimization/caching-opportunity.agent ─────────────────────────────
console.log("\n── code-optimization/caching-opportunity.agent ──");
{
  resetSeq();
  const findings = detectCachingOpportunities([LOW_CACHE], [SLOW_EP]);
  assert("cache: has findings",            findings.length > 0);
  assert("cache: CACHING_OPPORTUNITY",     findings.every((f) => f.category === "CACHING_OPPORTUNITY"));
  assert("cache: low hit rate detected",   findings.some((f) => f.target.includes("api/search")));
  assert("cache: findings frozen",         Object.isFrozen(findings));

  resetSeq();
  const noFind = detectCachingOpportunities([HIGH_CACHE], [FAST_EP]);
  assert("cache: high hit rate → 0",       noFind.length === 0);
}

// ─── payload/payload-optimizer.agent ─────────────────────────────────────────
console.log("\n── payload/payload-optimizer.agent ──");
{
  resetSeq();
  const findings = analyzePayloadOptimization([BIG_RESP, SMALL_RESP]);
  assert("payload: has findings",          findings.length > 0);
  assert("payload: PAYLOAD_OPTIMIZATION",  findings.every((f) => f.category === "PAYLOAD_OPTIMIZATION"));
  assert("payload: big resp detected",     findings.some((f) => f.target.includes("api/data")));
  assert("payload: small resp skipped",    !findings.some((f) => f.target.includes("ping") && f.impact === "CRITICAL"));
  assert("payload: CRITICAL for >500KB",   findings.some((f) => f.impact === "CRITICAL"));
  assert("payload: findings frozen",       Object.isFrozen(findings));

  resetSeq();
  const noFind = analyzePayloadOptimization([SMALL_RESP]);
  assert("payload: small → 0",             noFind.length === 0);
}

// ─── ranking/impact-ranker ────────────────────────────────────────────────────
console.log("\n── ranking/impact-ranker ──");
{
  resetSeq();
  const fakeFinding = (id: string, impact: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW") =>
    Object.freeze({
      findingId: id, category: "CPU_PATTERN" as const,
      target: "runtime.cpu", description: "desc", impact,
      score: impactToScore(impact), evidence: Object.freeze([]),
    });

  const findings = [
    fakeFinding("f3", "LOW"),
    fakeFinding("f1", "CRITICAL"),
    fakeFinding("f2", "HIGH"),
  ];
  const ranked = rankSuggestions(findings);

  assert("rank: length=3",                 ranked.length === 3);
  assert("rank: first is CRITICAL",        ranked[0]!.impact === "CRITICAL");
  assert("rank: second is HIGH",           ranked[1]!.impact === "HIGH");
  assert("rank: third is LOW",             ranked[2]!.impact === "LOW");
  assert("rank: rank numbers 1,2,3",       ranked[0]!.rank === 1 && ranked[1]!.rank === 2);
  assert("rank: result frozen",            Object.isFrozen(ranked));
  assert("rank: each suggestion frozen",   ranked.every((r) => Object.isFrozen(r)));
  assert("rank: effort fields present",    ranked.every((r) => ["LOW","MEDIUM","HIGH"].includes(r.effort)));

  const summary = buildSummary(findings);
  assert("summary: totalFindings=3",       summary.totalFindings === 3);
  assert("summary: criticalCount=1",       summary.criticalCount === 1);
  assert("summary: highCount=1",           summary.highCount     === 1);
  assert("summary: lowCount=1",            summary.lowCount      === 1);
  assert("summary: overallScore>0",        summary.overallScore  > 0);
  assert("summary: frozen",               Object.isFrozen(summary));
  assert("summary: priorityFocus set",     summary.priorityFocus.length > 0);
  assert("summary: topCategory set",       summary.topCategory !== undefined);

  const empty = buildSummary([]);
  assert("summary empty: total=0",         empty.totalFindings === 0);
  assert("summary empty: topCategory null",empty.topCategory === null);
}

// ─── orchestrator: analyze (full integration) ─────────────────────────────────
console.log("\n── orchestrator: analyze (full integration) ──");
{
  clearAll(); resetCounter(); resetSeq();

  const report = analyze(
    makeRuntime({ cpu: HIGH_CPU, memory: HIGH_MEM, endpoints: Object.freeze([SLOW_EP]) }),
    makeCode({ functions: Object.freeze([SYNC_FN, HEAVY_FN]), responses: Object.freeze([BIG_RESP]),
               caches: Object.freeze([LOW_CACHE]) }),
  );

  assert("integration: report frozen",          Object.isFrozen(report));
  assert("integration: findings frozen",        Object.isFrozen(report.findings));
  assert("integration: rankedSuggestions frozen",Object.isFrozen(report.rankedSuggestions));
  assert("integration: summary frozen",         Object.isFrozen(report.summary));
  assert("integration: has findings",           report.findings.length > 0);
  assert("integration: has ranked",             report.rankedSuggestions.length > 0);
  assert("integration: ranked count = finding count",
    report.rankedSuggestions.length === report.findings.length);
  assert("integration: rank[0] is highest",     report.rankedSuggestions[0]!.rank === 1);
  assert("integration: criticalCount > 0",      report.summary.criticalCount > 0);
  assert("integration: reportId set",           report.reportId.startsWith("opt-"));
  assert("integration: analyzedAt > 0",         report.analyzedAt > 0);
  assert("integration: each finding frozen",    report.findings.every((f) => Object.isFrozen(f)));
  assert("integration: each ranked frozen",     report.rankedSuggestions.every((r) => Object.isFrozen(r)));
}

// ─── analyzeRuntime ───────────────────────────────────────────────────────────
console.log("\n── analyzeRuntime ──");
{
  clearAll(); resetCounter(); resetSeq();
  const r = analyzeRuntime(makeRuntime({ cpu: HIGH_CPU, endpoints: Object.freeze([SLOW_EP]) }));
  assert("analyzeRuntime: report frozen",      Object.isFrozen(r));
  assert("analyzeRuntime: has findings",       r.findings.length > 0);
  assert("analyzeRuntime: LATENCY finding",    r.findings.some((f) => f.category === "LATENCY_PATTERN"));
  assert("analyzeRuntime: CPU finding",        r.findings.some((f) => f.category === "CPU_PATTERN"));
}

// ─── analyzeCode ─────────────────────────────────────────────────────────────
console.log("\n── analyzeCode ──");
{
  clearAll(); resetCounter(); resetSeq();
  const r = analyzeCode(makeCode({
    functions: Object.freeze([SYNC_FN]),
    responses: Object.freeze([BIG_RESP]),
    caches:    Object.freeze([LOW_CACHE]),
  }));
  assert("analyzeCode: report frozen",         Object.isFrozen(r));
  assert("analyzeCode: ASYNC_SUGGESTION",      r.findings.some((f) => f.category === "ASYNC_SUGGESTION"));
  assert("analyzeCode: PAYLOAD finding",       r.findings.some((f) => f.category === "PAYLOAD_OPTIMIZATION"));
  assert("analyzeCode: CACHING finding",       r.findings.some((f) => f.category === "CACHING_OPPORTUNITY"));
}

// ─── invalid input ────────────────────────────────────────────────────────────
console.log("\n── invalid input ──");
{
  clearAll(); resetCounter(); resetSeq();
  const r = analyze(null as any, null as any);
  assert("invalid: report frozen",             Object.isFrozen(r));
  assert("invalid: 0 findings",               r.findings.length === 0);
  assert("invalid: 0 ranked",                 r.rankedSuggestions.length === 0);
  assert("invalid: totalFindings=0",          r.summary.totalFindings === 0);

  const r2 = analyze(makeRuntime(), null as any);
  assert("invalid code: frozen",              Object.isFrozen(r2));
  assert("invalid code: 0 findings",          r2.findings.length === 0);
}

// ─── determinism ─────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const input = {
    runtime: makeRuntime({ cpu: HIGH_CPU, endpoints: Object.freeze([SLOW_EP]) }),
    code:    makeCode({ functions: Object.freeze([SYNC_FN]) }),
  };

  clearAll(); resetCounter(); resetSeq();
  const r1 = analyze(input.runtime, input.code);

  clearAll(); resetCounter(); resetSeq();
  const r2 = analyze(input.runtime, input.code);

  assert("determinism: findings count",        r1.findings.length === r2.findings.length);
  assert("determinism: ranked count",          r1.rankedSuggestions.length === r2.rankedSuggestions.length);
  assert("determinism: rank[0] category",      r1.rankedSuggestions[0]?.category === r2.rankedSuggestions[0]?.category);
  assert("determinism: overallScore",          r1.summary.overallScore === r2.summary.overallScore);
  assert("determinism: criticalCount",         r1.summary.criticalCount === r2.summary.criticalCount);
}

// ─── clean pass with no issues ────────────────────────────────────────────────
console.log("\n── clean system (no findings) ──");
{
  clearAll(); resetCounter(); resetSeq();
  const r = analyze(makeRuntime(), makeCode());
  assert("clean: report frozen",               Object.isFrozen(r));
  assert("clean: 0 findings",                  r.findings.length === 0);
  assert("clean: 0 ranked",                    r.rankedSuggestions.length === 0);
  assert("clean: severity=0",                  r.summary.overallScore === 0);
  assert("clean: priorityFocus set",           r.summary.priorityFocus.length > 0);
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

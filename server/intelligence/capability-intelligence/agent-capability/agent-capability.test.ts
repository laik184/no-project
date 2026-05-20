import {
  buildCapabilityMatrix, buildMany, resetOrchestrator,
  getLatestMatrix, getMatrixHistory,
} from "./index.js";
import type {
  CapabilityInput, AgentDescriptor, AgentCapabilityMatrix,
} from "./index.js";
import { clearAll, getSession } from "./state.js";
import { resetCounters, sanitizeId, sanitizeName, normalizeToken } from "./utils/id.util.js";
import {
  classifyAgentType, classifyChannel, isKnownType,
  typeLabel, groupByType,
} from "./utils/type.util.js";
import { scanRegistry }   from "./agents/registry-scanner.agent.js";
import { evaluateStatus, filterActive, countByStatus } from "./agents/status-evaluator.agent.js";
import { mapVersions, latestVersion, filterValidVersions } from "./agents/version-mapper.agent.js";
import { buildMatrix, operationalCapabilities, capabilitiesByType } from "./agents/capability-builder.agent.js";
import type { AgentScanResult, EvaluatedStatus, MappedVersion } from "./types.js";

let passed = 0;
let failed = 0;

function assert(label: string, cond: boolean): void {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void {
  clearAll();
  resetCounters();
}

function desc(
  id:      string,
  name:    string,
  opts:    Partial<Omit<AgentDescriptor, "id" | "name">> = {},
): AgentDescriptor {
  return Object.freeze({ id, name, ...opts });
}

function ci(
  agents:      AgentDescriptor[],
  scanContext?: string,
): CapabilityInput {
  return Object.freeze({ agents: Object.freeze(agents), ...(scanContext ? { scanContext } : {}) });
}

reset();

// ─── utils/id.helper ──────────────────────────────────────────────────────────
console.log("\n── utils/id.helper ──");
{
  assert("sanitizeId: normal",            sanitizeId("agent-001")   === "agent-001");
  assert("sanitizeId: spaces → _",        sanitizeId("my agent")    === "my_agent");
  assert("sanitizeId: empty → UNKNOWN",   sanitizeId("")             === "UNKNOWN");
  assert("sanitizeId: null → UNKNOWN",    sanitizeId(null)           === "UNKNOWN");
  assert("sanitizeId: number → UNKNOWN",  sanitizeId(42)             === "UNKNOWN");
  assert("sanitizeId: trims",             sanitizeId("  id  ")       === "id");

  assert("sanitizeName: normal",          sanitizeName("My Agent")   === "My Agent");
  assert("sanitizeName: empty → default", sanitizeName("").includes("Unnamed"));
  assert("sanitizeName: null → default",  sanitizeName(null).includes("Unnamed"));
  assert("sanitizeName: trims",           sanitizeName("  Agent  ")  === "Agent");

  assert("normalizeToken: lowercases",    normalizeToken("ACTIVE")   === "active");
  assert("normalizeToken: trims",         normalizeToken("  x  ")    === "x");
  assert("normalizeToken: non-str → ''",  normalizeToken(null)       === "");
}

// ─── utils/type.helper ────────────────────────────────────────────────────────
console.log("\n── utils/type.helper ──");
{
  assert("classifyType: analyzer",        classifyAgentType("analyzer")        === "ANALYZER");
  assert("classifyType: drift-analyzer",  classifyAgentType("drift-analyzer")  === "ANALYZER");
  assert("classifyType: validator",       classifyAgentType("validator")        === "VALIDATOR");
  assert("classifyType: detector",        classifyAgentType("detector")         === "DETECTOR");
  assert("classifyType: mapper",          classifyAgentType("mapper")           === "MAPPER");
  assert("classifyType: builder",         classifyAgentType("builder")          === "BUILDER");
  assert("classifyType: orchestrator",    classifyAgentType("orchestrator")     === "ORCHESTRATOR");
  assert("classifyType: scanner",         classifyAgentType("scanner")          === "SCANNER");
  assert("classifyType: reporter",        classifyAgentType("reporter")         === "REPORTER");
  assert("classifyType: classifier",      classifyAgentType("classifier")       === "CLASSIFIER");
  assert("classifyType: unknown",         classifyAgentType("random-thing")     === "UNKNOWN");
  assert("classifyType: empty",           classifyAgentType("")                  === "UNKNOWN");
  assert("classifyType: null",            classifyAgentType(null)               === "UNKNOWN");

  assert("classifyChannel: stable",       classifyChannel("1.2.3")             === "stable");
  assert("classifyChannel: beta",         classifyChannel("1.0.0-beta")        === "beta");
  assert("classifyChannel: alpha",        classifyChannel("0.1.0-preview")     === "alpha");
  assert("classifyChannel: deprecated",   classifyChannel("2.0.0-deprecated")  === "deprecated");
  assert("classifyChannel: rc→beta",      classifyChannel("1.0.0-rc.1")        === "beta");

  assert("isKnownType: ANALYZER",         isKnownType("ANALYZER"));
  assert("isKnownType: UNKNOWN",          isKnownType("UNKNOWN"));
  assert("isKnownType: random → false",   !isKnownType("RANDOM"));
  assert("isKnownType: null → false",     !isKnownType(null));

  assert("typeLabel: ANALYZER",           typeLabel("ANALYZER")   === "Analyzer");
  assert("typeLabel: SCANNER",            typeLabel("SCANNER")    === "Scanner");
  assert("typeLabel: UNKNOWN",            typeLabel("UNKNOWN")    === "Unknown");

  const items = [
    { type: "ANALYZER" as const }, { type: "SCANNER" as const },
    { type: "ANALYZER" as const }, { type: "UNKNOWN" as const },
  ];
  const grouped = groupByType(items);
  assert("groupByType: frozen",           Object.isFrozen(grouped));
  assert("groupByType: ANALYZER=2",       grouped["ANALYZER"]!.length === 2);
  assert("groupByType: SCANNER=1",        grouped["SCANNER"]!.length  === 1);
  assert("groupByType: arrays frozen",    Object.isFrozen(grouped["ANALYZER"]));
}

// ─── registry-scanner ─────────────────────────────────────────────────────────
console.log("\n── registry-scanner ──");
{
  const inp = ci([
    desc("a1", "Config Analyzer", { type:"analyzer", version:"2.1.4", status:"active", tags:["config"], registeredAt:1000 }),
    desc("a2", "Port Validator",  { type:"validator", version:"1.0.0-beta", status:"degraded" }),
    desc("a3", "Image Scanner",   { type:"scanner",   version:"3.0.2",     status:"inactive" }),
  ]);

  const scans = scanRegistry(inp);
  assert("scan: frozen",                Object.isFrozen(scans));
  assert("scan: length=3",             scans.length === 3);
  assert("scan: a1 id",                scans[0]!.agentId === "a1");
  assert("scan: a1 name",              scans[0]!.name    === "Config Analyzer");
  assert("scan: a1 rawType",           scans[0]!.rawType === "analyzer");
  assert("scan: a1 version",           scans[0]!.rawVersion === "2.1.4");
  assert("scan: a1 status",            scans[0]!.rawStatus  === "active");
  assert("scan: a1 tags",              scans[0]!.tags.includes("config"));
  assert("scan: a1 registeredAt",      scans[0]!.registeredAt === 1000);
  assert("scan: scannedAt>0",          scans[0]!.scannedAt > 0);
  assert("scan: each frozen",          scans.every((s) => Object.isFrozen(s)));
  assert("scan: tags frozen",          Object.isFrozen(scans[0]!.tags));

  assert("scan: null → []",            scanRegistry(null as any).length === 0);
  assert("scan: no agents → []",       scanRegistry({ agents: [] }).length === 0);

  const invalid = scanRegistry(ci([
    { id: "", name: "bad" } as AgentDescriptor,
    desc("ok", "Good"),
  ]));
  assert("scan: skips invalid id",     invalid.length === 1 && invalid[0]!.agentId === "ok");

  const noTags = scanRegistry(ci([desc("x", "X")]));
  assert("scan: no tags → []",         noTags[0]!.tags.length === 0);
  assert("scan: default version",      noTags[0]!.rawVersion === "0.0.0");
  assert("scan: default status",       noTags[0]!.rawStatus  === "unknown");
}

// ─── status-evaluator ─────────────────────────────────────────────────────────
console.log("\n── status-evaluator ──");
{
  function fakeScans(entries: Array<[string, string]>): readonly AgentScanResult[] {
    return Object.freeze(entries.map(([id, status]) => Object.freeze({
      agentId: id, name: id, rawType: "t", rawVersion: "1.0.0",
      rawStatus: status, tags: Object.freeze([]), registeredAt: 0, scannedAt: Date.now(),
    })));
  }

  const scans = fakeScans([
    ["a1","active"], ["a2","running"], ["a3","online"],
    ["b1","inactive"], ["b2","stopped"], ["b3","down"],
    ["c1","degraded"], ["c2","warning"],
    ["d1","???"],
  ]);

  const statuses = evaluateStatus(scans);
  assert("eval: frozen",               Object.isFrozen(statuses));
  assert("eval: length=9",             statuses.length === 9);
  assert("eval: active=active",        statuses[0]!.status   === "active");
  assert("eval: active isActive",      statuses[0]!.isActive === true);
  assert("eval: running=active",       statuses[1]!.status   === "active");
  assert("eval: online=active",        statuses[2]!.status   === "active");
  assert("eval: inactive=inactive",    statuses[3]!.status   === "inactive");
  assert("eval: stopped=inactive",     statuses[4]!.status   === "inactive");
  assert("eval: down=inactive",        statuses[5]!.status   === "inactive");
  assert("eval: degraded=degraded",    statuses[6]!.status   === "degraded");
  assert("eval: warning=degraded",     statuses[7]!.status   === "degraded");
  assert("eval: unknown=unknown",      statuses[8]!.status   === "unknown");
  assert("eval: inactive !isActive",   statuses[3]!.isActive === false);
  assert("eval: each frozen",          statuses.every((s) => Object.isFrozen(s)));
  assert("eval: statusReason set",     statuses[0]!.statusReason.length > 0);

  assert("eval: null → []",            evaluateStatus(null as any).length === 0);

  const active = filterActive(statuses);
  assert("filterActive: frozen",       Object.isFrozen(active));
  assert("filterActive: count=3",      active.length === 3);

  const counts = countByStatus(statuses);
  assert("counts: frozen",             Object.isFrozen(counts));
  assert("counts: active=3",           counts.active   === 3);
  assert("counts: inactive=3",         counts.inactive === 3);
  assert("counts: degraded=2",         counts.degraded === 2);
  assert("counts: unknown=1",          counts.unknown  === 1);
}

// ─── version-mapper ───────────────────────────────────────────────────────────
console.log("\n── version-mapper ──");
{
  function fakeVersionScans(entries: Array<[string, string]>): readonly AgentScanResult[] {
    return Object.freeze(entries.map(([id, ver]) => Object.freeze({
      agentId: id, name: id, rawType: "t", rawVersion: ver,
      rawStatus: "active", tags: Object.freeze([]), registeredAt: 0, scannedAt: Date.now(),
    })));
  }

  const scans = fakeVersionScans([
    ["v1","2.1.4"],
    ["v2","1.0.0-beta"],
    ["v3","0.9.0"],
    ["v4","3.0.0-deprecated"],
    ["v5","not-a-version"],
    ["v6","1.24"],
    ["v7","v1.2.3"],
  ]);

  const mapped = mapVersions(scans);
  assert("map: frozen",                 Object.isFrozen(mapped));
  assert("map: length=7",              mapped.length === 7);
  assert("map: 2.1.4 stable",          mapped[0]!.channel === "stable");
  assert("map: 2.1.4 major=2",         mapped[0]!.major   === 2);
  assert("map: 2.1.4 minor=1",         mapped[0]!.minor   === 1);
  assert("map: 2.1.4 patch=4",         mapped[0]!.patch   === 4);
  assert("map: 2.1.4 isValid",         mapped[0]!.isValid === true);
  assert("map: beta channel",          mapped[1]!.channel === "beta");
  assert("map: 0.x → deprecated",      mapped[2]!.channel === "deprecated");
  assert("map: deprecated channel",     mapped[3]!.channel === "deprecated");
  assert("map: invalid → !isValid",     mapped[4]!.isValid === false);
  assert("map: 1.24 minor=24",          mapped[5]!.minor   === 24);
  assert("map: 1.24 patch=0",           mapped[5]!.patch   === 0);
  assert("map: v prefix stripped",      mapped[6]!.major   === 1);
  assert("map: each frozen",            mapped.every((v) => Object.isFrozen(v)));

  assert("map: null → []",             mapVersions(null as any).length === 0);

  const valid = filterValidVersions(mapped);
  assert("filterValid: frozen",         Object.isFrozen(valid));
  assert("filterValid: excludes bad",   !valid.some((v) => !v.isValid));

  const latest = latestVersion(mapped.filter((v) => v.isValid));
  assert("latestVersion: highest",      latest!.major >= 2);
  assert("latestVersion: null on []",   latestVersion([]) === null);
}

// ─── capability-builder ───────────────────────────────────────────────────────
console.log("\n── capability-builder ──");
{
  reset();

  function mkScans(): readonly AgentScanResult[] {
    return Object.freeze([
      Object.freeze({ agentId:"s1", name:"Drift Analyzer", rawType:"analyzer",  rawVersion:"2.0.0", rawStatus:"active",   tags:Object.freeze(["config"]), registeredAt:1000, scannedAt:2000 }),
      Object.freeze({ agentId:"s2", name:"Port Validator", rawType:"validator", rawVersion:"1.0.0-beta", rawStatus:"degraded", tags:Object.freeze([]), registeredAt:0, scannedAt:2000 }),
      Object.freeze({ agentId:"s3", name:"Image Scanner",  rawType:"scanner",   rawVersion:"3.0.0", rawStatus:"inactive", tags:Object.freeze([]), registeredAt:0, scannedAt:2000 }),
    ]);
  }

  function mkStatuses(): readonly EvaluatedStatus[] {
    return Object.freeze([
      Object.freeze({ agentId:"s1", status:"active"   as const, isActive:true,  statusReason:"active" }),
      Object.freeze({ agentId:"s2", status:"degraded" as const, isActive:false, statusReason:"degraded" }),
      Object.freeze({ agentId:"s3", status:"inactive" as const, isActive:false, statusReason:"inactive" }),
    ]);
  }

  function mkVersions(): readonly MappedVersion[] {
    return Object.freeze([
      Object.freeze({ agentId:"s1", version:"2.0.0", channel:"stable"     as const, major:2, minor:0, patch:0, isValid:true }),
      Object.freeze({ agentId:"s2", version:"1.0.0-beta", channel:"beta"  as const, major:1, minor:0, patch:0, isValid:true }),
      Object.freeze({ agentId:"s3", version:"3.0.0", channel:"stable"     as const, major:3, minor:0, patch:0, isValid:true }),
    ]);
  }

  const matrix = buildMatrix(mkScans(), mkStatuses(), mkVersions());
  assert("matrix: frozen",             Object.isFrozen(matrix));
  assert("matrix: caps frozen",        Object.isFrozen(matrix.capabilities));
  assert("matrix: byType frozen",      Object.isFrozen(matrix.byType));
  assert("matrix: totalAgents=3",      matrix.totalAgents   === 3);
  assert("matrix: activeCount=1",      matrix.activeCount   === 1);
  assert("matrix: inactiveCount=1",    matrix.inactiveCount === 1);
  assert("matrix: matrixId set",       matrix.matrixId.startsWith("acm-"));
  assert("matrix: generatedAt>0",      matrix.generatedAt > 0);
  assert("matrix: summary agents",     matrix.summary.includes("3 agent"));
  assert("matrix: each cap frozen",    matrix.capabilities.every((c) => Object.isFrozen(c)));

  const s1 = matrix.capabilities.find((c) => c.agentId === "s1")!;
  assert("cap: s1 type=ANALYZER",      s1.type          === "ANALYZER");
  assert("cap: s1 isOperational",      s1.isOperational === true);
  assert("cap: s1 tags=[config]",      s1.tags.includes("config"));

  const s2 = matrix.capabilities.find((c) => c.agentId === "s2")!;
  assert("cap: s2 !isOperational",     s2.isOperational === false);
  assert("cap: s2 type=VALIDATOR",     s2.type          === "VALIDATOR");

  assert("matrix: byType.ANALYZER",   (matrix.byType["ANALYZER"]?.length ?? 0) === 1);
  assert("matrix: byType.SCANNER",    (matrix.byType["SCANNER"]?.length  ?? 0) === 1);

  const operational = operationalCapabilities(matrix);
  assert("operational: frozen",        Object.isFrozen(operational));
  assert("operational: count=1",       operational.length === 1);
  assert("operational: s1 only",       operational[0]!.agentId === "s1");

  const byType = capabilitiesByType(matrix, "SCANNER");
  assert("byType: frozen",             Object.isFrozen(byType));
  assert("byType: count=1",            byType.length === 1);

  assert("matrix: empty → 0",          buildMatrix([], [], []).totalAgents === 0);
  assert("matrix: null → 0",           buildMatrix(null as any, [], []).totalAgents === 0);
}

// ─── orchestrator: empty ──────────────────────────────────────────────────────
console.log("\n── orchestrator: empty ──");
{
  reset();
  const m = buildCapabilityMatrix(ci([]));
  assert("empty: frozen",              Object.isFrozen(m));
  assert("empty: totalAgents=0",       m.totalAgents === 0);
  assert("empty: caps empty",          m.capabilities.length === 0);
  assert("empty: byType empty",        Object.keys(m.byType).length === 0);
  assert("empty: hasSummary",          m.summary.includes("No agents"));
  assert("empty: session=COMPLETE",    getSession()?.stage === "COMPLETE");
}

// ─── orchestrator: full registry ──────────────────────────────────────────────
console.log("\n── orchestrator: full ──");
{
  reset();
  const m = buildCapabilityMatrix(ci([
    desc("a1","Config Drift Analyzer",{ type:"analyzer",   version:"2.1.4",      status:"active",   tags:["config","drift"], registeredAt:1000 }),
    desc("a2","Port Validator",        { type:"validator",  version:"1.0.0-beta", status:"degraded" }),
    desc("a3","Image Scanner",         { type:"scanner",    version:"3.0.2",      status:"inactive" }),
    desc("a4","Report Builder",        { type:"builder",    version:"0.5.0",      status:"active"  }),
    desc("a5","Multi Agent Classifier",{ type:"classifier", version:"1.1.0",      status:"running" }),
  ], "full-scan"));

  assert("full: frozen",               Object.isFrozen(m));
  assert("full: caps frozen",          Object.isFrozen(m.capabilities));
  assert("full: totalAgents=5",        m.totalAgents === 5);
  assert("full: activeCount>=2",       m.activeCount >= 2);
  assert("full: summary drift",        m.summary.includes("agent(s)"));
  assert("full: matrixId idr-prefix",  m.matrixId.startsWith("acm-"));
  assert("full: ANALYZER in byType",   "ANALYZER"   in m.byType);
  assert("full: SCANNER in byType",    "SCANNER"    in m.byType);
  assert("full: CLASSIFIER in byType", "CLASSIFIER" in m.byType);
  assert("full: session COMPLETE",     getSession()?.stage === "COMPLETE");

  const a1 = m.capabilities.find((c) => c.agentId === "a1")!;
  assert("full: a1 type=ANALYZER",     a1.type          === "ANALYZER");
  assert("full: a1 isOperational",     a1.isOperational === true);
  assert("full: a1 ch=stable",         a1.version.channel === "stable");
  assert("full: a1 tags",              a1.tags.includes("config"));

  const a4 = m.capabilities.find((c) => c.agentId === "a4")!;
  assert("full: a4 ch=deprecated",     a4.version.channel === "deprecated");
  assert("full: a4 !operational",      a4.isOperational   === false);

  const a5 = m.capabilities.find((c) => c.agentId === "a5")!;
  assert("full: a5 type=CLASSIFIER",   a5.type === "CLASSIFIER");
  assert("full: a5 running=active",    a5.status.isActive === true);
}

// ─── orchestrator: invalid ────────────────────────────────────────────────────
console.log("\n── orchestrator: invalid ──");
{
  reset();
  const r1 = buildCapabilityMatrix(null as any);
  assert("invalid: frozen",            Object.isFrozen(r1));
  assert("invalid: totalAgents=0",     r1.totalAgents === 0);
  assert("invalid: summary invalid",   r1.summary.includes("Invalid"));

  const r2 = buildCapabilityMatrix({} as any);
  assert("invalid: {} → frozen",       Object.isFrozen(r2));

  const r3 = buildCapabilityMatrix(ci([
    { id: "", name: "bad" } as AgentDescriptor,
    { id: "", name: "bad2" } as AgentDescriptor,
  ]));
  assert("all-invalid: totalAgents=0", r3.totalAgents === 0);
}

// ─── buildMany ────────────────────────────────────────────────────────────────
console.log("\n── buildMany ──");
{
  reset();
  const results = buildMany([
    ci([desc("a1","Analyzer",{ type:"analyzer", version:"1.0.0", status:"active" })]),
    ci([desc("b1","Validator",{ type:"validator", version:"2.0.0", status:"inactive" })]),
    ci([]),
  ]);

  assert("batch: frozen",              Object.isFrozen(results));
  assert("batch: length=3",            results.length === 3);
  assert("batch: r1 has agent",        results[0]!.totalAgents === 1);
  assert("batch: r2 has agent",        results[1]!.totalAgents === 1);
  assert("batch: r3 empty",            results[2]!.totalAgents === 0);
  assert("batch: each frozen",         results.every((r) => Object.isFrozen(r)));

  assert("batch: null → []",           buildMany(null as any).length === 0);
  assert("batch: [] → []",             buildMany([]).length === 0);
}

// ─── state: history ───────────────────────────────────────────────────────────
console.log("\n── state: history ──");
{
  reset();
  assert("state: no matrix → null",    getLatestMatrix() === null);
  assert("state: no history → []",     getMatrixHistory().length === 0);

  buildCapabilityMatrix(ci([desc("x1","X1",{ type:"scanner", version:"1.0.0", status:"active" })]));
  buildCapabilityMatrix(ci([desc("x2","X2",{ type:"analyzer", version:"2.0.0", status:"active" })]));

  const last = getLatestMatrix();
  assert("state: latest frozen",        Object.isFrozen(last));
  assert("state: latest has x2",        last?.capabilities.some((c) => c.agentId === "x2"));

  const hist = getMatrixHistory();
  assert("state: history frozen",       Object.isFrozen(hist));
  assert("state: length=2",             hist.length === 2);
}

// ─── determinism ──────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const agents = [
    desc("d1","Drift Analyzer",{ type:"analyzer",  version:"2.1.4", status:"active",   tags:["config"] }),
    desc("d2","Port Validator", { type:"validator", version:"1.0.0", status:"inactive" }),
    desc("d3","Image Scanner",  { type:"scanner",   version:"3.0.2", status:"running"  }),
  ];
  const inp = ci(agents, "determinism-test");

  reset(); const m1 = buildCapabilityMatrix(inp);
  reset(); const m2 = buildCapabilityMatrix(inp);

  assert("det: same total",              m1.totalAgents    === m2.totalAgents);
  assert("det: same activeCount",        m1.activeCount    === m2.activeCount);
  assert("det: same inactiveCount",      m1.inactiveCount  === m2.inactiveCount);
  assert("det: same caps length",        m1.capabilities.length === m2.capabilities.length);
  assert("det: same summary",            m1.summary === m2.summary);
  assert("det: same byType keys",
    Object.keys(m1.byType).sort().join(",") === Object.keys(m2.byType).sort().join(","));
  assert("det: same types",
    m1.capabilities.map((c) => c.type).join(",") === m2.capabilities.map((c) => c.type).join(","));
  assert("det: same channels",
    m1.capabilities.map((c) => c.version.channel).join(",") ===
    m2.capabilities.map((c) => c.version.channel).join(","));
  assert("det: same operational",
    m1.capabilities.map((c) => c.isOperational).join(",") ===
    m2.capabilities.map((c) => c.isOperational).join(","));
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

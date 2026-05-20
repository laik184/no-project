import {
  runDiscovery, runMany, resetCounter,
  getLastSnapshot, getSnapshotHistory,
} from "./index.js";
import type {
  DiscoveryInput, DiscoverySource, DiscoverySnapshot,
} from "./index.js";
import { clearAll, getSession, getRawResult, getSourceSummary } from "./state.js";
import { normalizeId, normalizeName, normalizeSlug, normalizeTags, normalizeVersion, normalizePlatform, normalizeProtocol, normalizeExtension, metaString } from "./utils/normalizer.util.js";
import { dedupeById, dedupeByName, dedupeByIdAndName, dedupeStrings, hasId } from "./utils/dedupe.util.js";
import { discoverAgents, agentsByDomain, agentDomains } from "./agents/agent-discovery.agent.js";
import { discoverRuntimes, runtimesByPlatform, runtimePlatforms } from "./agents/runtime-discovery.agent.js";
import { discoverIntegrations, integrationsByType, integrationTypes } from "./agents/integration-discovery.agent.js";
import { discoverDeployments, deploymentsByTarget, deploymentTargets } from "./agents/deployment-discovery.agent.js";
import { discoverLanguages, languagesByEcosystem, languageEcosystems, languageExtensions } from "./agents/language-discovery.agent.js";

let passed = 0;
let failed = 0;

function assert(label: string, cond: boolean): void {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

function reset(): void { clearAll(); resetCounter(); }

function src(
  kind:     DiscoverySource["kind"],
  id:       string,
  name:     string,
  metadata: Record<string, unknown> = {},
): DiscoverySource {
  return Object.freeze({ kind, id, name, metadata: Object.freeze(metadata) });
}

function inp(sources: DiscoverySource[], context?: string): DiscoveryInput {
  return Object.freeze({ sources: Object.freeze(sources), ...(context ? { context } : {}) });
}

reset();

// ─── utils/normalizer ──────────────────────────────────────────────────────────
console.log("\n── utils/normalizer ──");
{
  assert("normalizeId: valid",         normalizeId("agent-001") === "agent-001");
  assert("normalizeId: spaces→_",      normalizeId("my agent")  === "my_agent");
  assert("normalizeId: empty→UNKNOWN", normalizeId("")           === "UNKNOWN");
  assert("normalizeId: null→UNKNOWN",  normalizeId(null)         === "UNKNOWN");
  assert("normalizeId: trims",         normalizeId("  x  ")      === "x");

  assert("normalizeName: valid",       normalizeName("My Agent")  === "My Agent");
  assert("normalizeName: empty→def",   normalizeName("").includes("Unnamed"));
  assert("normalizeName: null→def",    normalizeName(null).includes("Unnamed"));
  assert("normalizeName: trims",       normalizeName("  X  ")     === "X");

  assert("normalizeSlug: spaces",      normalizeSlug("Hello World") === "hello-world");
  assert("normalizeSlug: upper",       normalizeSlug("Config")      === "config");
  assert("normalizeSlug: empty→unk",   normalizeSlug("")            === "unknown");
  assert("normalizeSlug: null→unk",    normalizeSlug(null)          === "unknown");
  assert("normalizeSlug: special",     normalizeSlug("a!b@c")       === "abc");

  assert("normalizeTags: array",       normalizeTags(["A","B"]).length === 2);
  assert("normalizeTags: lowercase",   normalizeTags(["TAG"])[0] === "tag");
  assert("normalizeTags: empty→[]",    normalizeTags([]).length === 0);
  assert("normalizeTags: null→[]",     normalizeTags(null).length === 0);
  assert("normalizeTags: skip empty",  normalizeTags(["","x"]).length === 1);

  assert("normalizeVersion: valid",    normalizeVersion("1.2.3")    === "1.2.3");
  assert("normalizeVersion: v-prefix", normalizeVersion("v2.0.0")   === "2.0.0");
  assert("normalizeVersion: empty",    normalizeVersion("")          === "0.0.0");
  assert("normalizeVersion: null",     normalizeVersion(null)        === "0.0.0");

  assert("normalizePlatform: upper",   normalizePlatform("Linux")  === "linux");
  assert("normalizePlatform: empty",   normalizePlatform("")        === "generic");
  assert("normalizePlatform: null",    normalizePlatform(null)      === "generic");

  assert("normalizeProtocol: upper",   normalizeProtocol("REST")   === "rest");
  assert("normalizeProtocol: empty",   normalizeProtocol("")        === "unknown");

  assert("normalizeExt: adds dot",     normalizeExtension("ts")    === ".ts");
  assert("normalizeExt: keeps dot",    normalizeExtension(".ts")   === ".ts");
  assert("normalizeExt: empty",        normalizeExtension("")      === ".unknown");
  assert("normalizeExt: null",         normalizeExtension(null)    === ".unknown");
  assert("normalizeExt: uppercase",    normalizeExtension("TS")    === ".ts");

  assert("metaString: found",          metaString({ a: "x" }, "a") === "x");
  assert("metaString: missing",        metaString({}, "a") === undefined);
  assert("metaString: undef meta",     metaString(undefined, "a") === undefined);
}

// ─── utils/dedupe ──────────────────────────────────────────────────────────────
console.log("\n── utils/dedupe ──");
{
  const items = [
    Object.freeze({ id:"1", name:"Alpha" }),
    Object.freeze({ id:"2", name:"Beta"  }),
    Object.freeze({ id:"1", name:"Alpha" }),
    Object.freeze({ id:"3", name:"alpha" }),
  ];

  const byId = dedupeById(items);
  assert("dedupeById: frozen",         Object.isFrozen(byId));
  assert("dedupeById: length=3",       byId.length === 3);
  assert("dedupeById: keeps first",    byId[0]!.id === "1");

  const byName = dedupeByName(items);
  assert("dedupeByName: frozen",       Object.isFrozen(byName));
  assert("dedupeByName: case-insens",  byName.length === 2);

  const both = dedupeByIdAndName(items);
  assert("dedupeByIdAndName: frozen",  Object.isFrozen(both));
  assert("dedupeByIdAndName: len=2",   both.length === 2);

  const strs = dedupeStrings(["a","b","a","c","b"]);
  assert("dedupeStrings: frozen",      Object.isFrozen(strs));
  assert("dedupeStrings: len=3",       strs.length === 3);

  assert("dedupeById: null→[]",        dedupeById(null as any).length === 0);
  assert("dedupeStrings: null→[]",     dedupeStrings(null as any).length === 0);

  const list = [Object.freeze({ id:"a" }), Object.freeze({ id:"b" })];
  assert("hasId: true",                hasId(list, "a"));
  assert("hasId: false",               !hasId(list, "z"));
}

// ─── agent-discovery ──────────────────────────────────────────────────────────
console.log("\n── agent-discovery ──");
{
  const sources: DiscoverySource[] = [
    src("AGENT", "a1", "Drift Analyzer",  { domain:"configuration", tags:["drift","config"] }),
    src("AGENT", "a2", "Port Validator",  { domain:"configuration", tags:["ports"] }),
    src("AGENT", "a3", "Image Scanner",   { domain:"infrastructure" }),
    src("RUNTIME", "r1", "Node.js"),
    src("AGENT",  "a1", "Drift Analyzer"),
  ];

  const agents = discoverAgents(sources);
  assert("agent: frozen",              Object.isFrozen(agents));
  assert("agent: 3 agents (deduped)",  agents.length === 3);
  assert("agent: no runtimes",         !agents.some((a) => a.id === "r1"));
  assert("agent: a1 domain=config",    agents[0]!.domain === "configuration");
  assert("agent: a1 tags has drift",   agents[0]!.tags.includes("drift"));
  assert("agent: a3 tags=[],dom=infra",agents.find((a)=>a.id==="a3")!.domain==="infrastructure");
  assert("agent: each frozen",         agents.every((a) => Object.isFrozen(a)));
  assert("agent: tags frozen",         Object.isFrozen(agents[0]!.tags));

  assert("agent: null→[]",             discoverAgents(null as any).length === 0);
  assert("agent: empty→[]",            discoverAgents([]).length === 0);
  assert("agent: bad src skipped",     discoverAgents([src("AGENT","","bad")]).length === 0);

  const byDomain = agentsByDomain(agents, "configuration");
  assert("agentsByDomain: frozen",     Object.isFrozen(byDomain));
  assert("agentsByDomain: len=2",      byDomain.length === 2);

  const domains = agentDomains(agents);
  assert("agentDomains: frozen",       Object.isFrozen(domains));
  assert("agentDomains: has config",   domains.includes("configuration"));
  assert("agentDomains: has infra",    domains.includes("infrastructure"));
}

// ─── runtime-discovery ────────────────────────────────────────────────────────
console.log("\n── runtime-discovery ──");
{
  const sources: DiscoverySource[] = [
    src("RUNTIME", "r1", "Node.js",  { version:"20.11.0", platform:"linux" }),
    src("RUNTIME", "r2", "Deno",     { version:"v1.40.0", platform:"linux" }),
    src("RUNTIME", "r3", "Bun",      { version:"1.0.20",  platform:"macos" }),
    src("AGENT",   "a1", "Agent"),
    src("RUNTIME", "r1", "Node.js"),
  ];

  const runtimes = discoverRuntimes(sources);
  assert("runtime: frozen",           Object.isFrozen(runtimes));
  assert("runtime: 3 (deduped)",      runtimes.length === 3);
  assert("runtime: no agents",        !runtimes.some((r) => r.id === "a1"));
  assert("runtime: r1 version",       runtimes[0]!.version  === "20.11.0");
  assert("runtime: r1 platform",      runtimes[0]!.platform === "linux");
  assert("runtime: v-prefix stripped",runtimes[1]!.version  === "1.40.0");
  assert("runtime: each frozen",      runtimes.every((r) => Object.isFrozen(r)));

  assert("runtime: null→[]",          discoverRuntimes(null as any).length === 0);
  assert("runtime: bad src skipped",  discoverRuntimes([src("RUNTIME","","bad")]).length === 0);

  const byPlat = runtimesByPlatform(runtimes, "linux");
  assert("byPlatform: frozen",        Object.isFrozen(byPlat));
  assert("byPlatform: len=2",         byPlat.length === 2);

  const plats = runtimePlatforms(runtimes);
  assert("runtimePlatforms: frozen",  Object.isFrozen(plats));
  assert("runtimePlatforms: has linux",plats.includes("linux"));
  assert("runtimePlatforms: has macos",plats.includes("macos"));
}

// ─── integration-discovery ────────────────────────────────────────────────────
console.log("\n── integration-discovery ──");
{
  const sources: DiscoverySource[] = [
    src("INTEGRATION","i1","Stripe",  { type:"payment",  protocol:"rest" }),
    src("INTEGRATION","i2","Twilio",  { type:"messaging",protocol:"rest" }),
    src("INTEGRATION","i3","OAuth2",  { type:"auth",     protocol:"oauth" }),
    src("AGENT","a1","Agent"),
    src("INTEGRATION","i1","Stripe"),
  ];

  const ints = discoverIntegrations(sources);
  assert("int: frozen",               Object.isFrozen(ints));
  assert("int: 3 (deduped)",          ints.length === 3);
  assert("int: no agents",            !ints.some((i) => i.id === "a1"));
  assert("int: i1 type=payment",      ints[0]!.type     === "payment");
  assert("int: i1 protocol=rest",     ints[0]!.protocol === "rest");
  assert("int: each frozen",          ints.every((i) => Object.isFrozen(i)));

  assert("int: null→[]",              discoverIntegrations(null as any).length === 0);
  assert("int: bad src skipped",      discoverIntegrations([src("INTEGRATION","","bad")]).length === 0);

  const byType = integrationsByType(ints, "payment");
  assert("byType: frozen",            Object.isFrozen(byType));
  assert("byType: Stripe only",       byType.length === 1 && byType[0]!.name === "Stripe");

  const types = integrationTypes(ints);
  assert("intTypes: frozen",          Object.isFrozen(types));
  assert("intTypes: has payment",     types.includes("payment"));
  assert("intTypes: has auth",        types.includes("auth"));
}

// ─── deployment-discovery ─────────────────────────────────────────────────────
console.log("\n── deployment-discovery ──");
{
  const sources: DiscoverySource[] = [
    src("DEPLOYMENT","d1","Prod Cluster",   { target:"production", readinessSignal:"healthy" }),
    src("DEPLOYMENT","d2","Staging",        { target:"staging",    readinessSignal:"ready"   }),
    src("DEPLOYMENT","d3","Dev",            { target:"development",readinessSignal:"pending" }),
    src("DEPLOYMENT","d4","Custom Signal",  { target:"canary",     readinessSignal:"canary-ready" }),
    src("AGENT","a1","Agent"),
    src("DEPLOYMENT","d1","Prod Cluster"),
  ];

  const deps = discoverDeployments(sources);
  assert("dep: frozen",               Object.isFrozen(deps));
  assert("dep: 4 (deduped)",          deps.length === 4);
  assert("dep: no agents",            !deps.some((d) => d.id === "a1"));
  assert("dep: d1 target=production", deps[0]!.target          === "production");
  assert("dep: d1 signal=healthy",    deps[0]!.readinessSignal === "healthy");
  assert("dep: d2 signal=ready",      deps[1]!.readinessSignal === "ready");
  assert("dep: d3 signal=pending",    deps[2]!.readinessSignal === "pending");
  assert("dep: custom signal kept",   deps[3]!.readinessSignal === "canary-ready");
  assert("dep: each frozen",          deps.every((d) => Object.isFrozen(d)));

  assert("dep: null→[]",              discoverDeployments(null as any).length === 0);
  assert("dep: no signal→unspecified",discoverDeployments([src("DEPLOYMENT","x","Y")]).find((d)=>d.id==="x")!.readinessSignal === "unspecified");

  const byTarget = deploymentsByTarget(deps, "production");
  assert("byTarget: frozen",          Object.isFrozen(byTarget));
  assert("byTarget: prod=1",          byTarget.length === 1);

  const targets = deploymentTargets(deps);
  assert("depTargets: frozen",        Object.isFrozen(targets));
  assert("depTargets: has prod",      targets.includes("production"));
  assert("depTargets: has staging",   targets.includes("staging"));
}

// ─── language-discovery ───────────────────────────────────────────────────────
console.log("\n── language-discovery ──");
{
  const sources: DiscoverySource[] = [
    src("LANGUAGE","l1","TypeScript", { extension:".ts",  ecosystem:"node" }),
    src("LANGUAGE","l2","Python",     { extension:"py",   ecosystem:"python" }),
    src("LANGUAGE","l3","Rust",       { extension:".rs",  ecosystem:"cargo" }),
    src("LANGUAGE","l4","Go",         { extension:".go",  ecosystem:"go" }),
    src("AGENT","a1","Agent"),
    src("LANGUAGE","l1","TypeScript"),
  ];

  const langs = discoverLanguages(sources);
  assert("lang: frozen",              Object.isFrozen(langs));
  assert("lang: 4 (deduped)",         langs.length === 4);
  assert("lang: no agents",           !langs.some((l) => l.id === "a1"));
  assert("lang: l1 ext=.ts",          langs[0]!.extension === ".ts");
  assert("lang: l1 eco=node",         langs[0]!.ecosystem  === "node");
  assert("lang: py adds dot",         langs.find((l)=>l.id==="l2")!.extension === ".py");
  assert("lang: each frozen",         langs.every((l) => Object.isFrozen(l)));

  assert("lang: null→[]",             discoverLanguages(null as any).length === 0);
  assert("lang: bad src skipped",     discoverLanguages([src("LANGUAGE","","bad")]).length === 0);

  const byEco = languagesByEcosystem(langs, "node");
  assert("byEco: frozen",             Object.isFrozen(byEco));
  assert("byEco: ts only",            byEco.length === 1);

  const ecos = languageEcosystems(langs);
  assert("ecos: frozen",              Object.isFrozen(ecos));
  assert("ecos: has node",            ecos.includes("node"));
  assert("ecos: has cargo",           ecos.includes("cargo"));

  const exts = languageExtensions(langs);
  assert("exts: frozen",              Object.isFrozen(exts));
  assert("exts: has .ts",             exts.includes(".ts"));
}

// ─── orchestrator: empty ──────────────────────────────────────────────────────
console.log("\n── orchestrator: empty ──");
{
  reset();
  const s = runDiscovery(inp([]));
  assert("empty: frozen",             Object.isFrozen(s));
  assert("empty: agents=[]",          s.agents.length        === 0);
  assert("empty: runtimes=[]",        s.runtimes.length      === 0);
  assert("empty: integrations=[]",    s.integrations.length  === 0);
  assert("empty: deployments=[]",     s.deployments.length   === 0);
  assert("empty: languages=[]",       s.languages.length     === 0);
  assert("empty: totalDiscovered=0",  s.totalDiscovered      === 0);
  assert("empty: snapshotId dss-",    s.snapshotId.startsWith("dss-"));
  assert("empty: discoveredAt>0",     s.discoveredAt         > 0);
  assert("empty: summary empty",      s.summary.includes("No capability"));
  assert("empty: session COMPLETE",   getSession()?.stage    === "COMPLETE");
  assert("empty: byKind=0s",          Object.values(s.sourceSummary.byKind).every((v) => v === 0));
}

// ─── orchestrator: full discovery ─────────────────────────────────────────────
console.log("\n── orchestrator: full ──");
{
  reset();
  const sources: DiscoverySource[] = [
    src("AGENT",       "a1","Config Drift Analyzer", { domain:"configuration", tags:["drift"] }),
    src("AGENT",       "a2","Port Validator",         { domain:"configuration", tags:["ports"] }),
    src("AGENT",       "a3","Image Scanner",          { domain:"infrastructure" }),
    src("RUNTIME",     "r1","Node.js",                { version:"20.11.0", platform:"linux" }),
    src("RUNTIME",     "r2","Deno",                   { version:"v1.40.0", platform:"linux" }),
    src("INTEGRATION", "i1","Stripe",                 { type:"payment",  protocol:"rest" }),
    src("INTEGRATION", "i2","GitHub",                 { type:"scm",      protocol:"rest" }),
    src("DEPLOYMENT",  "d1","Production",             { target:"production", readinessSignal:"healthy" }),
    src("DEPLOYMENT",  "d2","Staging",                { target:"staging",    readinessSignal:"ready" }),
    src("LANGUAGE",    "l1","TypeScript",             { extension:".ts",  ecosystem:"node" }),
    src("LANGUAGE",    "l2","Python",                 { extension:".py",  ecosystem:"python" }),
  ];

  const snap = runDiscovery(inp(sources, "full-scan"));
  assert("full: frozen",              Object.isFrozen(snap));
  assert("full: agents.frozen",       Object.isFrozen(snap.agents));
  assert("full: totalDiscovered=11",  snap.totalDiscovered   === 11);
  assert("full: agents=3",            snap.agents.length     === 3);
  assert("full: runtimes=2",          snap.runtimes.length   === 2);
  assert("full: integrations=2",      snap.integrations.length === 2);
  assert("full: deployments=2",       snap.deployments.length  === 2);
  assert("full: languages=2",         snap.languages.length    === 2);
  assert("full: summary has agents",  snap.summary.includes("agent(s)"));
  assert("full: snapshotId dss-",     snap.snapshotId.startsWith("dss-"));
  assert("full: session COMPLETE",    getSession()?.stage      === "COMPLETE");

  assert("full: byKind.AGENT=3",      snap.sourceSummary.byKind["AGENT"]       === 3);
  assert("full: byKind.RUNTIME=2",    snap.sourceSummary.byKind["RUNTIME"]     === 2);
  assert("full: byKind.INTEGRATION=2",snap.sourceSummary.byKind["INTEGRATION"] === 2);
  assert("full: byKind.DEPLOYMENT=2", snap.sourceSummary.byKind["DEPLOYMENT"]  === 2);
  assert("full: byKind.LANGUAGE=2",   snap.sourceSummary.byKind["LANGUAGE"]    === 2);
  assert("full: totalSources=11",     snap.sourceSummary.totalSources === 11);
  assert("full: sourceSummary frozen",Object.isFrozen(snap.sourceSummary));

  assert("full: a1 domain=config",    snap.agents.find((a)=>a.id==="a1")!.domain === "configuration");
  assert("full: r1 version=20.11.0",  snap.runtimes.find((r)=>r.id==="r1")!.version === "20.11.0");
  assert("full: r2 v-stripped",       snap.runtimes.find((r)=>r.id==="r2")!.version === "1.40.0");
  assert("full: i1 type=payment",     snap.integrations.find((i)=>i.id==="i1")!.type === "payment");
  assert("full: d1 signal=healthy",   snap.deployments.find((d)=>d.id==="d1")!.readinessSignal === "healthy");
  assert("full: l2 ext=.py",          snap.languages.find((l)=>l.id==="l2")!.extension === ".py");

  const raw = getRawResult();
  assert("full: rawResult stored",    raw !== null);
  assert("full: rawResult frozen",    raw !== null && Object.isFrozen(raw));
  assert("full: rawResult capturedAt",raw !== null && raw.capturedAt > 0);

  const summary = getSourceSummary();
  assert("full: sourceSummary stored",summary !== null);
}

// ─── orchestrator: mixed kinds ────────────────────────────────────────────────
console.log("\n── orchestrator: mixed kinds ──");
{
  reset();
  const sources: DiscoverySource[] = [
    src("AGENT",  "a1","Analyzer", { domain:"analysis" }),
    src("RUNTIME","r1","Node",     { version:"20.0.0", platform:"linux" }),
    src("AGENT",  "a2","Validator",{ domain:"validation" }),
    src("LANGUAGE","l1","TS",      { extension:".ts", ecosystem:"node" }),
  ];
  const s = runDiscovery(inp(sources));
  assert("mixed: agents=2",           s.agents.length    === 2);
  assert("mixed: runtimes=1",         s.runtimes.length  === 1);
  assert("mixed: integrations=0",     s.integrations.length === 0);
  assert("mixed: deployments=0",      s.deployments.length  === 0);
  assert("mixed: languages=1",        s.languages.length    === 1);
  assert("mixed: total=4",            s.totalDiscovered     === 4);
}

// ─── orchestrator: deduplication ──────────────────────────────────────────────
console.log("\n── orchestrator: deduplication ──");
{
  reset();
  const s = runDiscovery(inp([
    src("AGENT","a1","Analyzer"),
    src("AGENT","a1","Analyzer"),
    src("AGENT","a2","Analyzer"),
    src("RUNTIME","r1","Node"),
    src("RUNTIME","r1","Node"),
  ]));
  assert("dedup: agents=2 (id+name dedup)", s.agents.length   === 2);
  assert("dedup: runtimes=1",               s.runtimes.length === 1);
}

// ─── orchestrator: invalid input ──────────────────────────────────────────────
console.log("\n── orchestrator: invalid ──");
{
  reset();
  const r1 = runDiscovery(null as any);
  assert("invalid: frozen",           Object.isFrozen(r1));
  assert("invalid: total=0",          r1.totalDiscovered === 0);
  assert("invalid: summary invalid",  r1.summary.includes("Invalid"));

  const r2 = runDiscovery({} as any);
  assert("invalid: {} → frozen",      Object.isFrozen(r2));

  const r3 = runDiscovery(inp([src("AGENT","","bad")]));
  assert("empty-id: total=0",         r3.totalDiscovered === 0);
}

// ─── runMany ──────────────────────────────────────────────────────────────────
console.log("\n── runMany ──");
{
  reset();
  const results = runMany([
    inp([src("AGENT","a1","A",{ domain:"d1" }), src("RUNTIME","r1","R",{ version:"1.0", platform:"linux" })]),
    inp([src("INTEGRATION","i1","Stripe",{ type:"payment", protocol:"rest" })]),
    inp([]),
  ]);

  assert("many: frozen",              Object.isFrozen(results));
  assert("many: length=3",            results.length === 3);
  assert("many: r1 agents=1",         results[0]!.agents.length    === 1);
  assert("many: r1 runtimes=1",       results[0]!.runtimes.length  === 1);
  assert("many: r2 integrations=1",   results[1]!.integrations.length === 1);
  assert("many: r3 total=0",          results[2]!.totalDiscovered  === 0);
  assert("many: each frozen",         results.every((r) => Object.isFrozen(r)));

  assert("many: null→[]",             runMany(null as any).length === 0);
  assert("many: []→[]",               runMany([]).length === 0);
}

// ─── state: history ───────────────────────────────────────────────────────────
console.log("\n── state: history ──");
{
  reset();
  assert("state: no snap → null",     getLastSnapshot() === null);
  assert("state: no history → []",    getSnapshotHistory().length === 0);

  runDiscovery(inp([src("AGENT","x1","X1",{ domain:"d1" })]));
  runDiscovery(inp([src("RUNTIME","x2","X2",{ version:"1.0", platform:"linux" })]));

  const last = getLastSnapshot();
  assert("state: last frozen",        Object.isFrozen(last));
  assert("state: last has runtime",   last!.runtimes.length === 1);

  const hist = getSnapshotHistory();
  assert("state: history frozen",     Object.isFrozen(hist));
  assert("state: length=2",           hist.length === 2);
}

// ─── determinism ──────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const sources: DiscoverySource[] = [
    src("AGENT",       "a1","Analyzer",  { domain:"config",  tags:["drift"] }),
    src("RUNTIME",     "r1","Node.js",   { version:"20.0.0", platform:"linux" }),
    src("INTEGRATION", "i1","Stripe",    { type:"payment",   protocol:"rest" }),
    src("DEPLOYMENT",  "d1","Prod",      { target:"production", readinessSignal:"healthy" }),
    src("LANGUAGE",    "l1","TypeScript",{ extension:".ts",  ecosystem:"node" }),
  ];
  const i = inp(sources, "det-test");

  reset(); const s1 = runDiscovery(i);
  reset(); const s2 = runDiscovery(i);

  assert("det: same totalDiscovered",  s1.totalDiscovered         === s2.totalDiscovered);
  assert("det: same agents len",       s1.agents.length           === s2.agents.length);
  assert("det: same runtimes len",     s1.runtimes.length         === s2.runtimes.length);
  assert("det: same integrations len", s1.integrations.length     === s2.integrations.length);
  assert("det: same deployments len",  s1.deployments.length      === s2.deployments.length);
  assert("det: same languages len",    s1.languages.length        === s2.languages.length);
  assert("det: same summary",          s1.summary                 === s2.summary);
  assert("det: same byKind.AGENT",     s1.sourceSummary.byKind["AGENT"] === s2.sourceSummary.byKind["AGENT"]);
  assert("det: same agent domains",
    s1.agents.map((a)=>a.domain).join(",") === s2.agents.map((a)=>a.domain).join(","));
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

import {
  analyzeResponsibility, analyzeMultiple,
  getLastReport, getReportHistory, resetAnalyzer,
} from "./index.js";
import type { ProjectFiles, FileDescriptor } from "./index.js";
import { clearAll } from "./state.js";
import {
  resetMultiDetectorCounter,
} from "./agents/multi-responsibility.detector.agent.js";

import { extractConcernTags, uniqueTags, tagsFromPath }
  from "./utils/tag-extractor.util.js";
import { computeFileMetrics, computeAllMetrics,
         oversizedFiles, averageLineCount }
  from "./utils/file-metrics.util.js";
import { detectConcerns, mixedFiles, pureFiles, mostConcernedFile }
  from "./agents/concern-detector.agent.js";
import { detectMultipleResponsibilities }
  from "./agents/multi-responsibility.detector.agent.js";
import { calculateSRPScores, overallSRPScore,
         compliantFileCount, lowestSRPScore }
  from "./agents/srp-score.calculator.agent.js";
import { evaluatePurity, modulePurityScore, impureFiles }
  from "./agents/purity-evaluator.agent.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function before(): void {
  clearAll(); resetAnalyzer(); resetMultiDetectorCounter();
}

function makeFile(
  path:        string,
  role:        FileDescriptor["role"] = "service",
  lineCount:   number = 100,
  exports:     string[] = [],
  contentHint: string = "",
): FileDescriptor {
  return Object.freeze({ path, role, lineCount, exports: Object.freeze(exports), contentHint });
}

before();

// ─── utils/tag-extractor.util ─────────────────────────────────────────────────
console.log("\n── utils/tag-extractor.util ──");
{
  const ev1 = extractConcernTags("user.service.ts", ["findUser"], "");
  assert("tagExtractor: service path → BUSINESS_LOGIC", ev1.some((e) => e.tag === "BUSINESS_LOGIC"));
  assert("tagExtractor: result frozen",                 Object.isFrozen(ev1));

  const ev2 = extractConcernTags("db.repository.ts", ["save", "find"], "SELECT * FROM users");
  assert("tagExtractor: db path → DATABASE",            ev2.some((e) => e.tag === "DATABASE"));

  const ev2c = extractConcernTags("hello.agent.ts", [], "SELECT * FROM users");
  assert("tagExtractor: SELECT content → DATABASE",     ev2c.some((e) => e.source === "content" && e.tag === "DATABASE"));

  const ev3 = extractConcernTags("auth.service.ts", ["authenticate", "verifyToken"], "jwt.sign");
  assert("tagExtractor: auth path → AUTHENTICATION",   ev3.some((e) => e.tag === "AUTHENTICATION"));

  const ev4 = extractConcernTags("routes/user.ts", ["get", "post"], "");
  assert("tagExtractor: route path → HTTP",             ev4.some((e) => e.tag === "HTTP"));

  const ev5 = extractConcernTags("plain.util.ts", [], "");
  assert("tagExtractor: plain util → empty or UNKNOWN", ev5.length === 0 || ev5.some((e) => e.tag));

  const tags = uniqueTags(ev3);
  assert("uniqueTags: frozen",                          Object.isFrozen(tags));
  assert("uniqueTags: no duplicates",                   tags.length === new Set(tags).size);

  const pathTags = tagsFromPath("cache.manager.ts");
  assert("tagsFromPath: cache → CACHING",               pathTags.includes("CACHING"));
  assert("tagsFromPath: frozen",                        Object.isFrozen(pathTags));
}

// ─── utils/file-metrics.util ──────────────────────────────────────────────────
console.log("\n── utils/file-metrics.util ──");
{
  const f1 = makeFile("big.service.ts", "service", 350, Array.from({ length: 12 }, (_, i) => `fn${i}`));
  const m1 = computeFileMetrics(f1);
  assert("metrics: frozen",                             Object.isFrozen(m1));
  assert("metrics: lineCount=350",                      m1.lineCount === 350);
  assert("metrics: isOversized=true",                   m1.isOversized === true);
  assert("metrics: exportCount=12",                     m1.exportCount === 12);
  assert("metrics: complexity=HIGH",                    m1.complexityHint === "HIGH");

  const f2 = makeFile("tiny.util.ts", "util", 40, ["helper"]);
  const m2 = computeFileMetrics(f2);
  assert("metrics: small → isOversized=false",          m2.isOversized === false);
  assert("metrics: small → complexity=LOW",             m2.complexityHint === "LOW");

  const all = computeAllMetrics([f1, f2]);
  assert("allMetrics: frozen",                          Object.isFrozen(all));
  assert("allMetrics: length=2",                        all.length === 2);

  const oversized = oversizedFiles(all);
  assert("oversized: length=1",                         oversized.length === 1);
  assert("oversized: is f1",                            oversized[0]!.path === "big.service.ts");

  assert("avgLineCount: (350+40)/2=195",               averageLineCount(all) === 195);
  assert("avgLineCount: empty=0",                       averageLineCount([]) === 0);
}

// ─── agents/concern-detector ──────────────────────────────────────────────────
console.log("\n── agents/concern-detector ──");
{
  const files = [
    makeFile("user.db.ts",    "agent",   100, ["save", "find"], "SELECT"),
    makeFile("auth.service.ts","service", 80,  ["authenticate"], "jwt.sign"),
    makeFile("pure.util.ts",  "util",    30,  ["add"]),
  ];
  const detections = detectConcerns(files);
  assert("concDetect: frozen",                          Object.isFrozen(detections));
  assert("concDetect: length=3",                        detections.length === 3);
  assert("concDetect: each frozen",                     detections.every((d) => Object.isFrozen(d)));
  assert("concDetect: db file has DATABASE",            detections[0]!.concerns.includes("DATABASE"));
  assert("concDetect: auth has AUTHENTICATION",         detections[1]!.concerns.includes("AUTHENTICATION"));
  assert("concDetect: evidence frozen",                 Object.isFrozen(detections[0]!.evidence));

  const godFile = [makeFile("god.ts", "service", 200, ["findUser","sendEmail","writeFile"], "SELECT; readFileSync")];
  const godDet  = detectConcerns(godFile);
  assert("concDetect: god file isMixed=true",           godDet[0]!.isMixed === true);

  const pure = pureFiles(detections);
  assert("pureFiles: pure.util.ts included",            pure.some((d) => d.path === "pure.util.ts"));

  const mixed = mixedFiles(godDet);
  assert("mixedFiles: god file detected",               mixed.length === 1);

  const most = mostConcernedFile(godDet);
  assert("mostConcerned: not null",                     most !== null);
  assert("mostConcerned: god.ts",                       most?.path === "god.ts");

  const empty = detectConcerns([]);
  assert("concDetect: empty → []",                      empty.length === 0);
}

// ─── agents/multi-responsibility.detector ────────────────────────────────────
console.log("\n── agents/multi-responsibility.detector ──");
{
  resetMultiDetectorCounter();

  const files    = [makeFile("god.ts", "service", 450, ["findUser","sendEmail","writeFile"], "SELECT; readFileSync")];
  const dets     = detectConcerns(files);
  const viols    = detectMultipleResponsibilities(files, dets);
  assert("multiDet: frozen",                            Object.isFrozen(viols));
  assert("multiDet: mixed concern violation",           viols.some((v) => v.type === "MIXED_CONCERNS"));
  assert("multiDet: oversized violation",               viols.some((v) => v.type === "FILE_TOO_LARGE"));
  assert("multiDet: each frozen",                       viols.every((v) => Object.isFrozen(v)));
  assert("multiDet: evidence frozen",                   Object.isFrozen(viols[0]!.evidence));
  assert("multiDet: id set",                            viols[0]!.id.startsWith("rsp-"));

  const orchFiles = [makeFile("orch.ts", "orchestrator", 80, [], "SELECT * FROM users")];
  const orchDets  = detectConcerns(orchFiles);
  const orchViols = detectMultipleResponsibilities(orchFiles, orchDets);
  assert("multiDet: orchestrator with logic → violation",
    orchViols.some((v) => v.type === "ORCHESTRATOR_DOING_LOGIC"));

  const utilFiles = [makeFile("util.ts", "util", 60, ["authenticate"], "jwt.sign")];
  const utilDets  = detectConcerns(utilFiles);
  const utilViols = detectMultipleResponsibilities(utilFiles, utilDets);
  assert("multiDet: util with auth → UTIL_WITH_BUSINESS_LOGIC",
    utilViols.some((v) => v.type === "UTIL_WITH_BUSINESS_LOGIC"));

  const empty = detectMultipleResponsibilities([], []);
  assert("multiDet: empty → []",                        empty.length === 0);
}

// ─── agents/srp-score.calculator ─────────────────────────────────────────────
console.log("\n── agents/srp-score.calculator ──");
{
  resetMultiDetectorCounter();

  const files  = [makeFile("clean.ts", "service", 80, ["doOne"])];
  const dets   = detectConcerns(files);
  const viols  = detectMultipleResponsibilities(files, dets);
  const scores = calculateSRPScores(files, dets, viols);

  assert("srpScore: frozen",                            Object.isFrozen(scores));
  assert("srpScore: length=1",                          scores.length === 1);
  assert("srpScore: clean → score=100",                 scores[0]!.score === 100);
  assert("srpScore: clean → isCompliant=true",          scores[0]!.isCompliant === true);

  const violFiles  = [makeFile("god.ts", "service", 400, ["findUser","sendEmail","writeFile"], "SELECT; readFileSync")];
  const violDets   = detectConcerns(violFiles);
  const violations = detectMultipleResponsibilities(violFiles, violDets);
  const violScores = calculateSRPScores(violFiles, violDets, violations);
  assert("srpScore: violations → score < 100",          violScores[0]!.score < 100);
  assert("srpScore: violations → isCompliant=false",    violScores[0]!.isCompliant === false);
  assert("srpScore: violationCount > 0",                violScores[0]!.violationCount > 0);

  const all     = [...scores, ...violScores];
  const overall = overallSRPScore(all);
  assert("overallSRP: between 0-100",                   overall >= 0 && overall <= 100);
  assert("overallSRP: empty → 100",                     overallSRPScore([]) === 100);

  assert("compliantCount: clean=1",                     compliantFileCount(scores) === 1);
  assert("lowestScore: returns god file",               lowestSRPScore(violScores)?.path === "god.ts");
  assert("lowestScore: empty → null",                   lowestSRPScore([]) === null);
}

// ─── agents/purity-evaluator ──────────────────────────────────────────────────
console.log("\n── agents/purity-evaluator ──");
{
  const utilFile = [makeFile("transform.util.ts", "util", 40, ["convert"])];
  const utilDet  = detectConcerns(utilFile);
  const pScores  = evaluatePurity(utilFile, utilDet);
  assert("purity: frozen",                              Object.isFrozen(pScores));
  assert("purity: length=1",                            pScores.length === 1);

  const stateFile = [makeFile("state.ts", "state", 60, ["getState"])];
  const stateDet  = detectConcerns(stateFile);
  const sPurity   = evaluatePurity(stateFile, stateDet);
  assert("purity: state file frozen",                   Object.isFrozen(sPurity[0]));

  const orchFile = [makeFile("orch.ts", "orchestrator", 50, [], "SELECT * FROM")];
  const orchDet  = detectConcerns(orchFile);
  const orchPur  = evaluatePurity(orchFile, orchDet);
  assert("purity: orchestrator with DB → isMixed=true", orchPur[0]!.isMixed === true);
  assert("purity: orchestrator with DB → score < 100",  orchPur[0]!.purityScore < 100);

  const emptyPurity = evaluatePurity([], []);
  assert("purity: empty → []",                          emptyPurity.length === 0);

  const moduleScore = modulePurityScore(pScores);
  assert("modulePurity: 0–100",                         moduleScore >= 0 && moduleScore <= 100);
  assert("modulePurity: empty → 100",                   modulePurityScore([]) === 100);

  const impure = impureFiles(orchPur);
  assert("impureFiles: orch with DB is impure",         impure.length >= 1);
  assert("impureFiles: frozen",                         Object.isFrozen(impure));
}

// ─── orchestrator (full integration — compliant) ──────────────────────────────
console.log("\n── orchestrator: compliant project ──");
{
  before();

  const project: ProjectFiles = Object.freeze({
    projectId: "clean-project",
    files: Object.freeze([
      makeFile("auth.agent.ts",         "agent",        80, [], ""),
      makeFile("app.orchestrator.ts",   "orchestrator", 60, [], ""),
      makeFile("convert.util.ts",       "util",         40, [], ""),
      makeFile("config.ts",             "type",         30, [], ""),
      makeFile("logger.agent.ts",       "agent",        50, [], ""),
    ]),
  });

  const report = analyzeResponsibility(project);
  assert("compliant: report frozen",                    Object.isFrozen(report));
  assert("compliant: violations frozen",                Object.isFrozen(report.violations));
  assert("compliant: srpScores frozen",                 Object.isFrozen(report.srpScores));
  assert("compliant: purityScores frozen",              Object.isFrozen(report.purityScores));
  assert("compliant: totalFiles=5",                     report.totalFiles === 5);
  assert("compliant: overallSRPScore=100",              report.overallSRPScore === 100);
  assert("compliant: reportId set",                     report.reportId.startsWith("resp-"));
  assert("compliant: analyzedAt > 0",                   report.analyzedAt > 0);
  assert("compliant: summary mentions compliant",       report.summary.includes("comply"));
  assert("compliant: compliantFiles=5",                 report.compliantFiles === 5);
  assert("compliant: violatingFiles=0",                 report.violatingFiles === 0);
  assert("compliant: criticalCount=0",                  report.criticalCount === 0);
}

// ─── orchestrator (full integration — violations) ─────────────────────────────
console.log("\n── orchestrator: violation project ──");
{
  before();

  const project: ProjectFiles = Object.freeze({
    projectId: "messy-project",
    files: Object.freeze([
      makeFile("god.service.ts", "service", 600, ["findUser","sendEmail","writeFile","authenticate"], "SELECT; readFileSync; jwt.sign"),
      makeFile("bad.orch.ts",    "orchestrator", 150, [], "SELECT * FROM users"),
    ]),
  });

  const report = analyzeResponsibility(project);
  assert("violation: not all compliant",                report.compliantFiles < report.totalFiles);
  assert("violation: has violations",                   report.totalViolations > 0);
  assert("violation: SRP score < 100",                  report.overallSRPScore < 100);
  assert("violation: has CRITICAL",                     report.criticalCount > 0);
  assert("violation: frozen",                           Object.isFrozen(report));
  assert("violation: MIXED_CONCERNS exists",            report.violations.some((v) => v.type === "MIXED_CONCERNS"));
  assert("violation: FILE_TOO_LARGE exists",            report.violations.some((v) => v.type === "FILE_TOO_LARGE"));
  assert("violation: summary mentions violations",      report.summary.includes("violation"));
}

// ─── invalid / edge cases ─────────────────────────────────────────────────────
console.log("\n── invalid / edge cases ──");
{
  before();

  const r1 = analyzeResponsibility(null as any);
  assert("invalid: null → frozen",                      Object.isFrozen(r1));
  assert("invalid: null → overallSRPScore=0",           r1.overallSRPScore === 0);
  assert("invalid: null → summary set",                 r1.summary.length > 0);

  const r2 = analyzeResponsibility({ projectId: "x", files: [] });
  assert("invalid: empty files → frozen",               Object.isFrozen(r2));
  assert("invalid: empty files → 0 violations",         r2.totalViolations === 0);
  assert("invalid: empty files → score=100",            r2.overallSRPScore === 100);
}

// ─── analyzeMultiple ─────────────────────────────────────────────────────────
console.log("\n── analyzeMultiple ──");
{
  before();

  const p1: ProjectFiles = { projectId: "p1", files: [makeFile("a.ts", "service", 80)] };
  const p2: ProjectFiles = { projectId: "p2", files: [makeFile("b.ts", "util", 50)] };
  const reports = analyzeMultiple([p1, p2]);
  assert("batch: frozen",                               Object.isFrozen(reports));
  assert("batch: length=2",                             reports.length === 2);
  assert("batch: each frozen",                          reports.every((r) => Object.isFrozen(r)));
  assert("batch: each has reportId",                    reports.every((r) => r.reportId.startsWith("resp-")));

  const empty = analyzeMultiple([]);
  assert("batch: empty → []",                           empty.length === 0);

  const bad = analyzeMultiple(null as any);
  assert("batch: null → []",                            bad.length === 0);
}

// ─── getLastReport + history ──────────────────────────────────────────────────
console.log("\n── state: report history ──");
{
  before();
  assert("history: no report → null",                   getLastReport() === null);

  const p: ProjectFiles = { projectId: "h", files: [makeFile("h.ts", "service", 80)] };
  analyzeResponsibility(p);
  analyzeResponsibility(p);

  const last = getLastReport();
  assert("history: lastReport frozen",                  Object.isFrozen(last));
  assert("history: lastReport reportId set",            last?.reportId.startsWith("resp-"));

  const hist = getReportHistory();
  assert("history: frozen",                             Object.isFrozen(hist));
  assert("history: length ≥ 2",                        hist.length >= 2);
}

// ─── determinism ─────────────────────────────────────────────────────────────
console.log("\n── determinism ──");
{
  const p: ProjectFiles = Object.freeze({
    projectId: "det",
    files:     Object.freeze([
      makeFile("user.db.ts", "agent", 200, ["findUser", "writeFile"], "SELECT; readFileSync"),
    ]),
  });

  before();
  const r1 = analyzeResponsibility(p);
  before();
  const r2 = analyzeResponsibility(p);

  assert("det: same totalFiles",                        r1.totalFiles      === r2.totalFiles);
  assert("det: same totalViolations",                   r1.totalViolations === r2.totalViolations);
  assert("det: same overallSRPScore",                   r1.overallSRPScore === r2.overallSRPScore);
  assert("det: same modulePurityScore",                 r1.modulePurityScore === r2.modulePurityScore);
  assert("det: same criticalCount",                     r1.criticalCount   === r2.criticalCount);
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

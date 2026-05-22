/**
 * aggregation.test.ts
 *
 * Unit tests for the DAG-Wave Result Aggregation Layer.
 * Run with: node --import tsx/esm --test server/quantum/aggregation/__tests__/*.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { AgentResult, FileMutation, MergeConflict } from "../aggregation-types.ts";
import { unionMerge }           from "../merge-strategies/union-merge.ts";
import { precedenceMerge }      from "../merge-strategies/precedence-merge.ts";
import { confidenceMerge }      from "../merge-strategies/confidence-merge.ts";
import { astSafeMerge }         from "../merge-strategies/ast-safe-merge.ts";
import { detectAllConflicts }   from "../conflict-detector.ts";
import { validateMergedState }  from "../aggregation-validator.ts";
import { collapse, CollapseError } from "../collapse-engine.ts";
import { createSession, addResult, hasUnresolvedConflicts } from "../state/aggregation-session.ts";
import { openSession, getSession, clearRun } from "../state/aggregation-store.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    nodeId:             overrides.nodeId  ?? "node-1",
    agentId:            overrides.agentId ?? "agent-executor",
    waveIndex:          overrides.waveIndex ?? 0,
    runId:              overrides.runId   ?? "run-test",
    projectId:          overrides.projectId ?? 1,
    success:            overrides.success ?? true,
    output:             overrides.output  ?? null,
    fileMutations:      overrides.fileMutations ?? [],
    toolResults:        overrides.toolResults   ?? [],
    runtimeEvidence:    overrides.runtimeEvidence ?? { verificationOutcome: "passed", summary: "ok", collectedAt: Date.now() },
    verificationPassed: overrides.verificationPassed ?? false,
    confidence:         overrides.confidence ?? 0.8,
    durationMs:         overrides.durationMs ?? 500,
    retries:            overrides.retries   ?? 0,
    completedAt:        overrides.completedAt ?? Date.now(),
    error:              overrides.error,
  };
}

function makeMutation(filePath: string, ownerId: string, content = `// ${filePath}`): FileMutation {
  return { filePath, operation: "write", content, ownerId, ts: Date.now() };
}

// ── Union merge ───────────────────────────────────────────────────────────────

describe("unionMerge", () => {
  it("merges disjoint files from two agents", () => {
    const a = makeResult({ nodeId: "n1", fileMutations: [makeMutation("a.ts", "n1")] });
    const b = makeResult({ nodeId: "n2", fileMutations: [makeMutation("b.ts", "n2")] });
    const { mergedFiles } = unionMerge([a, b]);
    assert.equal(mergedFiles.length, 2);
    assert.ok(mergedFiles.find(f => f.filePath === "a.ts"));
    assert.ok(mergedFiles.find(f => f.filePath === "b.ts"));
  });

  it("first verified winner takes overlapping file", () => {
    const unverified = makeResult({ nodeId: "n1", verificationPassed: false, confidence: 0.9,
      fileMutations: [makeMutation("shared.ts", "n1", "content-A")] });
    const verified   = makeResult({ nodeId: "n2", verificationPassed: true,  confidence: 0.7,
      fileMutations: [makeMutation("shared.ts", "n2", "content-B")] });
    const { mergedFiles, skippedPaths } = unionMerge([unverified, verified]);
    assert.equal(mergedFiles.length, 1);
    assert.equal(mergedFiles[0].winnerId, "n2");   // verified wins
    assert.equal(skippedPaths.length, 1);
  });
});

// ── Precedence merge ─────────────────────────────────────────────────────────

describe("precedenceMerge", () => {
  it("picks verified+high-confidence winner", () => {
    const low  = makeResult({ nodeId: "low",  confidence: 0.5, verificationPassed: false,
      fileMutations: [makeMutation("f.ts", "low",  "content-low")] });
    const high = makeResult({ nodeId: "high", confidence: 0.9, verificationPassed: true,
      fileMutations: [makeMutation("f.ts", "high", "content-high")] });
    const { mergedFiles } = precedenceMerge([low, high]);
    assert.equal(mergedFiles[0].winnerId, "high");
    assert.equal(mergedFiles[0].content,  "content-high");
  });

  it("produces deterministic output for same-score inputs", () => {
    const a = makeResult({ nodeId: "a", confidence: 0.8, completedAt: 100,
      fileMutations: [makeMutation("x.ts", "a", "content-a")] });
    const b = makeResult({ nodeId: "b", confidence: 0.8, completedAt: 200,
      fileMutations: [makeMutation("x.ts", "b", "content-b")] });
    const r1 = precedenceMerge([a, b]);
    const r2 = precedenceMerge([b, a]);
    assert.equal(r1.mergedFiles[0].winnerId, r2.mergedFiles[0].winnerId);
  });
});

// ── Confidence merge ──────────────────────────────────────────────────────────

describe("confidenceMerge", () => {
  it("clear winner takes the file when delta > threshold", () => {
    const low  = makeResult({ nodeId: "l", confidence: 0.3, fileMutations: [makeMutation("c.json", "l", "{}")] });
    const high = makeResult({ nodeId: "h", confidence: 0.9, fileMutations: [makeMutation("c.json", "h", `{"a":1}`)] });
    const { mergedFiles, tiedFiles } = confidenceMerge([low, high]);
    assert.equal(mergedFiles[0].winnerId, "h");
    assert.equal(tiedFiles.length, 0);
  });

  it("tied files are blended", () => {
    const a = makeResult({ nodeId: "a", confidence: 0.80, fileMutations: [makeMutation("t.ts", "a", "const A = 1;")] });
    const b = makeResult({ nodeId: "b", confidence: 0.82, fileMutations: [makeMutation("t.ts", "b", "const B = 2;")] });
    const { tiedFiles } = confidenceMerge([a, b]);
    assert.equal(tiedFiles.length, 1);
  });
});

// ── AST-safe merge ────────────────────────────────────────────────────────────

describe("astSafeMerge", () => {
  it("passes single-owner files through unchanged", () => {
    const a = makeResult({ nodeId: "solo", fileMutations: [makeMutation("solo.ts", "solo", "export const X = 1;")] });
    const { mergedFiles } = astSafeMerge([a]);
    assert.equal(mergedFiles[0].content, "export const X = 1;");
  });

  it("falls back to confidence winner for conflicting re-declarations", () => {
    const a = makeResult({ nodeId: "a", confidence: 0.9,
      fileMutations: [makeMutation("dup.ts", "a", "export const foo = 1;")] });
    const b = makeResult({ nodeId: "b", confidence: 0.6,
      fileMutations: [makeMutation("dup.ts", "b", "export const foo = 2;")] });
    const { mergedFiles, fallbacks } = astSafeMerge([a, b]);
    assert.equal(fallbacks.length, 1);
    assert.equal(mergedFiles[0].winnerId, "a");
  });
});

// ── Conflict detection ────────────────────────────────────────────────────────

describe("detectAllConflicts", () => {
  it("detects same_file_write conflicts", () => {
    const a = makeResult({ nodeId: "a", fileMutations: [makeMutation("shared.ts", "a")] });
    const b = makeResult({ nodeId: "b", fileMutations: [makeMutation("shared.ts", "b")] });
    const { conflicts } = detectAllConflicts([a, b], "run-1", 0, Date.now());
    const fileConflicts = conflicts.filter(c => c.kind === "same_file_write");
    assert.ok(fileConflicts.length >= 1);
  });

  it("detects duplicate_execution for same agentId", () => {
    const a = makeResult({ nodeId: "a", agentId: "executor" });
    const b = makeResult({ nodeId: "b", agentId: "executor" });
    const { conflicts } = detectAllConflicts([a, b], "run-1", 0, Date.now());
    const dupConflicts = conflicts.filter(c => c.kind === "duplicate_execution");
    assert.ok(dupConflicts.length >= 1);
  });

  it("returns empty conflicts for disjoint results", () => {
    const a = makeResult({ nodeId: "a", agentId: "agent-a", fileMutations: [makeMutation("a.ts", "a")] });
    const b = makeResult({ nodeId: "b", agentId: "agent-b", fileMutations: [makeMutation("b.ts", "b")] });
    const { conflicts } = detectAllConflicts([a, b], "run-1", 0, Date.now());
    assert.equal(conflicts.length, 0);
  });
});

// ── Aggregation validator ─────────────────────────────────────────────────────

describe("validateMergedState", () => {
  it("passes valid merged state", () => {
    const result = makeResult({
      nodeId: "n1",
      fileMutations: [makeMutation("a.ts", "n1", "export const x = 1;")],
    });
    const merged = [{ filePath: "a.ts", content: "export const x = 1;", strategy: "union" as const,
      winnerId: "n1", confidence: 0.9, mergedAt: Date.now() }];
    const report = validateMergedState([result], merged, [], "run-1", 1);
    assert.ok(report.valid, `Expected valid. Checks: ${JSON.stringify(report.checks)}`);
  });

  it("blocks on unresolved conflicts", () => {
    const result = makeResult();
    const merged = [{ filePath: "a.ts", content: "ok", strategy: "union" as const,
      winnerId: "node-1", confidence: 0.9, mergedAt: Date.now() }];
    const conflict: MergeConflict = {
      kind: "same_file_write", filePath: "a.ts",
      ownerA: "node-1", ownerB: "node-2",
      runId: "run-1", waveIndex: 0, resolved: false,
    };
    const report = validateMergedState([result], merged, [conflict], "run-1", 1);
    assert.ok(!report.valid);
    assert.ok(report.blockedReason?.includes("no_unresolved_conflicts"));
  });
});

// ── Collapse engine ───────────────────────────────────────────────────────────

describe("collapse", () => {
  it("produces a safe collapsed state from valid inputs", () => {
    const result = makeResult({ nodeId: "winner", verificationPassed: true, confidence: 0.9 });
    const merged = [{ filePath: "out.ts", content: "ok", strategy: "union" as const,
      winnerId: "winner", confidence: 0.9, mergedAt: Date.now() }];
    const state = collapse({ runId: "run-1", projectId: 1, waveIndex: 0,
      results: [result], mergedFiles: merged, conflicts: [], startedAt: Date.now() - 100 });
    assert.ok(state.safe);
    assert.equal(state.winnerNodeId, "winner");
    assert.equal(state.unresolvedConflicts, 0);
  });

  it("throws CollapseError when unresolved conflicts remain", () => {
    const result = makeResult();
    const conflict: MergeConflict = { kind: "stale_write", filePath: "f.ts",
      ownerA: "a", ownerB: "b", runId: "run-1", waveIndex: 0, resolved: false };
    assert.throws(
      () => collapse({ runId: "run-1", projectId: 1, waveIndex: 0,
        results: [result], mergedFiles: [], conflicts: [conflict], startedAt: Date.now() }),
      (err) => err instanceof CollapseError && err.reason === "unresolved_conflicts",
    );
  });
});

// ── Aggregation session ───────────────────────────────────────────────────────

describe("AggregationSession", () => {
  it("tracks results and conflict state correctly", () => {
    const session = createSession("run-1", 1, 0, "exec-1");
    const result  = makeResult({ nodeId: "n1" });
    addResult(session, result);
    assert.equal(session.results.size, 1);
    assert.ok(!hasUnresolvedConflicts(session));
  });
});

// ── Aggregation store ─────────────────────────────────────────────────────────

describe("AggregationStore", () => {
  it("opens and retrieves sessions by runId+waveIndex", () => {
    const runId = "store-test-run";
    const s1 = openSession(runId, 1, 0);
    const s2 = openSession(runId, 1, 1);
    assert.equal(getSession(runId, 0)?.waveIndex, 0);
    assert.equal(getSession(runId, 1)?.waveIndex, 1);
    clearRun(runId);
    assert.equal(getSession(runId, 0), undefined);
  });
});

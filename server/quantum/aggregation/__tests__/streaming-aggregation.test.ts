/**
 * __tests__/streaming-aggregation.test.ts
 *
 * Validation, replay, partial aggregation, conflict resolution,
 * rollback safety, and concurrency tests for the streaming aggregation system.
 *
 * Run with: npx tsx --test server/quantum/aggregation/__tests__/streaming-aggregation.test.ts
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { seedState }           from "../reducers/incremental-reducer.ts";
import { IncrementalReducer }  from "../reducers/incremental-reducer.ts";
import { ConfidenceReducer }   from "../reducers/confidence-reducer.ts";
import { AggregationQueue }    from "../buffers/aggregation-queue.ts";
import { capture, latest, clear as clearSnap } from "../buffers/aggregation-snapshot.ts";
import { AggregationCheckpointStore } from "../checkpoints/aggregation-checkpoint-store.ts";
import { replayFromCheckpoint, validateReplayDeterminism } from "../checkpoints/replay-checkpoint.ts";
import { StreamingConflictResolver }  from "../reconciliation/streaming-conflict-resolver.ts";
import { applyStrategy, selectStrategy } from "../reconciliation/merge-strategies.ts";
import { openBarrier, registerConflict, registerResolution, isBarrierClear, clearBarrier } from "../reconciliation/reconciliation-barrier.ts";
import type { StreamingPathEvent, PartialAggregationState } from "../contracts/aggregation.types.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<StreamingPathEvent> = {}): StreamingPathEvent {
  return {
    sessionId:          "sess-test",
    runId:              "run-1",
    projectId:          1,
    pathId:             `path-${Math.random().toString(36).slice(2, 7)}`,
    success:            true,
    confidence:         0.80,
    filesWritten:       ["src/app.ts"],
    durationMs:         5000,
    retries:            0,
    verificationPassed: true,
    arrivedAt:          Date.now(),
    ...overrides,
  };
}

// ── 1. Partial aggregation tests ──────────────────────────────────────────────

describe("IncrementalReducer", () => {
  test("seeds empty state correctly", () => {
    const state = seedState("s1", "r1", 1, 5);
    assert.equal(state.arrivedPaths, 0);
    assert.equal(state.totalPaths, 5);
    assert.equal(state.phase, "collecting");
  });

  test("folds one path event into state", () => {
    const reducer = new IncrementalReducer();
    const initial = seedState("s2", "r2", 1, 3);
    const ev      = makeEvent({ sessionId: "s2", pathId: "p1" });
    const next    = reducer.reduce(initial, ev);
    assert.equal(next.arrivedPaths, 1);
    assert.equal(next.successPaths, 1);
    assert.equal(next.failedPaths,  0);
  });

  test("is idempotent for duplicate path events", () => {
    const reducer = new IncrementalReducer();
    const initial = seedState("s3", "r3", 1, 3);
    const ev      = makeEvent({ sessionId: "s3", pathId: "p-dupe" });
    const once    = reducer.reduce(initial, ev);
    const twice   = reducer.reduce(once, ev);
    assert.equal(once.arrivedPaths,  twice.arrivedPaths);
  });

  test("merges file lists without duplicates", () => {
    const reducer = new IncrementalReducer();
    const initial = seedState("s4", "r4", 1, 2);
    const ev1 = makeEvent({ sessionId: "s4", pathId: "pA", filesWritten: ["a.ts", "b.ts"] });
    const ev2 = makeEvent({ sessionId: "s4", pathId: "pB", filesWritten: ["b.ts", "c.ts"] });
    const s1  = reducer.reduce(initial, ev1);
    const s2  = reducer.reduce(s1, ev2);
    assert.deepEqual(s2.mergedFiles.sort(), ["a.ts", "b.ts", "c.ts"]);
  });
});

// ── 2. Confidence reducer tests ───────────────────────────────────────────────

describe("ConfidenceReducer", () => {
  test("returns topPathId as highest scorer", () => {
    const cr  = new ConfidenceReducer();
    const ev1 = makeEvent({ pathId: "low",  confidence: 0.50, verificationPassed: false });
    const ev2 = makeEvent({ pathId: "high", confidence: 0.95, verificationPassed: true  });
    const { topPathId } = cr.score([ev1, ev2]);
    assert.equal(topPathId, "high");
  });

  test("returns empty topPathId when no events", () => {
    const { topPathId, topConfidence } = new ConfidenceReducer().score([]);
    assert.equal(topPathId, "");
    assert.equal(topConfidence, 0);
  });
});

// ── 3. Queue backpressure tests ───────────────────────────────────────────────

describe("AggregationQueue", () => {
  test("accepts events below maxDepth", () => {
    const q   = new AggregationQueue(10);
    const ev  = makeEvent({ sessionId: "q1" });
    const res = q.enqueue(ev);
    assert.ok(res.accepted);
  });

  test("rejects events beyond maxDepth", () => {
    const q  = new AggregationQueue(2);
    const ev = makeEvent({ sessionId: "q2" });
    q.enqueue(ev); q.enqueue(ev);
    const res = q.enqueue(ev);
    assert.equal(res.accepted, false);
  });

  test("drainAll returns all events", () => {
    const q  = new AggregationQueue(100);
    const e1 = makeEvent({ sessionId: "q3", pathId: "p1" });
    const e2 = makeEvent({ sessionId: "q3", pathId: "p2" });
    q.enqueue(e1); q.enqueue(e2);
    const drained = q.drainAll("q3");
    assert.equal(drained.length, 2);
  });
});

// ── 4. Checkpoint + replay tests ──────────────────────────────────────────────

describe("AggregationCheckpointStore", () => {
  test("saves and loads checkpoint", () => {
    const store   = new AggregationCheckpointStore();
    const state   = seedState("ck1", "r1", 1, 5);
    const ckpt    = store.checkpoint(state);
    const loaded  = store.load("ck1");
    assert.equal(loaded?.id, ckpt.id);
  });

  test("prunes old checkpoints", () => {
    const store = new AggregationCheckpointStore();
    const state = seedState("ck2", "r1", 1, 5);
    for (let i = 0; i < 8; i++) store.checkpoint(state);
    store.prune("ck2", 3);
    assert.equal(store.loadAll("ck2").length, 3);
  });
});

describe("replayFromCheckpoint", () => {
  test("deterministic replay produces same arrivedPaths", () => {
    const store   = new AggregationCheckpointStore();
    const state   = seedState("rep1", "r1", 1, 5);
    const ckpt    = store.checkpoint(state);
    const extras  = [makeEvent({ sessionId: "rep1", pathId: "px1" })];
    const r1      = replayFromCheckpoint(ckpt, extras);
    const r2      = replayFromCheckpoint(ckpt, extras);
    assert.equal(r1.arrivedPaths, r2.arrivedPaths);
  });

  test("validateReplayDeterminism passes for deterministic events", () => {
    const store  = new AggregationCheckpointStore();
    const state  = seedState("rep2", "r1", 1, 5);
    const ckpt   = store.checkpoint(state);
    const extras = [makeEvent({ sessionId: "rep2", pathId: "py1" })];
    const { deterministic } = validateReplayDeterminism(ckpt, extras);
    assert.ok(deterministic);
  });
});

// ── 5. Conflict resolution tests ──────────────────────────────────────────────

describe("StreamingConflictResolver", () => {
  test("detects conflict on shared file", () => {
    const resolver = new StreamingConflictResolver();
    const ev1 = makeEvent({ sessionId: "cr1", pathId: "a", filesWritten: ["shared.ts"] });
    const ev2 = makeEvent({ sessionId: "cr1", pathId: "b", filesWritten: ["shared.ts"] });
    openBarrier("cr1");
    const conflict = resolver.detect(ev1, ev2);
    clearBarrier("cr1");
    assert.ok(conflict !== null);
    assert.equal(conflict?.filePath, "shared.ts");
  });

  test("returns null when no shared files", () => {
    const resolver = new StreamingConflictResolver();
    const ev1 = makeEvent({ sessionId: "cr2", pathId: "a", filesWritten: ["a.ts"] });
    const ev2 = makeEvent({ sessionId: "cr2", pathId: "b", filesWritten: ["b.ts"] });
    openBarrier("cr2");
    const conflict = resolver.detect(ev1, ev2);
    clearBarrier("cr2");
    assert.equal(conflict, null);
  });
});

// ── 6. Merge strategy tests ───────────────────────────────────────────────────

describe("MergeStrategies", () => {
  test("ast_safe selects verified path", () => {
    const conflict = {
      id: "c1", sessionId: "ms1", filePath: "x.ts",
      ownerA: "a", ownerB: "b", strategy: "ast_safe" as const,
      resolved: false, detectedAt: Date.now(),
    };
    const evA = makeEvent({ pathId: "a", verificationPassed: true,  confidence: 0.70 });
    const evB = makeEvent({ pathId: "b", verificationPassed: false, confidence: 0.90 });
    const res = applyStrategy("ast_safe", conflict, evA, evB);
    assert.equal(res.winnerId, "a");
  });

  test("selectStrategy picks ast_safe for .ts files", () => {
    assert.equal(selectStrategy("src/foo.ts"),    "ast_safe");
    assert.equal(selectStrategy("config.json"),   "confidence");
  });
});

// ── 7. Reconciliation barrier tests ──────────────────────────────────────────

describe("ReconciliationBarrier", () => {
  test("clear when no conflicts registered", () => {
    openBarrier("b1");
    assert.ok(isBarrierClear("b1"));
    clearBarrier("b1");
  });

  test("blocked until resolution", () => {
    openBarrier("b2");
    registerConflict("b2");
    assert.equal(isBarrierClear("b2"), false);
    registerResolution("b2");
    assert.ok(isBarrierClear("b2"));
    clearBarrier("b2");
  });
});

// ── 8. Snapshot tests ─────────────────────────────────────────────────────────

describe("AggregationSnapshot", () => {
  test("captures immutable copy", () => {
    const state = seedState("sn1", "r1", 1, 5);
    capture(state);
    const snap = latest("sn1");
    assert.ok(snap !== undefined);
    assert.equal(snap!.arrivedPaths, 0);
    clearSnap("sn1");
  });
});

/**
 * test/unit/run-scoped-memory-lane.test.ts
 * Unit tests — RunScopedMemoryLane (functional API): write ordering, isolation, replay.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  getOrCreateLane, writeLane, readLane, replayLane,
  destroyLane, allLaneStats, activeLaneCount,
} from "../../server/quantum/memory/run-scoped-memory-lane.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("RunScopedMemoryLane (functional API)", () => {
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId = makeRunId("mem-lane");
    pid   = makeProjectId();
  });

  describe("write", () => {
    it("write returns ok=true and a positive seq", async () => {
      const result = await writeLane(runId, pid, "model", "gpt-4o");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.seq).toBeGreaterThan(0);
      destroyLane(runId);
    });

    it("seq is monotonically increasing across writes", async () => {
      await writeLane(runId, pid, "k1", "v1");
      await writeLane(runId, pid, "k2", "v2");
      await writeLane(runId, pid, "k3", "v3");
      const entries = replayLane(runId);
      const seqs = entries.map(e => e.seq);
      for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
      destroyLane(runId);
    });

    it("overwrites existing key on second write", async () => {
      await writeLane(runId, pid, "key", "first");
      await writeLane(runId, pid, "key", "second");
      const entry = readLane(runId, "key");
      expect(entry?.value).toBe("second");
      destroyLane(runId);
    });
  });

  describe("read", () => {
    it("read returns the stored entry", async () => {
      await writeLane(runId, pid, "model", "claude-3");
      const entry = readLane(runId, "model");
      expect(entry?.value).toBe("claude-3");
      expect(entry?.key).toBe("model");
      expect(entry?.runId).toBe(runId);
      destroyLane(runId);
    });

    it("read returns undefined for unknown key", () => {
      expect(readLane(runId, "nonexistent")).toBeUndefined();
    });
  });

  describe("isolation", () => {
    it("writes to runA do not appear in runB", async () => {
      const runB = makeRunId("mem-b");
      await writeLane(runId, pid, "shared-key", "from-A");
      expect(readLane(runB, "shared-key")).toBeUndefined();
      destroyLane(runId);
    });

    it("runId is stored on each MemoryEntry", async () => {
      await writeLane(runId, pid, "x", "1");
      const entry = readLane(runId, "x");
      expect(entry?.runId).toBe(runId);
      destroyLane(runId);
    });
  });

  describe("replay", () => {
    it("replay returns all entries sorted by seq", async () => {
      await writeLane(runId, pid, "a", "1");
      await writeLane(runId, pid, "b", "2");
      await writeLane(runId, pid, "c", "3");
      const entries = replayLane(runId);
      expect(entries).toHaveLength(3);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].seq).toBeGreaterThan(entries[i - 1].seq);
      }
      destroyLane(runId);
    });

    it("replayLane(sinceSeq) returns only entries after that seq", async () => {
      await writeLane(runId, pid, "a", "1");
      await writeLane(runId, pid, "b", "2");
      await writeLane(runId, pid, "c", "3");
      const all   = replayLane(runId);
      const since = replayLane(runId, all[0].seq);
      expect(since).toHaveLength(2);
      destroyLane(runId);
    });

    it("replay is deterministic — identical results on repeated calls", async () => {
      await writeLane(runId, pid, "a", "1");
      await writeLane(runId, pid, "b", "2");
      const r1 = replayLane(runId).map(e => e.key);
      const r2 = replayLane(runId).map(e => e.key);
      expect(r1).toEqual(r2);
      destroyLane(runId);
    });
  });

  describe("concurrent write safety", () => {
    it("50 concurrent writes all persist (no data loss)", async () => {
      await Promise.all(
        Array.from({ length: 50 }, (_, i) => writeLane(runId, pid, `k${i}`, `v${i}`)),
      );
      const lane = getOrCreateLane(runId, pid);
      const stats = lane.stats();
      expect(stats.entries).toBe(50);
      destroyLane(runId);
    });
  });

  describe("destroyLane", () => {
    it("lane is removed from registry after destroy", async () => {
      await writeLane(runId, pid, "x", "1");
      const before = activeLaneCount();
      destroyLane(runId);
      expect(activeLaneCount()).toBeLessThan(before);
    });

    it("read returns undefined after destroy", async () => {
      await writeLane(runId, pid, "x", "1");
      destroyLane(runId);
      expect(readLane(runId, "x")).toBeUndefined();
    });
  });

  describe("allLaneStats", () => {
    it("returns stats for all active lanes", async () => {
      await writeLane(runId, pid, "x", "1");
      const stats = allLaneStats();
      expect(stats.some(s => s.runId === runId)).toBe(true);
      destroyLane(runId);
    });
  });
});

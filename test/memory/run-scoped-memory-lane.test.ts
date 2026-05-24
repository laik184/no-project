/**
 * test/memory/run-scoped-memory-lane.test.ts
 * Memory tests — write queue, sequential ordering, replay, concurrent safety.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  getOrCreateLane, writeLane, readLane, replayLane,
  destroyLane,
} from "../../server/quantum/memory/run-scoped-memory-lane.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("Memory: RunScopedMemoryLane — deep coverage", () => {
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId = makeRunId("mem-deep");
    pid   = makeProjectId();
  });

  describe("write queue — sequential ordering", () => {
    it("writes serialize within a single lane (seq always increases)", async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        writeLane(runId, pid, `seq-key-${i}`, i),
      );
      await Promise.all(writes);
      const entries = replayLane(runId);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].seq).toBeGreaterThan(entries[i - 1].seq);
      }
      destroyLane(runId);
    });

    it("entries have correct runId and projectId", async () => {
      await writeLane(runId, pid, "x", "y");
      const e = readLane(runId, "x");
      expect(e?.runId).toBe(runId);
      expect(e?.projectId).toBe(pid);
      destroyLane(runId);
    });
  });

  describe("retrieval correctness", () => {
    it("readLane returns last write for a key", async () => {
      await writeLane(runId, pid, "model", "gpt-4");
      await writeLane(runId, pid, "model", "gpt-4o");
      expect(readLane(runId, "model")?.value).toBe("gpt-4o");
      destroyLane(runId);
    });

    it("readLane undefined for unknown key", () => {
      expect(readLane(runId, "ghost")).toBeUndefined();
    });

    it("getOrCreateLane.readAll returns all stored entries", async () => {
      await writeLane(runId, pid, "a", 1);
      await writeLane(runId, pid, "b", 2);
      await writeLane(runId, pid, "c", 3);
      const lane = getOrCreateLane(runId, pid);
      expect(lane.readAll()).toHaveLength(3);
      destroyLane(runId);
    });
  });

  describe("replay ordering", () => {
    it("replayLane entries are sorted by seq ascending", async () => {
      await writeLane(runId, pid, "z", 1);
      await writeLane(runId, pid, "y", 2);
      await writeLane(runId, pid, "x", 3);
      const entries = replayLane(runId);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].seq).toBeGreaterThanOrEqual(entries[i - 1].seq);
      }
      destroyLane(runId);
    });

    it("sinceSeq filter returns only newer entries", async () => {
      await writeLane(runId, pid, "a", 1);
      await writeLane(runId, pid, "b", 2);
      await writeLane(runId, pid, "c", 3);
      const all    = replayLane(runId);
      const latest = replayLane(runId, all[1].seq);
      expect(latest).toHaveLength(1);
      expect(latest[0].key).toBe("c");
      destroyLane(runId);
    });
  });

  describe("TTL expiry", () => {
    it("entry with TTL=10ms disappears after expiry", async () => {
      await writeLane(runId, pid, "temp", "gone", 10);
      await new Promise(r => setTimeout(r, 50));
      expect(readLane(runId, "temp")).toBeUndefined();
      destroyLane(runId);
    });

    it("entry without TTL persists", async () => {
      await writeLane(runId, pid, "persist", "forever");
      await new Promise(r => setTimeout(r, 20));
      expect(readLane(runId, "persist")).toBeDefined();
      destroyLane(runId);
    });
  });

  describe("concurrent write safety", () => {
    it("100 parallel writes all persist (no lost updates)", async () => {
      await Promise.all(
        Array.from({ length: 100 }, (_, i) => writeLane(runId, pid, `k${i}`, `v${i}`)),
      );
      const lane = getOrCreateLane(runId, pid);
      expect(lane.stats().entries).toBe(100);
      destroyLane(runId);
    });

    it("totalWrites tracks all write attempts including overwrites", async () => {
      await writeLane(runId, pid, "key", "v1");
      await writeLane(runId, pid, "key", "v2");
      const lane = getOrCreateLane(runId, pid);
      expect(lane.stats().totalWrites).toBe(2);
      destroyLane(runId);
    });
  });

  describe("cross-run isolation", () => {
    it("two runs maintain completely separate stores", async () => {
      const runB = makeRunId("mem-iso-b");
      await writeLane(runId, pid,      "secret", "from-A");
      await writeLane(runB, pid + 1,   "secret", "from-B");
      expect(readLane(runId, "secret")?.value).toBe("from-A");
      expect(readLane(runB,  "secret")?.value).toBe("from-B");
      destroyLane(runId);
      destroyLane(runB);
    });
  });
});

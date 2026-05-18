/**
 * file-change-emitter.test.ts
 * Unit tests for emitFileChange and emitFileWriting.
 *
 * Verifies: 80ms debounce, per-key deduplication, immediate
 * emission for "writing" events, and correct bus payload shape.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { emitFileChange, emitFileWriting } from "../file-change-emitter.ts";
import { bus } from "../bus.ts";
import type { FileChangeEvent } from "../bus.ts";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Use large, unlikely projectIds to avoid cross-test key collisions
// since _pending is a module-level singleton.
let pid = 90000;
const nextPid = () => ++pid;

// ── emitFileChange ────────────────────────────────────────────────────────────

describe("emitFileChange", () => {
  test("emits a file.change event after the debounce window", async () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileChange(p, "change", "src/foo.ts");
    assert.equal(received.length, 0, "must not fire before debounce expires");

    await wait(150);
    assert.equal(received.length, 1, "exactly one event after debounce");
    assert.equal(received[0].projectId, p);
    assert.equal(received[0].type, "change");
    assert.equal(received[0].path, "src/foo.ts");

    unsub();
  });

  test("collapses duplicate (same key) calls within the debounce window", async () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileChange(p, "add", "src/bar.ts");
    emitFileChange(p, "add", "src/bar.ts");
    emitFileChange(p, "add", "src/bar.ts");

    await wait(150);
    assert.equal(received.length, 1, "three rapid duplicate calls → one emission");

    unsub();
  });

  test("does NOT deduplicate events with different file paths", async () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileChange(p, "change", "src/a.ts");
    emitFileChange(p, "change", "src/b.ts");

    await wait(150);
    assert.equal(received.length, 2, "different paths → separate events");

    unsub();
  });

  test("does NOT deduplicate events with different types", async () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileChange(p, "add",    "src/c.ts");
    emitFileChange(p, "change", "src/c.ts");
    emitFileChange(p, "unlink", "src/c.ts");

    await wait(150);
    assert.equal(received.length, 3, "different types → separate events");

    unsub();
  });

  test("does NOT deduplicate events with different projectIds", async () => {
    const p1 = nextPid();
    const p2 = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p1 || e.projectId === p2) received.push(e);
    });

    emitFileChange(p1, "change", "src/shared.ts");
    emitFileChange(p2, "change", "src/shared.ts");

    await wait(150);
    assert.equal(received.length, 2, "different projectIds → separate events");

    unsub();
  });

  test("event ts is a recent timestamp (within last 5 seconds)", async () => {
    const p = nextPid();
    const before = Date.now();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileChange(p, "add", "src/ts-check.ts");
    await wait(150);

    assert.equal(received.length, 1);
    assert.ok(received[0].ts >= before, "ts must be >= call time");
    assert.ok(received[0].ts <= Date.now(), "ts must be <= now");

    unsub();
  });
});

// ── emitFileWriting ───────────────────────────────────────────────────────────

describe("emitFileWriting", () => {
  test("fires synchronously with type=writing and byteSize", () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileWriting(p, "src/d.ts", 2048);

    // EventEmitter.emit() is synchronous — event arrives before next line
    assert.equal(received.length, 1, "must fire immediately (no debounce)");
    assert.equal(received[0].type, "writing");
    assert.equal(received[0].projectId, p);
    assert.equal(received[0].path, "src/d.ts");
    assert.equal((received[0] as any).size, 2048);

    unsub();
  });

  test("fires without size when byteSize is omitted", () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileWriting(p, "src/e.ts");

    assert.equal(received.length, 1);
    assert.equal((received[0] as any).size, undefined);

    unsub();
  });

  test("multiple emitFileWriting calls do not deduplicate (no debounce)", () => {
    const p = nextPid();
    const received: FileChangeEvent[] = [];
    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === p) received.push(e);
    });

    emitFileWriting(p, "src/f.ts", 100);
    emitFileWriting(p, "src/f.ts", 200);
    emitFileWriting(p, "src/f.ts", 300);

    assert.equal(received.length, 3, "writing events are never deduplicated");

    unsub();
  });
});

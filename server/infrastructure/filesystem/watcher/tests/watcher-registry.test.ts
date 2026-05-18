/**
 * watcher-registry.test.ts
 * Unit tests for WatcherRegistry.
 *
 * Verifies: singleton-per-project enforcement, isWatching state,
 * getStats accuracy, unwatchProject cleanup, disposeAll, and
 * OS-level file write relay through the EventBus.
 *
 * Each test creates its own WatcherRegistry instance so there is
 * no shared state between tests.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { WatcherRegistry } from "../watcher-registry.ts";
import { bus } from "../../../events/bus.ts";
import type { FileChangeEvent } from "../../../events/bus.ts";

const makeTmpDir = () =>
  fs.mkdtemp(path.join(os.tmpdir(), "nura-watcher-reg-test-"));

// ── State management ──────────────────────────────────────────────────────────

describe("WatcherRegistry — state management", () => {
  test("isWatching returns false for an unwatched project", () => {
    const reg = new WatcherRegistry();
    assert.equal(reg.isWatching(99999), false);
  });

  test("isWatching returns true after watchProject", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1001, dir);
      assert.equal(reg.isWatching(1001), true);
    } finally {
      await reg.disposeAll();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("watchProject is idempotent — calling twice starts only one watcher", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1002, dir);
      reg.watchProject(1002, dir); // second call — must be a no-op
      assert.equal(reg.getStats().count, 1, "still exactly one watcher");
    } finally {
      await reg.disposeAll();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("getStats reflects all active watchers with correct projectIds", async () => {
    const dir1 = await makeTmpDir();
    const dir2 = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1003, dir1);
      reg.watchProject(1004, dir2);

      const stats = reg.getStats();
      assert.equal(stats.count, 2);
      assert.ok(stats.projects.some((p) => p.projectId === 1003));
      assert.ok(stats.projects.some((p) => p.projectId === 1004));
    } finally {
      await reg.disposeAll();
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
    }
  });

  test("getStats.uptimeSec is a non-negative number", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1005, dir);
      const { projects } = reg.getStats();
      assert.equal(projects.length, 1);
      assert.ok(projects[0].uptimeSec >= 0);
    } finally {
      await reg.disposeAll();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe("WatcherRegistry — lifecycle", () => {
  test("unwatchProject removes the watcher and updates isWatching", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1006, dir);
      assert.equal(reg.isWatching(1006), true);

      await reg.unwatchProject(1006);

      assert.equal(reg.isWatching(1006), false);
      assert.equal(reg.getStats().count, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("unwatchProject on unknown projectId is a no-op", async () => {
    const reg = new WatcherRegistry();
    // Must not throw
    await reg.unwatchProject(99998);
    assert.equal(reg.getStats().count, 0);
  });

  test("disposeAll closes every active watcher", async () => {
    const dir1 = await makeTmpDir();
    const dir2 = await makeTmpDir();
    const reg = new WatcherRegistry();
    try {
      reg.watchProject(1007, dir1);
      reg.watchProject(1008, dir2);

      await reg.disposeAll();

      assert.equal(reg.isWatching(1007), false);
      assert.equal(reg.isWatching(1008), false);
      assert.equal(reg.getStats().count, 0);
    } finally {
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
    }
  });

  test("disposeAll on empty registry is a no-op", async () => {
    const reg = new WatcherRegistry();
    await reg.disposeAll(); // must not throw
    assert.equal(reg.getStats().count, 0);
  });
});

// ── OS-level relay ────────────────────────────────────────────────────────────

describe("WatcherRegistry — OS-level file relay", () => {
  test("relays an OS file write to the global EventBus via emitFileChange", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    const projectId = 1009;
    const received: FileChangeEvent[] = [];

    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === projectId) received.push(e);
    });

    try {
      reg.watchProject(projectId, dir);

      // Give chokidar time to initialise the OS watch handle
      await new Promise((r) => setTimeout(r, 150));

      // Write a new file — chokidar should detect the "add" event
      await fs.writeFile(path.join(dir, "relay-test.ts"), "// relay test");

      // chokidar stabilityThreshold=120ms + emitFileChange debounce=80ms + margin
      await new Promise((r) => setTimeout(r, 500));

      const match = received.find((e) => e.path.endsWith("relay-test.ts"));
      assert.ok(match, "OS write must propagate to the EventBus");
      assert.equal(match!.projectId, projectId);
      assert.ok(
        (["add", "change"] as string[]).includes(match!.type),
        `type must be add or change, got: ${match!.type}`,
      );
    } finally {
      unsub();
      await reg.disposeAll();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("does NOT relay events for paths outside the sandbox root", async () => {
    const dir = await makeTmpDir();
    const reg = new WatcherRegistry();
    const projectId = 1010;
    const received: FileChangeEvent[] = [];

    const unsub = bus.subscribe("file.change", (e) => {
      if (e.projectId === projectId) received.push(e);
    });

    try {
      reg.watchProject(projectId, dir);
      await new Promise((r) => setTimeout(r, 150));

      // Write OUTSIDE the watched dir (to the parent temp dir)
      const outsideFile = path.join(os.tmpdir(), `outside-${projectId}.ts`);
      await fs.writeFile(outsideFile, "outside sandbox");

      await new Promise((r) => setTimeout(r, 400));

      assert.equal(
        received.length,
        0,
        "events outside sandbox must not be relayed",
      );

      // Cleanup the outside file
      await fs.unlink(outsideFile).catch(() => {});
    } finally {
      unsub();
      await reg.disposeAll();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

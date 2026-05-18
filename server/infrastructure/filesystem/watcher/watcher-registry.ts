/**
 * watcher-registry.ts
 * OS-level file watcher registry — one chokidar FSWatcher per project.
 *
 * Catches file system changes that the synthetic emitters cannot detect:
 * npm install, git pull, shell exec, background processes.
 *
 * Flow:
 *   chokidar (OS inotify/FSEvents) → watcher-registry → emitFileChange
 *   → EventBus → SSE "file" topic → useRealtimeEvent → tree refresh
 *
 * The emitFileChange 80ms debounce deduplicates events that also arrive
 * from synthetic emitters (CRUD ops, agent writes), so no double-fire.
 */

import chokidar, { type FSWatcher } from "chokidar";
import path from "path";
import { emitFileChange } from "../../events/file-change-emitter.ts";

// ── Exclusions ──────────────────────────────────────────────────────────────
const IGNORED: RegExp[] = [
  /node_modules/,
  /\.git/,
  /[/\\]dist[/\\]/,
  /[/\\]\.cache[/\\]/,
  /__pycache__/,
  /\.venv/,
  /[/\\]\.data[/\\]/,
  /\.bak$/,
  /\.nura_tmp$/,
];

// ── Entry ───────────────────────────────────────────────────────────────────

interface WatchEntry {
  watcher:    FSWatcher;
  sandboxRoot: string;
  startedAt:  number;
}

// ── Registry ─────────────────────────────────────────────────────────────────

export class WatcherRegistry {
  private readonly entries = new Map<number, WatchEntry>();

  /**
   * Start an OS-level watcher for a project sandbox directory.
   * No-op if one is already running for this projectId.
   */
  watchProject(projectId: number, sandboxRoot: string): void {
    if (this.entries.has(projectId)) return;

    const absRoot = path.resolve(sandboxRoot);

    const watcher = chokidar.watch(absRoot, {
      ignored:       IGNORED,
      persistent:    true,
      ignoreInitial: true,         // don't fire for pre-existing files on start
      awaitWriteFinish: {
        stabilityThreshold: 120,   // wait 120ms after last write before emitting
        pollInterval:        60,
      },
      depth: 25,
    });

    const relay = (evType: "add" | "change" | "unlink") => (filePath: string) => {
      const rel = path.relative(absRoot, filePath);
      if (rel.startsWith("..")) return;   // escape attempt — ignore
      emitFileChange(projectId, evType, rel);
    };

    watcher.on("add",    relay("add"));
    watcher.on("change", relay("change"));
    watcher.on("unlink", relay("unlink"));
    watcher.on("error",  (err) =>
      console.warn(`[watcher-registry] project=${projectId} error:`, err),
    );

    this.entries.set(projectId, { watcher, sandboxRoot: absRoot, startedAt: Date.now() });
    console.log(`[watcher-registry] Watching project=${projectId}`);
  }

  /** Stop and destroy the watcher for a single project. */
  async unwatchProject(projectId: number): Promise<void> {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    await entry.watcher.close();
    this.entries.delete(projectId);
    console.log(`[watcher-registry] Unwatched project=${projectId}`);
  }

  /** Whether a project is actively watched. */
  isWatching(projectId: number): boolean {
    return this.entries.has(projectId);
  }

  /** Stats for health/diagnostics endpoints. */
  getStats(): {
    count: number;
    projects: Array<{ projectId: number; sandboxRoot: string; uptimeSec: number }>;
  } {
    const now = Date.now();
    const projects = [...this.entries.entries()].map(([projectId, e]) => ({
      projectId,
      sandboxRoot: e.sandboxRoot,
      uptimeSec:   Math.floor((now - e.startedAt) / 1000),
    }));
    return { count: projects.length, projects };
  }

  /** Dispose all watchers — call on server shutdown. */
  async disposeAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((id) => this.unwatchProject(id)));
  }
}

export const watcherRegistry = new WatcherRegistry();

// Graceful shutdown — close all watchers on process termination.
process.once("SIGTERM", () => watcherRegistry.disposeAll());
process.once("SIGINT",  () => watcherRegistry.disposeAll());

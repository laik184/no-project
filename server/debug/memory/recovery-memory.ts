/**
 * recovery-memory.ts
 *
 * Persistent per-project memory of past recovery attempts.
 *
 * Backed by .data/debug-memory.json so state survives server restarts.
 * Provides: record attempt, query history, compute error signatures.
 *
 * Ownership: autonomous-debug/memory — single responsibility: memory I/O.
 * No LLM calls, no bus access.
 */

import fs from "fs/promises";
import path from "path";
import type { FixAttempt, ProjectMemory } from "../types/debug-types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const MEMORY_PATH  = path.resolve(".data", "debug-memory.json");
const MAX_ATTEMPTS = 50; // per project, ring-buffer eviction

// ─── Store ────────────────────────────────────────────────────────────────────

type MemoryStore = Record<number, ProjectMemory>;

let store: MemoryStore = {};
let dirty = false;
let saveTimer: NodeJS.Timeout | null = null;

// ─── Persistence ─────────────────────────────────────────────────────────────

async function load(): Promise<void> {
  try {
    const raw = await fs.readFile(MEMORY_PATH, "utf8");
    store = JSON.parse(raw) as MemoryStore;
  } catch {
    store = {};
  }
}

function scheduleSave(): void {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
      await fs.writeFile(MEMORY_PATH, JSON.stringify(store, null, 2), "utf8");
    } catch (err) {
      console.error("[recovery-memory] Failed to persist:", err);
    }
  }, 1_000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function getOrCreate(projectId: number): ProjectMemory {
  if (!store[projectId]) {
    store[projectId] = {
      projectId,
      attempts: [],
      consecutiveFailures: 0,
      knownErrorSignatures: [],
    };
  }
  return store[projectId];
}

export async function initMemory(): Promise<void> {
  await load();
}

export function recordAttempt(projectId: number, attempt: FixAttempt): void {
  const mem = getOrCreate(projectId);
  mem.attempts.push(attempt);
  if (mem.attempts.length > MAX_ATTEMPTS) mem.attempts.shift();

  if (attempt.outcome === "success") {
    mem.consecutiveFailures = 0;
    mem.lastSuccessTs = attempt.ts;
  } else {
    mem.consecutiveFailures += 1;
  }

  // Track error signature to avoid repeating failed strategies
  const sig = `${attempt.errorType}:${attempt.outcome}`;
  if (!mem.knownErrorSignatures.includes(sig)) {
    mem.knownErrorSignatures.push(sig);
    if (mem.knownErrorSignatures.length > 30) mem.knownErrorSignatures.shift();
  }

  scheduleSave();
}

export function getMemory(projectId: number): ProjectMemory {
  return getOrCreate(projectId);
}

export function getConsecutiveFailures(projectId: number): number {
  return store[projectId]?.consecutiveFailures ?? 0;
}

export function resetConsecutiveFailures(projectId: number): void {
  const mem = store[projectId];
  if (mem) {
    mem.consecutiveFailures = 0;
    scheduleSave();
  }
}

/** Last N attempts for this project — most recent last. */
export function getRecentAttempts(projectId: number, n = 5): FixAttempt[] {
  return (store[projectId]?.attempts ?? []).slice(-n);
}

/** Build a compact memory summary for LLM context injection. */
export function buildMemorySummary(projectId: number): string {
  const mem = store[projectId];
  if (!mem || mem.attempts.length === 0) return "";

  const recent = mem.attempts.slice(-3);
  const lines = recent.map(a =>
    `  - [${new Date(a.ts).toISOString()}] ${a.errorType} → ${a.outcome}: ${a.summary.slice(0, 120)}`
  );

  return [
    `RECOVERY HISTORY (project ${projectId}):`,
    `  Consecutive failures: ${mem.consecutiveFailures}`,
    `  Recent attempts:`,
    ...lines,
  ].join("\n");
}

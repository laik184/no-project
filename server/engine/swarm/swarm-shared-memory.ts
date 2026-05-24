/**
 * server/engine/swarm/swarm-shared-memory.ts
 *
 * Isolated memory lanes per agent within a shared swarm execution context.
 * Prevents cross-agent mutation while enabling controlled result sharing.
 * Single responsibility: memory isolation and controlled read access.
 */

import type { SwarmAgentRole } from "./swarm-types.ts";

// ── Memory lane ───────────────────────────────────────────────────────────────

export interface MemoryLane {
  agentId:    string;
  role:       SwarmAgentRole;
  swarmId:    string;
  writes:     MemoryEntry[];
  maxEntries: number;
}

export interface MemoryEntry {
  key:        string;
  value:      unknown;
  writtenAt:  number;
  version:    number;
}

// ── Swarm shared context (read-only cross-agent) ──────────────────────────────

export interface SwarmContext {
  swarmId:   string;
  goal:      string;
  planSummary?: string;
  artifacts: Map<string, unknown>;  // file → content (set by merge-agent only)
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _lanes    = new Map<string, MemoryLane>();       // agentId → lane
const _contexts = new Map<string, SwarmContext>();     // swarmId → context

// ── Lane management ───────────────────────────────────────────────────────────

export function openLane(
  agentId:    string,
  role:       SwarmAgentRole,
  swarmId:    string,
  maxEntries: number = 64,
): MemoryLane {
  const lane: MemoryLane = { agentId, role, swarmId, writes: [], maxEntries };
  _lanes.set(agentId, lane);
  return lane;
}

export function write(agentId: string, key: string, value: unknown): void {
  const lane = _lanes.get(agentId);
  if (!lane) throw new Error(`[swarm-memory] No lane for agent ${agentId}`);

  const existing = lane.writes.find(e => e.key === key);
  if (existing) {
    existing.value     = value;
    existing.writtenAt = Date.now();
    existing.version++;
    return;
  }

  if (lane.writes.length >= lane.maxEntries) {
    lane.writes.shift(); // evict oldest
  }

  lane.writes.push({ key, value, writtenAt: Date.now(), version: 1 });
}

export function read(agentId: string, key: string): unknown | undefined {
  return _lanes.get(agentId)?.writes.find(e => e.key === key)?.value;
}

export function readAll(agentId: string): Record<string, unknown> {
  const lane = _lanes.get(agentId);
  if (!lane) return {};
  return Object.fromEntries(lane.writes.map(e => [e.key, e.value]));
}

export function closeLane(agentId: string): void {
  _lanes.delete(agentId);
}

// ── Shared context (read for all agents, write by swarm coordinator) ──────────

export function initContext(swarmId: string, goal: string): SwarmContext {
  const ctx: SwarmContext = { swarmId, goal, artifacts: new Map() };
  _contexts.set(swarmId, ctx);
  return ctx;
}

export function getContext(swarmId: string): SwarmContext | undefined {
  return _contexts.get(swarmId);
}

export function setPlanSummary(swarmId: string, summary: string): void {
  const ctx = _contexts.get(swarmId);
  if (ctx) ctx.planSummary = summary;
}

export function publishArtifact(swarmId: string, key: string, value: unknown): void {
  _contexts.get(swarmId)?.artifacts.set(key, value);
}

export function clearContext(swarmId: string): void {
  _contexts.delete(swarmId);
}

export function clearAllLanes(swarmId: string): void {
  for (const [agentId, lane] of _lanes) {
    if (lane.swarmId === swarmId) _lanes.delete(agentId);
  }
}

// ── Snapshot for checkpointing ────────────────────────────────────────────────

export function snapshotLanes(swarmId: string): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [agentId, lane] of _lanes) {
    if (lane.swarmId === swarmId) result[agentId] = readAll(agentId);
  }
  return result;
}

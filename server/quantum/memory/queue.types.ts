/**
 * queue.types.ts
 *
 * Supplemental queue-specific types for the memory write queue subsystem.
 * Extends base types from memory-types.ts with queue infrastructure contracts.
 */

import type { QueueKey } from "./memory-types.ts";

// ── Backpressure ──────────────────────────────────────────────────────────────

export interface BackpressureState {
  queueKey:      QueueKey;
  depth:         number;
  isThrottled:   boolean;
  throttledSince: number | null;
}

export interface BackpressurePolicy {
  /** Lane depth that triggers throttle warning. */
  warnDepth:  number;
  /** Lane depth that triggers hard block. */
  blockDepth: number;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface LaneHealth {
  queueKey:       QueueKey;
  depth:          number;
  active:         boolean;
  stalledMs:      number;
  failureRate:    number;
  isHealthy:      boolean;
}

export interface QueueHealthSnapshot {
  timestamp:    number;
  totalLanes:   number;
  activeLanes:  number;
  stalledLanes: number;
  totalPending: number;
  lanes:        LaneHealth[];
}

// ── Dispatch result ───────────────────────────────────────────────────────────

export interface DispatchOutcome {
  success:    boolean;
  requestId:  string;
  filePath:   string;
  durationMs: number;
  retries:    number;
  checksum?:  string;
  error?:     string;
}

// ── Policy decision ───────────────────────────────────────────────────────────

export type PolicyVerdict = "allow" | "block" | "throttle";

export interface PolicyDecision {
  verdict:  PolicyVerdict;
  reason:   string;
  code:     string;
}

// ── Ownership ─────────────────────────────────────────────────────────────────

export interface OwnershipToken {
  tokenId:   string;
  ownerId:   string;
  runId:     string;
  filePath:  string;
  queueKey:  QueueKey;
  issuedAt:  number;
  expiresAt: number;
}

export interface OwnershipClaim {
  ownerId:  string;
  runId:    string;
  filePath: string;
  queueKey: QueueKey;
  ttlMs?:   number;
}

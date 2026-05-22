/**
 * memory-telemetry.ts
 *
 * Emits ALL 8 mandatory memory lifecycle telemetry events to the event bus.
 * Single responsibility: telemetry emission only.
 *
 * Events emitted:
 *   memory.created    — new memory entry written
 *   memory.updated    — existing memory entry updated
 *   memory.promoted   — claim promoted to verified fact
 *   memory.archived   — memory entry archived (expired/low-value)
 *   memory.injected   — context block injected into an agent prompt
 *   memory.retrieved  — memory entries retrieved for a query
 *   memory.failed     — memory operation failed (validation or I/O)
 *   memory.reconciled — conflict between entries resolved
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Payload shapes ─────────────────────────────────────────────────────────────

export interface MemoryCreatedPayload {
  entryId:   string;
  category:  string;
  projectId: number;
  score:     number;
  tags:      string[];
}

export interface MemoryUpdatedPayload {
  entryId:   string;
  category:  string;
  projectId: number;
  field:     string;
}

export interface MemoryPromotedPayload {
  claimId:   string;
  factId:    string;
  namespace: string;
  verifier:  string;
  runId:     string;
}

export interface MemoryArchivedPayload {
  entryId:   string;
  reason:    "expired" | "low_score" | "superseded" | "overflow";
  projectId: number;
}

export interface MemoryInjectedPayload {
  runId:      string;
  projectId:  number;
  blockCount: number;
  totalChars: number;
  phase:      string;
}

export interface MemoryRetrievedPayload {
  runId:     string;
  projectId: number;
  query:     string;
  resultCount: number;
  topScore:  number;
  strategy:  "semantic" | "keyword" | "structured";
}

export interface MemoryFailedPayload {
  operation: string;
  projectId: number;
  reason:    string;
  runId?:    string;
}

export interface MemoryReconciledPayload {
  conflictId:  string;
  resolution:  "kept_newer" | "kept_higher_confidence" | "merged" | "quarantined";
  affectedIds: string[];
}

// ── Emitters ──────────────────────────────────────────────────────────────────

function emit(eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event" as any, {
    phase:     "memory",
    agentName: "memory-system",
    eventType,
    payload,
    ts: Date.now(),
  });
}

export const memoryTelemetry = {
  created(p: MemoryCreatedPayload): void {
    emit("memory.created", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] created id=${p.entryId} cat=${p.category} proj=${p.projectId}`);
  },

  updated(p: MemoryUpdatedPayload): void {
    emit("memory.updated", p as unknown as Record<string, unknown>);
  },

  promoted(p: MemoryPromotedPayload): void {
    emit("memory.promoted", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] promoted claim=${p.claimId} → fact=${p.factId}`);
  },

  archived(p: MemoryArchivedPayload): void {
    emit("memory.archived", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] archived id=${p.entryId} reason=${p.reason}`);
  },

  injected(p: MemoryInjectedPayload): void {
    emit("memory.injected", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] injected run=${p.runId.slice(0,8)} blocks=${p.blockCount} chars=${p.totalChars} phase=${p.phase}`);
  },

  retrieved(p: MemoryRetrievedPayload): void {
    emit("memory.retrieved", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] retrieved proj=${p.projectId} results=${p.resultCount} strategy=${p.strategy}`);
  },

  failed(p: MemoryFailedPayload): void {
    emit("memory.failed", p as unknown as Record<string, unknown>);
    console.warn(`[memory-telemetry] failed op=${p.operation} proj=${p.projectId} reason=${p.reason}`);
  },

  reconciled(p: MemoryReconciledPayload): void {
    emit("memory.reconciled", p as unknown as Record<string, unknown>);
    console.log(`[memory-telemetry] reconciled conflict=${p.conflictId} resolution=${p.resolution}`);
  },
};

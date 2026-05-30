/**
 * server/memory/bootstrap/memory-loader.ts
 *
 * Phase 1 — Memory Loader.
 *
 * Reads persisted entries from the memory platform and reconstructs
 * the typed in-process representations needed by executor stores.
 *
 * Handles:
 *   - execution-history entries  (category: 'execution', agentSource: 'executor-execution-history')
 *   - failure-memory patterns    (category: 'bug',       agentSource: 'executor-failure-memory')
 *   - learning-store entries     (category: 'learning',  agentSource: 'executor-learning-store')
 *
 * Deduplication strategy:
 *   - execution-history: ordered by ts, deduplicated by id
 *   - failure-memory:    deduplicated by signature (keep highest occurrences)
 *   - learning-store:    deduplicated by kind::key  (keep latest version)
 *
 * Never throws — errors are caught and logged.
 */

import { memoryEngine } from '../core/memory-engine.ts';
import type { ExecutionHistoryEntry } from '../../agents/executor/memory/execution-history.ts';
import type { FailurePattern }        from '../../agents/executor/memory/failure-memory.ts';
import type { LearnedEntry, LearnedKind } from '../../agents/executor/learning/learning-store.ts';
import type { TaskKind } from '../../agents/executor/types/executor.types.ts';

const VALID_TASK_KINDS = new Set<TaskKind>(['terminal', 'filesystem', 'coding', 'verify', 'browser']);

function toTaskKind(raw: unknown): TaskKind {
  if (typeof raw === 'string' && VALID_TASK_KINDS.has(raw as TaskKind)) {
    return raw as TaskKind;
  }
  return 'coding';
}

// ── Execution history loader ───────────────────────────────────────────────────

export async function loadExecutionHistory(limit = 200): Promise<ExecutionHistoryEntry[]> {
  try {
    const raw = await memoryEngine.list('execution', {
      limit:  limit * 2,   // over-fetch to ensure we have enough after dedup
      excludeStale: false,
    });

    // Filter to executor-execution-history entries
    const histEntries = raw.filter(
      (e) => e.meta?.agentSource === 'executor-execution-history',
    );

    // Parse JSON content back into ExecutionHistoryEntry shape
    const parsed: ExecutionHistoryEntry[] = [];
    for (const entry of histEntries) {
      try {
        const data = JSON.parse(entry.content) as Partial<ExecutionHistoryEntry>;
        if (!data.runId || !data.toolName || !data.outcome) continue;

        const restored: ExecutionHistoryEntry = {
          id:          entry.id,
          runId:       data.runId,
          taskId:      data.taskId ?? '',
          toolName:    data.toolName,
          kind:        toTaskKind(data.kind),
          outcome:     data.outcome,
          errorText:   data.errorText,
          retries:     data.retries ?? 0,
          durationMs:  data.durationMs ?? 0,
          errorClass:  data.errorClass,
          fixApplied:  data.fixApplied,
          ts:          entry.createdAt,
        };
        parsed.push(restored);
      } catch {
        // skip malformed entry
      }
    }

    // Deduplicate by id, sort by ts ascending (oldest first for ring-buffer order)
    const seen  = new Set<string>();
    const dedup: ExecutionHistoryEntry[] = [];
    for (const e of parsed.sort((a, b) => a.ts - b.ts)) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        dedup.push(e);
      }
    }

    // Return last `limit` entries (most recent)
    return dedup.slice(-limit);
  } catch (err) {
    console.error('[memory-loader] Failed to load execution history:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Failure pattern loader ────────────────────────────────────────────────────

export async function loadFailurePatterns(): Promise<FailurePattern[]> {
  try {
    const raw = await memoryEngine.list('bug', {
      limit:        500,
      excludeStale: false,
    });

    // Filter to executor-failure-memory entries
    const bugEntries = raw.filter(
      (e) => e.meta?.agentSource === 'executor-failure-memory',
    );

    // Parse and deduplicate by signature (keep highest occurrences)
    const bySignature = new Map<string, FailurePattern>();
    for (const entry of bugEntries) {
      try {
        const data = JSON.parse(entry.content) as Partial<FailurePattern>;
        if (!data.signature || !data.toolName) continue;

        const existing = bySignature.get(data.signature);
        const occ      = data.occurrences ?? 1;

        if (!existing || occ > existing.occurrences) {
          bySignature.set(data.signature, {
            signature:    data.signature,
            toolName:     data.toolName,
            kind:         toTaskKind(data.kind),
            errorSnippet: data.errorSnippet ?? '',
            occurrences:  occ,
            firstSeen:    data.firstSeen ?? entry.createdAt,
            lastSeen:     data.lastSeen  ?? entry.updatedAt,
            runIds:       data.runIds    ?? [],
          });
        }
      } catch {
        // skip malformed entry
      }
    }

    return [...bySignature.values()];
  } catch (err) {
    console.error('[memory-loader] Failed to load failure patterns:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Learning store loader ─────────────────────────────────────────────────────

export async function loadLearningEntries(): Promise<LearnedEntry[]> {
  try {
    const raw = await memoryEngine.list('learning', {
      limit:        1000,
      excludeStale: false,
    });

    // Filter to executor-learning-store entries
    const learnEntries = raw.filter(
      (e) => e.meta?.agentSource === 'executor-learning-store',
    );

    // Deduplicate by kind::key — keep the entry with the highest version
    const byKey = new Map<string, LearnedEntry>();
    for (const entry of learnEntries) {
      try {
        const data = JSON.parse(entry.content) as Partial<LearnedEntry & { kind: LearnedKind; key: string }>;
        if (!data.kind || !data.key) continue;

        const ck       = `${data.kind}::${data.key}`;
        const existing = byKey.get(ck);
        const version  = data.version ?? 1;

        if (!existing || version > existing.version) {
          byKey.set(ck, {
            id:          entry.id,
            kind:        data.kind,
            key:         data.key,
            value:       typeof data.value === 'number' ? data.value : 0.5,
            evidence:    data.evidence ?? 1,
            lastUpdated: entry.updatedAt,
            version,
            metadata:    data.metadata,
          });
        }
      } catch {
        // skip malformed entry
      }
    }

    return [...byKey.values()];
  } catch (err) {
    console.error('[memory-loader] Failed to load learning entries:', err instanceof Error ? err.message : err);
    return [];
  }
}

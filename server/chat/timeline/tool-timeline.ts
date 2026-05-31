/**
 * tool-timeline.ts — Records tool call lifecycle events in the timeline.
 *
 * Phase 3 additions (T2/T3/T4):
 *  - recordCompleted now unwraps tool-specific result fields into top-level
 *    entry.meta so frontend cards can read them directly:
 *      git tools   → meta.commitHash, meta.branch, meta.filesChanged
 *      deploy tools → meta.url, meta.environment
 *      screenshot   → meta.imageUrl, meta.imageData, meta.url
 */
import { eventTimeline } from './event-timeline.ts';
import type { TimelineEntry } from './event-timeline.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Pick the first defined string value from a result object. */
function pick(
  res: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    if (typeof res[k] === 'string' && res[k]) return res[k] as string;
  }
}

/**
 * After storing the raw result, copy recognised fields into top-level meta
 * so frontend cards can read them via item.meta.X without nesting.
 */
function enrichMeta(entry: TimelineEntry, result: unknown): void {
  const res = asRecord(result);
  if (!res) return;

  const tool = (entry.tool ?? '').toLowerCase();

  // T3 — Git metadata
  if (tool.startsWith('git') || tool.includes('git')) {
    const hash = pick(res, 'commitHash', 'hash', 'sha', 'commit');
    if (hash)                         entry.meta!.commitHash   = hash.slice(0, 40);
    if (typeof res.branch === 'string' && res.branch) entry.meta!.branch = res.branch;
    if (typeof res.filesChanged === 'number')         entry.meta!.filesChanged = res.filesChanged;
    if (typeof res.message === 'string' && res.message) entry.meta!.message = res.message;
  }

  // T4 — Deploy metadata
  if (tool.startsWith('deploy') || tool.includes('deploy')) {
    const url = pick(res, 'url', 'deployUrl', 'appUrl', 'link');
    if (url) entry.meta!.url = url;
    if (typeof res.environment === 'string') entry.meta!.environment = res.environment;
    if (typeof res.buildId     === 'string') entry.meta!.buildId     = res.buildId;
  }

  // T2 — Screenshot metadata
  if (tool.includes('screenshot') || tool.includes('preview_screenshot')) {
    const imgUrl = pick(res, 'imageUrl', 'screenshotUrl', 'src');
    if (imgUrl) entry.meta!.imageUrl = imgUrl;
    if (typeof res.imageData === 'string') entry.meta!.imageData = res.imageData;
    const pageUrl = pick(res, 'url', 'pageUrl', 'origin');
    if (pageUrl) entry.meta!.url = pageUrl;
  }
}

// ── public API ─────────────────────────────────────────────────────────────────

export const toolTimeline = {
  recordStarted(
    runId:  string,
    tool:   string,
    phase?: string,
    args?:  Record<string, unknown>,
  ): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'tool_call',
      label:  `${tool}${phase ? ` [${phase}]` : ''}`,
      status: 'running',
      phase,
      tool,
      meta:   args ? { args } : undefined,
      ts:     Date.now(),
    });
  },

  /** Mark a tool call as done. Unwraps known result fields into meta (T2/T3/T4). */
  recordCompleted(runId: string, entryId: number, result?: unknown): void {
    eventTimeline.updateStatus(runId, entryId, 'done');
    const entry = eventTimeline.list(runId).find((e) => e.id === entryId);
    if (!entry) return;
    if (!entry.meta) entry.meta = {};
    if (result !== undefined) {
      entry.meta.result = result;    // always store raw result
      enrichMeta(entry, result);     // T2/T3/T4: lift fields to top-level meta
    }
  },

  recordFailed(runId: string, entryId: number, error: string): void {
    eventTimeline.updateStatus(runId, entryId, 'error', error);
  },

  recordFileWrite(runId: string, filePath: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:     'file_write',
      label:    `Wrote ${filePath}`,
      status:   'done',
      filePath,
      ts:       Date.now(),
    });
  },
};

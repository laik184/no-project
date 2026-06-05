/**
 * server/services/console/log-service.ts
 *
 * Handles log ingestion, enrichment, persistence, and streaming fan-out.
 * Pipeline: raw text → parseLogLine → installTracker → logRepository → emitLogLine
 */

import { parseLogLine }     from '../../console/parsers/log-parser.ts';
import { emitLogLine }      from '../../console/events/console-events.ts';
import { installTracker }   from '../../console/install/install-tracker.ts';
import { logRepository }    from '../../repositories/console/log-repository.ts';
import { makeSystemLine }   from '../../console/domain/log-line.ts';
import type { LogLine }     from '../../console/types/index.ts';

const PERSIST_BUFFER_SIZE = 20;
const PERSIST_FLUSH_MS    = 2_000;

/** Per-project write buffer to batch DB inserts. */
const buffers = new Map<number, LogLine[]>();
const timers  = new Map<number, ReturnType<typeof setTimeout>>();

async function flushBuffer(projectId: number): Promise<void> {
  const buf = buffers.get(projectId);
  if (!buf || buf.length === 0) return;
  const lines = buf.splice(0, buf.length);
  timers.delete(projectId);
  try {
    await logRepository.saveMany(projectId, lines);
  } catch (err) {
    console.error(`[log-service] DB flush failed for project ${projectId}:`, err);
  }
}

function scheduleFlush(projectId: number): void {
  if (timers.has(projectId)) return;
  const t = setTimeout(() => flushBuffer(projectId), PERSIST_FLUSH_MS);
  timers.set(projectId, t);
  if (t.unref) t.unref();
}

function bufferLine(projectId: number, line: LogLine): void {
  if (!buffers.has(projectId)) buffers.set(projectId, []);
  const buf = buffers.get(projectId)!;
  buf.push(line);

  if (buf.length >= PERSIST_BUFFER_SIZE) {
    flushBuffer(projectId).catch(() => {});
  } else {
    scheduleFlush(projectId);
  }
}

export const logService = {
  /**
   * Ingest a raw stdout/stderr line.
   * Parses, enriches, persists, and fans out via the bus.
   */
  ingest(projectId: number, rawLine: string, stream: 'stdout' | 'stderr'): void {
    const log = parseLogLine({ line: rawLine, stream });

    // Drive npm state machine if needed
    if (log.meta?.npm) {
      installTracker.onNpmMeta(projectId, log.meta.npm);
    }

    // Fan out to SSE clients via bus
    emitLogLine(projectId, log);

    // Persist async (buffered)
    bufferLine(projectId, log);
  },

  /**
   * Emit a system-generated log line (e.g. "Process started").
   */
  system(projectId: number, text: string): void {
    const log = makeSystemLine(text);
    emitLogLine(projectId, log);
    bufferLine(projectId, log);
  },

  /**
   * Fetch recent persisted logs for a project (used on reconnect).
   */
  async getRecent(projectId: number, limit = 200): Promise<LogLine[]> {
    return logRepository.findByProject(projectId, limit);
  },

  /**
   * Delete logs older than the given date.
   */
  async pruneOld(projectId: number, before: Date): Promise<number> {
    return logRepository.deleteOld(projectId, before);
  },

  /**
   * Force-flush the write buffer for a project.
   */
  async flush(projectId: number): Promise<void> {
    return flushBuffer(projectId);
  },
};

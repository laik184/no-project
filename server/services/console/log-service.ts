/**
 * server/services/console/log-service.ts
 *
 * Handles log ingestion, enrichment, persistence, and streaming fan-out.
 * Imports console internals ONLY through server/console/index.ts (public API).
 * Pipeline: raw text → parseLogLine → installTracker → logRepository → emitLogLine
 */

import {
  parseLogLine,
  emitLogLine,
  installTracker,
  makeSystemLine,
} from '../../console/index.ts';
import { logRepository } from '../../repositories/console/index.ts';
import type { LogLine }  from '../../shared/console/types.ts';

const PERSIST_BUFFER_SIZE = 20;
const PERSIST_FLUSH_MS    = 2_000;

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
  ingest(projectId: number, rawLine: string, stream: 'stdout' | 'stderr'): void {
    const log = parseLogLine({ line: rawLine, stream });

    if (log.meta?.npm) {
      installTracker.onNpmMeta(projectId, log.meta.npm);
    }

    emitLogLine(projectId, log);
    bufferLine(projectId, log);
  },

  system(projectId: number, text: string): void {
    const log = makeSystemLine(text);
    emitLogLine(projectId, log);
    bufferLine(projectId, log);
  },

  async getRecent(projectId: number, limit = 200): Promise<LogLine[]> {
    return logRepository.findByProject(projectId, limit);
  },

  async pruneOld(projectId: number, before: Date): Promise<number> {
    return logRepository.deleteOld(projectId, before);
  },

  async flush(projectId: number): Promise<void> {
    return flushBuffer(projectId);
  },
};

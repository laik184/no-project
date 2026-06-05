/**
 * server/services/terminal/logging/terminal-log-service.ts
 *
 * Per-session log storage, retrieval, filtering, and rotation.
 *
 * Write-through pattern:
 *   _logs Map               → hot in-process cache (all reads are sync)
 *   terminalLogRepository   → durable postgres-backed store (fire-and-forget on append)
 */

import { logParserService }             from './log-parser-service.ts';
import type { ParsedLogEntry, LogLevel } from './log-parser-service.ts';
import { terminalLogRepository }        from '../../../repositories/terminal/index.ts';

export class LogServiceError extends Error {
  constructor(message: string) {
    super(`[terminal-log] ${message}`);
    this.name = 'LogServiceError';
  }
}

export interface LogRecord extends ParsedLogEntry {
  sessionId: string;
  seq:       number;
  source:    'stdout' | 'stderr';
}

const MAX_RECORDS = 2000;
const _logs       = new Map<string, LogRecord[]>();

let _globalSeq = 0;

export const terminalLogService = {
  append(sessionId: string, raw: string, source: 'stdout' | 'stderr'): LogRecord {
    if (!_logs.has(sessionId)) _logs.set(sessionId, []);
    const store  = _logs.get(sessionId)!;
    const parsed = logParserService.parse(raw);

    const record: LogRecord = {
      ...parsed,
      sessionId,
      seq:    ++_globalSeq,
      source,
    };

    store.push(record);
    if (store.length > MAX_RECORDS) store.splice(0, store.length - MAX_RECORDS);

    // Write-through: persist to durable store (fire-and-forget)
    terminalLogRepository.save({
      id:        `${sessionId}_${record.seq}`,
      sessionId,
      projectId: 0,
      line:      raw,
      source,
      level:     parsed.level,
      timestamp: parsed.timestamp,
    }).catch(() => void 0);

    return record;
  },

  get(sessionId: string, limit = 200): LogRecord[] {
    return (_logs.get(sessionId) ?? []).slice(-limit);
  },

  filterByLevel(sessionId: string, level: LogLevel): LogRecord[] {
    return (_logs.get(sessionId) ?? []).filter(r => r.level === level);
  },

  filterBySource(sessionId: string, source: 'stdout' | 'stderr'): LogRecord[] {
    return (_logs.get(sessionId) ?? []).filter(r => r.source === source);
  },

  search(sessionId: string, query: string): LogRecord[] {
    const lower = query.toLowerCase();
    return (_logs.get(sessionId) ?? []).filter(r => r.message.toLowerCase().includes(lower));
  },

  since(sessionId: string, afterSeq: number): LogRecord[] {
    return (_logs.get(sessionId) ?? []).filter(r => r.seq > afterSeq);
  },

  clear(sessionId: string): void {
    _logs.delete(sessionId);
    terminalLogRepository.deleteBySession(sessionId).catch(() => void 0);
  },

  size(sessionId: string): number {
    return _logs.get(sessionId)?.length ?? 0;
  },

  sessions(): string[] {
    return [..._logs.keys()];
  },
};

/**
 * server/console/domain/log-line.ts
 *
 * Factory functions for creating LogLine domain objects.
 * Single place for ID generation and timestamp normalization.
 */

import { randomUUID } from 'crypto';
import type { LogLine, LogKind, ConsoleLineMeta } from '../../shared/console/types.ts';

export function makeLogLine(
  kind:  LogKind,
  line:  string,
  meta?: ConsoleLineMeta,
  id?:   string,
  ts?:   string,
): LogLine {
  return {
    id:   id  ?? randomUUID(),
    kind,
    line,
    ts:   ts  ?? new Date().toISOString(),
    meta,
  };
}

export function makeSystemLine(text: string, meta?: ConsoleLineMeta): LogLine {
  return makeLogLine('system', text, meta);
}

export function makeErrorLine(text: string, meta?: ConsoleLineMeta): LogLine {
  return makeLogLine('error', text, meta);
}

export function makeStdoutLine(text: string, meta?: ConsoleLineMeta): LogLine {
  return makeLogLine('stdout', text, meta);
}

export function makeStderrLine(text: string, meta?: ConsoleLineMeta): LogLine {
  return makeLogLine('stderr', text, meta);
}

/**
 * server/console/persistence/file/file-log-store.ts
 *
 * File-backed log store for offline / no-DB environments.
 * Stub implementation — activate when file persistence is needed.
 */

import type { LogLine } from '../../../shared/console/types.ts';

export const fileLogStore = {
  /** Append a log line to the project's log file. */
  async append(_projectId: number, _log: LogLine): Promise<void> {
    // TODO: fs.appendFile(logPath(_projectId), JSON.stringify(_log) + '\n');
  },

  /** Read all persisted log lines for a project. */
  async readAll(_projectId: number): Promise<LogLine[]> {
    // TODO: parse NDJSON from logPath(_projectId)
    return [];
  },

  /** Rotate / truncate old log files. */
  async rotate(_projectId: number): Promise<void> {
    // TODO: rename + truncate
  },
};

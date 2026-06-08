/**
 * console-capture.ts — Server-side console log capture for preview DevTools.
 * Receives log entries forwarded from the iframe via the preview API.
 */

import { devtoolsService } from "../../services/preview/index.ts";
import type { LogLevel }   from "../../repositories/preview/index.ts";

export interface RawConsolePayload {
  projectId: number;
  level:     string;
  args:      unknown[];
  ts?:       number;
}

function normalizeLevel(level: string): LogLevel {
  const valid: LogLevel[] = ["log", "info", "warn", "error", "debug"];
  return valid.includes(level as LogLevel) ? (level as LogLevel) : "log";
}

export const consoleCapture = {
  ingest(payload: RawConsolePayload): void {
    devtoolsService.appendConsole(
      payload.projectId,
      normalizeLevel(payload.level),
      payload.args,
    );
  },

  clear(projectId: number): void {
    devtoolsService.clearConsole(projectId);
  },

  getLogs(projectId: number, limit = 200) {
    return devtoolsService.getSnapshot(projectId, limit, 0).consoleLogs;
  },
};

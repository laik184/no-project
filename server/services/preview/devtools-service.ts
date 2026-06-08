/**
 * devtools-service.ts — DevTools data aggregation service.
 * Imports ONLY from repositories/preview/index.ts.
 */

import { previewLogRepository } from "../../repositories/preview/index.ts";
import type { ConsoleLogEntry, NetworkLogEntry, LogLevel } from "../../repositories/preview/index.ts";

export interface DevToolsSnapshot {
  consoleLogs:    ConsoleLogEntry[];
  networkLogs:    NetworkLogEntry[];
  capturedAt:     number;
}

export class DevToolsService {
  appendConsole(
    projectId: number,
    level:     LogLevel,
    args:      unknown[],
  ): void {
    previewLogRepository.appendConsole({ projectId, level, args, ts: Date.now() });
  }

  appendNetwork(
    projectId: number,
    method:    string,
    url:       string,
    status:    number | null,
    type:      string,
  ): void {
    previewLogRepository.appendNetwork({
      projectId, method, url, status, type, ts: Date.now(),
    });
  }

  getSnapshot(projectId: number, consoleLimit = 200, networkLimit = 100): DevToolsSnapshot {
    return {
      consoleLogs: previewLogRepository.getConsoleLogs(projectId, consoleLimit),
      networkLogs: previewLogRepository.getNetworkLogs(projectId, networkLimit),
      capturedAt:  Date.now(),
    };
  }

  clearConsole(projectId: number): void {
    previewLogRepository.clearConsoleLogs(projectId);
  }

  clearNetwork(projectId: number): void {
    previewLogRepository.clearNetworkLogs(projectId);
  }

  clearAll(projectId: number): void {
    previewLogRepository.clearAll(projectId);
  }
}

export const devtoolsService = new DevToolsService();

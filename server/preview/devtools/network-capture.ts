/**
 * network-capture.ts — Server-side network request capture for preview DevTools.
 * Receives XHR/fetch events forwarded from the iframe via the preview API.
 */

import { devtoolsService } from "../../services/preview/index.ts";

export interface RawNetworkPayload {
  projectId: number;
  method:    string;
  url:       string;
  status:    number | null;
  type:      string;
  ts?:       number;
}

export const networkCapture = {
  ingest(payload: RawNetworkPayload): void {
    devtoolsService.appendNetwork(
      payload.projectId,
      (payload.method ?? "GET").toUpperCase(),
      payload.url ?? "",
      payload.status ?? null,
      payload.type ?? "xhr",
    );
  },

  clear(projectId: number): void {
    devtoolsService.clearNetwork(projectId);
  },

  getLogs(projectId: number, limit = 100) {
    return devtoolsService.getSnapshot(projectId, 0, limit).networkLogs;
  },
};

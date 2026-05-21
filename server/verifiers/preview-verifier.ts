/**
 * server/verifiers/preview-verifier.ts
 * Verifies the project preview URL responds with a valid HTTP status.
 * Single responsibility: validate preview reachability. Never executes tools.
 */

import { runtimeManager } from "../infrastructure/runtime/runtime-manager.ts";
import type { VerifierResult } from "./types.ts";

const FETCH_TIMEOUT_MS = 5_000;
const VALID_STATUSES   = new Set([200, 301, 302, 304]);

export async function runPreviewVerifier(
  projectId: number,
): Promise<VerifierResult> {
  let port: number | undefined;

  try {
    const processes = runtimeManager.getProcesses(projectId);
    port = processes?.find(p => p.port)?.port;
  } catch {
    // runtime manager unavailable
  }

  if (!port) {
    return {
      verifier: "preview",
      status:   "warning",
      message:  "No port detected — cannot verify preview URL.",
      detail:   "Start the dev server so a port can be detected.",
      blocksExecution: false,
    };
  }

  const url = `http://localhost:${port}/`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { "Accept": "text/html" },
    });
    clearTimeout(timer);

    if (VALID_STATUSES.has(res.status)) {
      return {
        verifier: "preview",
        status:   "passed",
        message:  `Preview responding at port ${port} (HTTP ${res.status}).`,
        blocksExecution: false,
      };
    }

    return {
      verifier: "preview",
      status:   "failed",
      message:  `Preview returned HTTP ${res.status} at port ${port}.`,
      detail:   "Fix server errors before marking task complete.",
      blocksExecution: true,
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Request timed out" : e?.message ?? "Fetch failed";
    return {
      verifier: "preview",
      status:   "failed",
      message:  `Preview unreachable at port ${port}: ${msg}`,
      detail:   "Ensure the dev server is running and not crashing.",
      blocksExecution: true,
    };
  }
}

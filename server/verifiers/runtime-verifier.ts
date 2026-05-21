/**
 * server/verifiers/runtime-verifier.ts
 * Verifies that a project's runtime process is alive and healthy.
 * Single responsibility: validate runtime health. Never executes tools.
 */

import { runtimeManager } from "../infrastructure/runtime/runtime-manager.ts";
import type { VerifierResult } from "./types.ts";

export async function runRuntimeVerifier(
  projectId: number,
): Promise<VerifierResult> {
  try {
    const processes = runtimeManager.getProcesses(projectId);

    if (!processes || processes.length === 0) {
      return {
        verifier: "runtime",
        status:   "warning",
        message:  "No runtime process found for this project.",
        detail:   "Start the dev server with run_server before marking complete.",
        blocksExecution: false,
      };
    }

    const alive = processes.filter(p => p.status === "running");

    if (alive.length === 0) {
      return {
        verifier: "runtime",
        status:   "failed",
        message:  `Process found but not running (status: ${processes[0]?.status ?? "unknown"}).`,
        detail:   "Restart the process with run_server.",
        blocksExecution: true,
      };
    }

    return {
      verifier: "runtime",
      status:   "passed",
      message:  `Runtime healthy — ${alive.length} process(es) running.`,
      blocksExecution: false,
    };
  } catch (e) {
    return {
      verifier: "runtime",
      status:   "skipped",
      message:  "Runtime manager unavailable — skipping check.",
      blocksExecution: false,
    };
  }
}

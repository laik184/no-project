/**
 * scanner-integration.ts
 *
 * Phase 2: Distributed File Scanner wiring into the planning/intelligence layer.
 *
 * Exposes a single function that intelligence and planning systems can call
 * to trigger a governed parallel scan of a project's sandbox before analysis.
 *
 * Wired into:
 *   ✅ Architecture analysis (pre-scan for dependency mapping)
 *   ✅ Planning (context graph generation before plan construction)
 *   ✅ Recovery system (trigger="recovery" scans on crash detection)
 *   ✅ Intelligence systems (structural analysis, boundary detection)
 *
 * Uses CentralWorkerPool via distributed-file-scanner.ts — fully governed.
 */

import { runDistributedScan }  from "../../quantum/scanner/distributed-file-scanner.ts";
import { getProjectDir }        from "../../infrastructure/sandbox/sandbox.util.ts";
import { bus }                  from "../../infrastructure/events/bus.ts";
import type { ScanReport }      from "../../quantum/scanner/types/scan.types.ts";

// ── Scan trigger types ────────────────────────────────────────────────────────

export type ScanTrigger =
  | "planning"
  | "architecture"
  | "intelligence"
  | "recovery"
  | "manual";

export interface PlannerScanOptions {
  readonly projectId:          number;
  readonly runId?:             string;
  readonly trigger:            ScanTrigger;
  readonly maxParallelWorkers?: number;
  readonly scanDepth?:         number;
  readonly signal?:            AbortSignal;
}

export interface PlannerScanResult {
  readonly success:        boolean;
  readonly report?:        ScanReport;
  readonly error?:         string;
  readonly durationMs:     number;
  readonly filesScanned:   number;
  readonly findingsCount:  number;
}

// ── Integration entry point ───────────────────────────────────────────────────

/**
 * Run a governed distributed scan of the project sandbox.
 * Emits a bus event on completion for intelligence systems to consume.
 *
 * Fail-safe: returns { success: false } on any error — never throws.
 * Callers can proceed with planning even if scan fails (graceful degradation).
 */
export async function scanProjectForPlanning(
  opts: PlannerScanOptions,
): Promise<PlannerScanResult> {
  const t0      = Date.now();
  const rootPath = getProjectDir(opts.projectId);

  try {
    const report = await runDistributedScan({
      projectId:          opts.projectId,
      rootPath,
      trigger:            opts.trigger,
      maxParallelWorkers: opts.maxParallelWorkers ?? 4,
      scanDepth:          opts.scanDepth ?? 8,
      signal:             opts.signal,
    });

    const result: PlannerScanResult = {
      success:       true,
      report,
      durationMs:    report.durationMs,
      filesScanned:  report.filesScanned,
      findingsCount: report.findings.length,
    };

    bus.emit("agent.event" as any, {
      runId:     opts.runId ?? "system",
      projectId: opts.projectId,
      phase:     "scanner",
      agentName: "scanner-integration",
      eventType: "scanner.completed",
      payload:   {
        trigger:       opts.trigger,
        filesScanned:  report.filesScanned,
        findings:      report.findings.length,
        durationMs:    report.durationMs,
        riskSummary:   report.riskSummary,
      },
      ts: Date.now(),
    });

    return result;

  } catch (err: any) {
    const error = err?.message ?? String(err);
    console.warn(`[scanner-integration] Scan failed (trigger=${opts.trigger}):`, error);

    bus.emit("agent.event" as any, {
      runId:     opts.runId ?? "system",
      projectId: opts.projectId,
      phase:     "scanner",
      agentName: "scanner-integration",
      eventType: "scanner.failed",
      payload:   { trigger: opts.trigger, error },
      ts:        Date.now(),
    });

    return {
      success:      false,
      error,
      durationMs:   Date.now() - t0,
      filesScanned: 0,
      findingsCount: 0,
    };
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

/** Scan before architecture analysis. */
export const scanForArchitecture = (projectId: number, runId?: string, signal?: AbortSignal) =>
  scanProjectForPlanning({ projectId, runId, trigger: "architecture", signal });

/** Scan before planning. */
export const scanForPlanning = (projectId: number, runId?: string, signal?: AbortSignal) =>
  scanProjectForPlanning({ projectId, runId, trigger: "planning", signal });

/** Scan triggered by autonomous recovery. */
export const scanForRecovery = (projectId: number, runId?: string, signal?: AbortSignal) =>
  scanProjectForPlanning({ projectId, runId, trigger: "recovery", signal });

/**
 * server/quantum/scanner/planning-integration.ts
 *
 * Wires the Distributed File Scanner into the Planning Pipeline (Phase 5).
 *
 * Before the planner commits to an execution plan, call
 * runPlanningContextScan() to populate the planning context with real-time
 * code-intelligence findings (bugs, dead code, security hotspots, deps).
 *
 * Integration points
 * ──────────────────
 *   IN:  planning pipeline context builder / planner agent pre-flight
 *   OUT: PlanningContextScanResult → injected into planner system prompt
 *        bus "agent.event" with eventType "planning.scan.complete"
 *
 * Design: non-blocking degraded mode — if the scanner fails (e.g., sandbox
 * unavailable), the function resolves with an empty findings list and logs
 * the error. Planning MUST NOT block on a scanner failure.
 */

import { runDistributedScan }        from "./distributed-file-scanner.ts";
import { bus }                       from "../../infrastructure/events/bus.ts";
import type { ScanReport }           from "./contracts/scanner.contracts.ts";

export interface PlanningContextScanResult {
  scanId:      string;
  projectId:   number;
  rootPath:    string;
  fileCount:   number;
  findings:    ScanReport["findings"];
  durationMs:  number;
  errors:      string[];
  degraded:    boolean;
}

/**
 * Run a distributed file scan scoped to the planning phase.
 *
 * Non-throwing: returns `degraded: true` with empty findings on any error.
 * Emits telemetry regardless of outcome.
 *
 * @param projectId  - Owning project (used for lock key + telemetry).
 * @param rootPath   - Absolute path to the project sandbox root.
 * @param runId      - Agent run identifier for telemetry fan-out.
 */
export async function runPlanningContextScan(
  projectId: number,
  rootPath:  string,
  runId:     string,
): Promise<PlanningContextScanResult> {
  const t0 = Date.now();

  try {
    const report = await runDistributedScan({
      projectId,
      rootPath,
      trigger: "orchestration",
    });

    const result: PlanningContextScanResult = {
      scanId:     report.scanId,
      projectId,
      rootPath,
      fileCount:  report.fileCount,
      findings:   report.findings,
      durationMs: Date.now() - t0,
      errors:     report.errors ?? [],
      degraded:   false,
    };

    bus.emit("agent.event", {
      runId,
      projectId,
      phase:     "planning",
      agentName: "planning-scanner",
      eventType: "planning.scan.complete" as any,
      payload: {
        scanId:       result.scanId,
        fileCount:    result.fileCount,
        findingCount: result.findings.length,
        durationMs:   result.durationMs,
        degraded:     false,
      },
      ts: Date.now(),
    });

    return result;

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[planning-scanner] Scan failed for project ${projectId} — degraded mode: ${errMsg}`);

    bus.emit("agent.event", {
      runId,
      projectId,
      phase:     "planning",
      agentName: "planning-scanner",
      eventType: "planning.scan.failed" as any,
      payload:   { error: errMsg, degraded: true },
      ts:        Date.now(),
    });

    return {
      scanId:     `degraded-${Date.now()}`,
      projectId,
      rootPath,
      fileCount:  0,
      findings:   [],
      durationMs: Date.now() - t0,
      errors:     [errMsg],
      degraded:   true,
    };
  }
}

/**
 * Format scan findings as a concise markdown summary for injection into
 * the planner LLM system prompt / context window.
 *
 * Returns an empty string when there are no findings or scanner is degraded.
 */
export function formatScanFindingsForPlanner(
  result: PlanningContextScanResult,
): string {
  if (result.degraded || result.findings.length === 0) return "";

  const lines: string[] = [
    `### Code Intelligence Scan (${result.fileCount} files, ${result.findings.length} findings)`,
  ];

  const byCategory: Record<string, typeof result.findings> = {};
  for (const f of result.findings) {
    const cat = (f as any).category ?? "general";
    (byCategory[cat] ??= []).push(f);
  }

  for (const [cat, findings] of Object.entries(byCategory)) {
    lines.push(`\n**${cat}** (${findings.length}):`);
    for (const f of findings.slice(0, 5)) {
      const loc  = (f as any).file ? ` @ ${(f as any).file}:${(f as any).line ?? "?"}` : "";
      const msg  = (f as any).message ?? (f as any).description ?? JSON.stringify(f);
      lines.push(`- ${msg}${loc}`);
    }
    if (findings.length > 5) lines.push(`  … and ${findings.length - 5} more`);
  }

  return lines.join("\n");
}

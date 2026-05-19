/**
 * metrics.service.ts — runtime observability for preview processes.
 *
 * Pulls live data from processRegistry (single source of truth).
 * No separate state Maps — zero desync risk.
 *
 * Provides:
 *   getProjectMetrics(projectId) — per-project snapshot
 *   getAllMetrics()              — all running projects
 */

import { processRegistry } from "../../infrastructure/process/process-registry.ts";
import { getLifecycleManager } from "../lifecycle/preview-lifecycle.manager.ts";

export interface RuntimeMetrics {
  projectId:    number;
  pid?:         number;
  port?:        number;
  status:       string;
  lifecycleState: string;
  uptimeMs:     number;
  uptimeFmt:    string;
  restartCount: number;
  recentLogs:   string[];
  healthy:      boolean;
  ts:           number;
}

function formatUptime(ms: number): string {
  if (ms < 1_000) return "<1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min}m`;
}

export function getProjectMetrics(projectId: number): RuntimeMetrics | null {
  const entry = processRegistry.get(projectId);
  if (!entry) return null;

  const lifecycleState = getLifecycleManager(projectId).getState();
  const uptimeMs       = Date.now() - entry.startedAt;

  return {
    projectId,
    pid:           entry.pid,
    port:          entry.port,
    status:        entry.status,
    lifecycleState,
    uptimeMs,
    uptimeFmt:     formatUptime(uptimeMs),
    restartCount:  entry.restartCount,
    recentLogs:    processRegistry.getLogs(projectId, 15),
    healthy:       entry.status === "running",
    ts:            Date.now(),
  };
}

export function getAllMetrics(): RuntimeMetrics[] {
  return processRegistry.all()
    .map(e => getProjectMetrics(e.projectId))
    .filter((m): m is RuntimeMetrics => m !== null);
}

/**
 * runtime-health.ts — RuntimeHealth domain entity.
 * Snapshot of a running project process health.
 * Immutable value object.
 */

export type RuntimeStatus = "running" | "starting" | "stopped" | "crashed" | "unknown";

export interface RuntimeHealth {
  readonly projectId:    number;
  readonly healthy:      boolean;
  readonly status:       RuntimeStatus;
  readonly port:         number | null;
  readonly pid:          number | null;
  readonly uptime:       number;           // ms since start
  readonly uptimeFmt:    string;           // human-readable
  readonly restartCount: number;
  readonly memoryBytes:  number | null;
  readonly cpuPercent:   number | null;
  readonly lastRestart:  number | null;    // epoch ms
  readonly checkedAt:    number;           // epoch ms
}

export function createRuntimeHealth(projectId: number): RuntimeHealth {
  return Object.freeze({
    projectId,
    healthy:      false,
    status:       "unknown" as RuntimeStatus,
    port:         null,
    pid:          null,
    uptime:       0,
    uptimeFmt:    "0s",
    restartCount: 0,
    memoryBytes:  null,
    cpuPercent:   null,
    lastRestart:  null,
    checkedAt:    Date.now(),
  });
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60}s`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

import { bus } from '../../infrastructure/events/bus.ts';

const BLOCKED: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /curl[^|]*\|\s*bash/,
  /wget[^|]*\|\s*sh/,
  /\bmkfs\b/,
  /\bdd\b.*of=\/dev/,
];

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export interface ValidatedRuntimeCommand {
  raw:        string;
  executable: string;
  args:       string[];
}

export function checkCommand(cmd: string): PolicyResult {
  for (const pattern of BLOCKED) {
    if (pattern.test(cmd)) {
      return { allowed: false, reason: `Blocked by policy: ${pattern.source}` };
    }
  }
  return { allowed: true };
}

export function parseAndValidateRuntimeCommand(cmd: string): ValidatedRuntimeCommand {
  const policy = checkCommand(cmd);
  if (!policy.allowed) throw new Error(`[runtime-command-policy] Blocked: ${policy.reason}`);
  const parts = cmd.trim().split(/\s+/);
  return { raw: cmd, executable: parts[0], args: parts.slice(1) };
}

export function emitSpawnStarted(projectId: number, command: string, pid?: number): void {
  bus.emit('agent.event', {
    runId: `runtime-${projectId}`, projectId,
    phase: 'runtime', eventType: 'process.started',
    payload: { command, pid }, ts: Date.now(),
  });
}

export function emitSpawnFailed(projectId: number, command: string, error: string): void {
  bus.emit('agent.event', {
    runId: `runtime-${projectId}`, projectId,
    phase: 'runtime', eventType: 'process.error',
    payload: { command, error }, ts: Date.now(),
  });
}

export const runtimeCommandPolicy = { checkCommand };

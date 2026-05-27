export interface ResourceLimits {
  maxProcesses:    number;
  maxMemoryMb:     number;
  maxTimeoutMs:    number;
  maxOutputBytes:  number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxProcesses:   10,
  maxMemoryMb:    512,
  maxTimeoutMs:   120_000,
  maxOutputBytes: 10 * 1024 * 1024, // 10MB
};

export function clampTimeout(ms: number): number {
  return Math.min(Math.max(ms, 1_000), DEFAULT_LIMITS.maxTimeoutMs);
}

export function truncateOutput(output: string, maxBytes = DEFAULT_LIMITS.maxOutputBytes): string {
  if (output.length <= maxBytes) return output;
  return output.slice(0, maxBytes) + '\n[output truncated]';
}

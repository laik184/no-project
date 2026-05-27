export interface ResourceLimits {
  maxMemoryMb:      number;
  maxProcesses:     number;
  maxRuntimeMs:     number;
  maxOutputBytes:   number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxMemoryMb:    512,
  maxProcesses:   20,
  maxRuntimeMs:   300_000,  // 5 minutes
  maxOutputBytes: 10 * 1024 * 1024, // 10 MB
};

export const NPM_INSTALL_LIMITS: ResourceLimits = {
  maxMemoryMb:    768,
  maxProcesses:   30,
  maxRuntimeMs:   120_000,  // 2 minutes
  maxOutputBytes: 10 * 1024 * 1024,
};

export function getLimitsForCommand(command: string): ResourceLimits {
  if (/^(npm|pnpm)\s+install\b/.test(command.trim())) {
    return NPM_INSTALL_LIMITS;
  }
  return DEFAULT_LIMITS;
}

export function isWithinMemoryLimit(usedMb: number, limits: ResourceLimits): boolean {
  return usedMb <= limits.maxMemoryMb;
}

export function isWithinTimeLimit(elapsedMs: number, limits: ResourceLimits): boolean {
  return elapsedMs <= limits.maxRuntimeMs;
}

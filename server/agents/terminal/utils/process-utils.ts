import { execSync } from 'child_process';

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
  try {
    process.kill(pid, signal);
  } catch {
    // Process already gone — safe to ignore
  }
}

export function getProcessMemoryMb(pid: number): number | null {
  try {
    const out = execSync(`ps -o rss= -p ${pid}`, { timeout: 2000 }).toString().trim();
    const kb = parseInt(out, 10);
    return isNaN(kb) ? null : Math.round(kb / 1024);
  } catch {
    return null;
  }
}

export function generateProcessId(): string {
  return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

import { terminateProcess } from './terminate-process.ts';

export async function forceKill(pid: number, gracePeriodMs = 3_000): Promise<boolean> {
  const graceful = terminateProcess(pid, 'SIGTERM');
  if (!graceful) return false;

  await new Promise(r => setTimeout(r, gracePeriodMs));

  try {
    process.kill(pid, 0);
    return terminateProcess(pid, 'SIGKILL');
  } catch {
    return true;
  }
}

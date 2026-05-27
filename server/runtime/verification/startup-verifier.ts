import { probePort } from '../health/port-probe.ts';
import { logBuffer, analyzeLines } from '../observer/log-buffer.ts';

export interface StartupVerificationResult {
  projectId: number;
  port?:     number;
  passed:    boolean;
  portOpen:  boolean;
  hasErrors: boolean;
  hasFatal:  boolean;
  message:   string;
  ts:        number;
}

export async function verifyStartup(
  projectId: number,
  port?:     number,
): Promise<StartupVerificationResult> {
  const portOpen = port ? await probePort(port, '127.0.0.1', 3_000) : false;
  const lines    = logBuffer.tail(projectId, 100);
  const analysis = analyzeLines(lines);

  const passed = portOpen && !analysis.hasFatalError;

  return {
    projectId,
    port,
    passed,
    portOpen,
    hasErrors: analysis.hasErrors,
    hasFatal:  analysis.hasFatalError,
    message:   passed
      ? `Server on port ${port} is healthy`
      : portOpen
        ? `Port ${port} open but errors detected`
        : `Port ${port} not reachable`,
    ts: Date.now(),
  };
}

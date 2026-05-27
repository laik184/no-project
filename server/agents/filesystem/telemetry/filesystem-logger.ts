export const filesystemLogger = {
  info(runId: string, msg: string): void {
    console.log(`[filesystem-agent][${runId}] ${msg}`);
  },
  warn(runId: string, msg: string): void {
    console.warn(`[filesystem-agent][${runId}] ⚠ ${msg}`);
  },
  error(runId: string, msg: string, err?: unknown): void {
    console.error(`[filesystem-agent][${runId}] ✖ ${msg}`, err ?? '');
  },
};

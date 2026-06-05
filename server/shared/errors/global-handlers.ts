/**
 * server/shared/errors/global-handlers.ts
 *
 * Process-level safety net.
 * Call installGlobalHandlers() once at startup (before any async code).
 *
 * Handles:
 *  - uncaughtException   — synchronous throws that escaped all try/catch
 *  - unhandledRejection  — promise rejections with no .catch()
 *
 * Neither handler is fatal by default — they log and keep the server alive
 * so one bad request does not kill the process. Fatal crashes still exit(1).
 */

import { serialize, logError } from './error-serializer.ts';

let _installed = false;

export function installGlobalHandlers(): void {
  if (_installed) return;
  _installed = true;

  process.on('uncaughtException', (err: Error) => {
    logError(err, 'uncaughtException');

    // Fatal system errors — must exit
    const fatal = err.message?.includes('EADDRINUSE') || (err as NodeJS.ErrnoException).code === 'EADDRINUSE';
    if (fatal) {
      console.error('[global] Fatal — port already in use. Exiting.');
      process.exit(1);
    }

    // Non-fatal: log and continue (server stays alive)
    console.error('[global] Uncaught exception — server continues running.');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const info = serialize(reason);
    console.error(
      `[global] Unhandled promise rejection (${info.type} / ${info.errorId}):`,
      info.technicalReason ?? info.message,
    );
  });

  process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning') return;
    console.warn(`[global] Node warning: ${warning.name} — ${warning.message}`);
  });
}

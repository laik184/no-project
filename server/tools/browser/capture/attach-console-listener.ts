/**
 * server/tools/browser/capture/attach-console-listener.ts
 *
 * Re-exports the console listener tool from validation/console-error-catcher.ts
 * so the capture/ directory surface is complete per the architecture spec.
 * No logic lives here — single-responsibility at module level.
 */

export {
  browserConsoleCatcherTool,
  browserGetConsoleErrorsTool,
  getSessionErrors,
  clearSessionErrors,
} from '../validation/console-error-catcher.ts';

/**
 * server/tools/browser/session/browser-session.ts
 *
 * Re-exports the live session accessor so tool files don't need to
 * reach into both browser-context and page-manager separately.
 */

export { getSession, hasSession, activeSessionCount } from './browser-context.ts';
export { launchBrowser, closeBrowser }                from './browser-lifecycle.ts';
export { getOrOpenPage, openAdditionalPage }          from './page-manager.ts';

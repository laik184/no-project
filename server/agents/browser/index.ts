/**
 * server/agents/browser/index.ts
 *
 * Public API surface for the Browser Agent module.
 * Import from here — not from internal sub-modules.
 */

// ── Main agent ────────────────────────────────────────────────────────────────
export {
  runBrowserAgent,
  getBrowserAgentMetrics,
  type BrowserAgentInput,
  type BrowserAgentResult,
}                               from './browser-agent.ts';

// ── Core session (used by tools layer) ───────────────────────────────────────
export {
  launchBrowserSession,
  closeBrowserSession,
  openNewPage,
  type LiveBrowserSession,
}                               from './core/browser-session.ts';

// ── State (used by browser routes) ───────────────────────────────────────────
export {
  listActiveSessions,
  getSessionCount,
}                               from './core/browser-state.ts';

// ── Event bus bridge (called by main.ts) ──────────────────────────────────────
export { initBrowserBusBridge } from './events/browser-bus-bridge.ts';

// ── Monitoring ────────────────────────────────────────────────────────────────
export { snapshotMonitor, getActiveCount }  from './monitoring/browser-monitor.ts';
export { summarizeFailures, recordFailure } from './monitoring/failure-monitor.ts';

// ── Telemetry ─────────────────────────────────────────────────────────────────
export { getActionLog }    from './telemetry/browser-logger.ts';
export { getAgentMetrics } from './telemetry/browser-metrics.ts';

// ── Screenshot utils (used by browser routes) ─────────────────────────────────
export {
  getScreenshotDir,
  listScreenshotsForRun,
}                          from './utils/screenshot-utils.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  BrowserSession,
  BrowserSessionStatus,
  BrowserLaunchOptions,
  BrowserHealthStatus,
}                          from './types/browser.types.ts';

export type {
  NavigationResult,
  PageLoadStatus,
  ViewportSize,
  FlowStep,
  FlowResult,
  FlowStepResult,
  ResponsiveTestResult,
}                          from './types/navigation.types.ts';

export type {
  UIValidationResult,
  UICheck,
  ConsoleError,
  ConsoleErrorType,
  CrashReport,
  CrashType,
  VisualDiffResult,
  PerformanceValidation,
}                          from './types/validation.types.ts';

export type {
  BrowserReport,
  ScreenshotMeta,
  ActionEntry,
  PerformanceSummary,
}                          from './types/reporting.types.ts';

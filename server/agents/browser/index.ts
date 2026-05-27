/**
 * index.ts — Public export gateway for the Browser Agent.
 * Only re-exports the agent API and its types. No business logic.
 *
 * Implementation modules (capture, interaction, navigation, validation, monitoring)
 * live in server/tools/browser/ and are consumed internally by core/.
 */

// ── Primary API ────────────────────────────────────────────────────────────
export { runBrowserAgent }         from './core/browser-agent.ts';
export type { BrowserAgentInput }  from './core/browser-agent.ts';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  BrowserSession,
  BrowserSessionStatus,
  BrowserLaunchOptions,
  BrowserHealthStatus,
}                                  from './types/browser.types.ts';

export type {
  NavigationResult,
  PageLoadStatus,
  ViewportSize,
  FlowStep,
  FlowResult,
  FlowStepResult,
  ResponsiveTestResult,
}                                  from './types/navigation.types.ts';

export type {
  UIValidationResult,
  UICheck,
  ConsoleError,
  ConsoleErrorType,
  CrashReport,
  CrashType,
  VisualDiffResult,
  PerformanceValidation,
}                                  from './types/validation.types.ts';

export type {
  BrowserReport,
  ScreenshotMeta,
  ActionEntry,
  PerformanceSummary,
}                                  from './types/reporting.types.ts';

// ── Reporting ─────────────────────────────────────────────────────────────
export { buildBrowserReport,
         summarizeReport }         from './reporting/browser-report-builder.ts';
export { formatValidationReport }  from './reporting/ui-validation-report.ts';
export { formatPerformanceReport } from './reporting/performance-report.ts';

// ── Events ────────────────────────────────────────────────────────────────
export { browserBus }              from './events/browser-events.ts';
export { navigationBus }           from './events/navigation-events.ts';
export { interactionBus }          from './events/interaction-events.ts';

// ── Telemetry ─────────────────────────────────────────────────────────────
export { browserLogger }           from './telemetry/browser-logger.ts';
export { browserMetrics }          from './telemetry/browser-metrics.ts';
export { actionTrace }             from './telemetry/action-trace.ts';

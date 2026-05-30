# BROWSER_AGENT_INDEX_AUDIT.md

## File
`server/agents/browser/index.ts`

## Role
Public Entry Point | Barrel File | Export Gateway

---

## Current Exports

| Export Name              | Kind      | Source File                              |
|--------------------------|-----------|------------------------------------------|
| `runBrowserAgent`        | function  | `./browser-agent.ts`                     |
| `getBrowserAgentMetrics` | function  | `./browser-agent.ts` (alias)             |
| `BrowserAgentInput`      | type      | `./browser-agent.ts`                     |
| `BrowserAgentResult`     | type      | `./browser-agent.ts`                     |
| `launchBrowserSession`   | function  | `./core/browser-session.ts`              |
| `closeBrowserSession`    | function  | `./core/browser-session.ts`              |
| `openNewPage`            | function  | `./core/browser-session.ts`              |
| `LiveBrowserSession`     | type      | `./core/browser-session.ts`              |
| `listActiveSessions`     | function  | `./core/browser-state.ts`                |
| `getSessionCount`        | function  | `./core/browser-state.ts`                |
| `initBrowserBusBridge`   | function  | `./events/browser-bus-bridge.ts`         |
| `snapshotMonitor`        | function  | `./monitoring/browser-monitor.ts`        |
| `getActiveCount`         | function  | `./monitoring/browser-monitor.ts`        |
| `summarizeFailures`      | function  | `./monitoring/failure-monitor.ts`        |
| `recordFailure`          | function  | `./monitoring/failure-monitor.ts`        |
| `getActionLog`           | function  | `./telemetry/browser-logger.ts`          |
| `getAgentMetrics`        | function  | `./telemetry/browser-metrics.ts`         |
| `getScreenshotDir`       | function  | `./utils/screenshot-utils.ts`            |
| `listScreenshotsForRun`  | function  | `./utils/screenshot-utils.ts`            |
| `BrowserSession`         | type      | `./types/browser.types.ts`               |
| `BrowserSessionStatus`   | type      | `./types/browser.types.ts`               |
| `BrowserLaunchOptions`   | type      | `./types/browser.types.ts`               |
| `BrowserHealthStatus`    | type      | `./types/browser.types.ts`               |
| `NavigationResult`       | type      | `./types/navigation.types.ts`            |
| `PageLoadStatus`         | type      | `./types/navigation.types.ts`            |
| `ViewportSize`           | type      | `./types/navigation.types.ts`            |
| `FlowStep`               | type      | `./types/navigation.types.ts`            |
| `FlowResult`             | type      | `./types/navigation.types.ts`            |
| `FlowStepResult`         | type      | `./types/navigation.types.ts`            |
| `ResponsiveTestResult`   | type      | `./types/navigation.types.ts`            |
| `UIValidationResult`     | type      | `./types/validation.types.ts`            |
| `UICheck`                | type      | `./types/validation.types.ts`            |
| `ConsoleError`           | type      | `./types/validation.types.ts`            |
| `ConsoleErrorType`       | type      | `./types/validation.types.ts`            |
| `CrashReport`            | type      | `./types/validation.types.ts`            |
| `CrashType`              | type      | `./types/validation.types.ts`            |
| `VisualDiffResult`       | type      | `./types/validation.types.ts`            |
| `PerformanceValidation`  | type      | `./types/validation.types.ts`            |
| `BrowserReport`          | type      | `./types/reporting.types.ts`             |
| `ScreenshotMeta`         | type      | `./types/reporting.types.ts`             |
| `ActionEntry`            | type      | `./types/reporting.types.ts`             |
| `PerformanceSummary`     | type      | `./types/reporting.types.ts`             |

---

## Export Validation Results

| Export Name              | File Exists? | Name Verified? | Notes                                      |
|--------------------------|-------------|----------------|--------------------------------------------|
| `runBrowserAgent`        | ✓           | ✓              | `export async function runBrowserAgent`    |
| `getBrowserAgentMetrics` | ✓           | ✓              | `export { getAgentMetrics as getBrowserAgentMetrics }` |
| `BrowserAgentInput`      | ✓           | ✓              | `export interface BrowserAgentInput`       |
| `BrowserAgentResult`     | ✓           | ✓              | `export interface BrowserAgentResult`      |
| `launchBrowserSession`   | ✓           | ✓              | `export async function launchBrowserSession` |
| `closeBrowserSession`    | ✓           | ✓              | `export async function closeBrowserSession` |
| `openNewPage`            | ✓           | ✓              | `export async function openNewPage`        |
| `LiveBrowserSession`     | ✓           | ✓              | `export interface LiveBrowserSession`      |
| `listActiveSessions`     | ✓           | ✓              | `export function listActiveSessions`       |
| `getSessionCount`        | ✓           | ✓              | `export function getSessionCount`          |
| `initBrowserBusBridge`   | ✓           | ✓              | `export function initBrowserBusBridge`     |
| `snapshotMonitor`        | ✓           | ✓              | `export function snapshotMonitor`          |
| `getActiveCount`         | ✓           | ✓              | `export function getActiveCount`           |
| `summarizeFailures`      | ✓           | ✓              | `export function summarizeFailures`        |
| `recordFailure`          | ✓           | ✓              | `export function recordFailure`            |
| `getActionLog`           | ✓           | ✓              | `export function getActionLog`             |
| `getAgentMetrics`        | ✓           | ✓              | `export function getAgentMetrics`          |
| `getScreenshotDir`       | ✓           | ✓              | `export function getScreenshotDir`         |
| `listScreenshotsForRun`  | ✓           | ✓              | `export function listScreenshotsForRun`    |
| All 24 types             | ✓           | ✓              | All interfaces/types verified in source    |

**Result: 0 missing exports. 0 broken exports. 0 duplicate exports.**

---

## Missing Exports
**None.** All approved public APIs are covered.

## Broken Exports
**None.** Every export target file exists and the exported name is present.

## Duplicate Exports
**None.** Each name appears exactly once.

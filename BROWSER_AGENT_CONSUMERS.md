# BROWSER_AGENT_CONSUMERS.md

## Consumers of `server/agents/browser/`

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field        | Detail                                                              |
|--------------|---------------------------------------------------------------------|
| File         | `server/orchestration/coordination/agent-coordinator.ts`           |
| Import path  | `'../../agents/browser/browser-agent.ts'` ← **DEEP IMPORT**        |
| Imported     | `runBrowserAgent`                                                   |
| Usage        | `invokeAgent()` switch case `'browser':` calls `runBrowserAgent()` |
| Status       | **VIOLATION** — should import via index                             |
| Fix          | Replace with `'../../agents/browser/index.ts'`                     |

---

### Consumer 2 — `server/tools/browser/**` (20 files)

These files are implementation-level consumers in the `server/tools/browser/` module.
They import **internal** browser agent APIs not exposed through the index barrel.

| File                                                   | Imported From (internal path)                        | Symbols                                             |
|--------------------------------------------------------|------------------------------------------------------|-----------------------------------------------------|
| `tools/browser/capture/crash-detector.ts`              | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/types/validation.types.ts`           | `CrashReport`, `CrashType`                          |
| `tools/browser/capture/screenshot-taker.ts`            | `agents/browser/utils/screenshot-utils.ts`           | `getScreenshotDir`, `buildScreenshotPath`, etc.     |
|                                                        | `agents/browser/events/browser-events.ts`            | `emitScreenshotCaptured`                            |
|                                                        | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
|                                                        | `agents/browser/telemetry/action-trace.ts`           | `actionTrace`                                       |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/types/reporting.types.ts`            | `ScreenshotMeta`                                    |
| `tools/browser/interaction/dom-interactor.ts`          | `agents/browser/events/interaction-events.ts`        | interaction emitters                                |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
|                                                        | `agents/browser/telemetry/action-trace.ts`           | `actionTrace`                                       |
|                                                        | `agents/browser/utils/performance-utils.ts`          | `elapsed`, `clampTimeout`                           |
| `tools/browser/interaction/element-finder.ts`          | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/utils/dom-utils.ts`                  | `isSafeSelector`                                    |
|                                                        | `agents/browser/events/interaction-events.ts`        | `emitElementNotFound`                               |
| `tools/browser/interaction/state-capturer.ts`          | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
| `tools/browser/monitoring/action-logger-core.ts`       | `agents/browser/telemetry/action-trace.ts`           | `actionTrace`                                       |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
| `tools/browser/monitoring/action-logger.ts`            | `agents/browser/telemetry/action-trace.ts`           | `actionTrace`                                       |
| `tools/browser/monitoring/browser-metrics.ts`          | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
| `tools/browser/monitoring/health-monitor-core.ts`      | `agents/browser/types/browser.types.ts`              | `BrowserHealthStatus`                               |
|                                                        | `agents/browser/events/browser-events.ts`            | `emitBrowserCrashed`                                |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
| `tools/browser/monitoring/performance-metrics.ts`      | `agents/browser/utils/performance-utils.ts`          | `elapsed`                                           |
|                                                        | `agents/browser/types/reporting.types.ts`            | `PerformanceSummary`                                |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
| `tools/browser/navigation/page-navigator.ts`           | `agents/browser/events/navigation-events.ts`         | navigation emitters                                 |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/telemetry/action-trace.ts`           | `actionTrace`                                       |
|                                                        | `agents/browser/utils/performance-utils.ts`          | `elapsed`                                           |
|                                                        | `agents/browser/types/navigation.types.ts`           | `NavigationResult`                                  |
|                                                        | `agents/browser/utils/navigation-utils.ts`           | `isAllowedUrl`, `normalizeUrl`, `isBlankPage`       |
| `tools/browser/navigation/responsive-tester.ts`        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/utils/performance-utils.ts`          | `elapsed`                                           |
|                                                        | `agents/browser/types/navigation.types.ts`           | `ResponsiveTestResult`                              |
| `tools/browser/navigation/user-flow-runner.ts`         | `agents/browser/events/navigation-events.ts`         | navigation emitters                                 |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
|                                                        | `agents/browser/utils/performance-utils.ts`          | `elapsed`, `clampTimeout`                           |
|                                                        | `agents/browser/types/navigation.types.ts`           | `FlowStep`, `FlowStepResult`                        |
| `tools/browser/session/browser-context.ts`             | `agents/browser/core/browser-session.ts`             | `LiveBrowserSession`                                |
| `tools/browser/session/page-manager.ts`                | `agents/browser/core/browser-session.ts`             | `openNewPage`                                       |
| `tools/browser/shared/browser-types.ts`                | `agents/browser/types/*.ts`                          | all 4 type files re-exported                        |
|                                                        | `agents/browser/core/browser-session.ts`             | `LiveBrowserSession`                                |
| `tools/browser/validation/console-error-catcher-impl.ts` | `agents/browser/telemetry/browser-logger.ts`       | `browserLogger`                                     |
|                                                        | `agents/browser/types/validation.types.ts`           | `ConsoleError`, `ConsoleErrorType`                  |
|                                                        | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
| `tools/browser/validation-core/url-validator.ts`       | `agents/browser/utils/navigation-utils.ts`           | `isAllowedUrl`, `normalizeUrl`                      |
| `tools/browser/validation/performance-tracker.ts`      | `agents/browser/utils/performance-utils.ts`          | performance utils                                   |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/types/validation.types.ts`           | `PerformanceValidation`                             |
|                                                        | `agents/browser/types/reporting.types.ts`            | `PerformanceSummary`                                |
| `tools/browser/validation/ui-validator.ts`             | `agents/browser/utils/dom-utils.ts`                  | `buildRootAppSelectors`                             |
|                                                        | `agents/browser/events/browser-events.ts`            | emitters                                            |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/telemetry/browser-metrics.ts`        | `browserMetrics`                                    |
|                                                        | `agents/browser/utils/performance-utils.ts`          | `elapsed`                                           |
|                                                        | `agents/browser/types/validation.types.ts`           | `UIValidationResult`, `UICheck`, `ConsoleError`     |
| `tools/browser/validation/visual-diff-detector.ts`     | `agents/browser/utils/screenshot-utils.ts`           | `saveBaseline`                                      |
|                                                        | `agents/browser/telemetry/browser-logger.ts`         | `browserLogger`                                     |
|                                                        | `agents/browser/types/validation.types.ts`           | `VisualDiffResult`                                  |

**Assessment**: The `tools/browser` module is a peer implementation layer that directly consumes browser agent internals (singletons, event emitters, utility functions). These are not violations of the barrel rule in the same sense — these symbols are intentionally internal (`browserLogger`, `actionTrace`, event emitters, `dom-utils`, `performance-utils`) and must NOT be added to the public index. Routing them through the index would expose implementation details the barrel is designed to hide.

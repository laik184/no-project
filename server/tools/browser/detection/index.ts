/**
 * server/tools/browser/detection/index.ts
 *
 * Fix #12 — Browser validation naming collision.
 *
 * The browser category had two directories with inverted semantics:
 *   validation/      → runtime detectors (blank screen, crash, hydration errors)
 *   validation-core/ → input validators  (url, selector, screenshot params)
 *
 * Canonical target naming:
 *   detection/    → runtime detectors   (this barrel)
 *   validation/   → input validators    (browser/validation-core/ contents)
 *
 * This barrel re-exports all detection tools from the original `validation/`
 * directory. Consuming code may import from either path during migration.
 * The old `validation/` path continues to work for backward compatibility.
 */

export { blankScreenDetectorTool, detectBlankScreen }
  from '../validation/blank-screen-detector.ts';

export { consoleErrorCatcherTool, collectConsoleErrors }
  from '../validation/console-error-catcher.ts';

export { hydrationErrorDetectorTool, detectHydrationErrors }
  from '../validation/hydration-error-detector.ts';

export { runtimeCrashDetectorTool, detectRuntimeCrash }
  from '../validation/runtime-crash-detector.ts';

export { validateUiTool, runUiValidation }
  from '../validation/validate-ui.ts';

export { validatePerformanceTool, validatePagePerformance }
  from '../validation/validate-performance.ts';

export { compareScreenshotsTool, compareScreenshots }
  from '../validation/compare-screenshots.ts';

export { collectPerformanceTool, collectPerformanceMetrics }
  from '../validation/collect-performance.ts';

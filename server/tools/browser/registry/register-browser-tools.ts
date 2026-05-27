/**
 * server/tools/browser/registry/register-browser-tools.ts
 *
 * Registers ALL browser tools with the central tool registry.
 * Call once at application boot, before sealRegistry().
 * Idempotent — subsequent calls are no-ops.
 */

import { registerTool } from '../../../tools/registry/tool-registry.ts';

// ── Session lifecycle ──────────────────────────────────────────────────────────
import { browserHealthTool }            from '../monitoring/browser-health-monitor.ts';

// ── Navigation ────────────────────────────────────────────────────────────────
import { browserNavigateTool }          from '../navigation/navigate-to-url.ts';
import { browserReloadTool }            from '../navigation/reload-page.ts';
import { browserWaitForLoadTool }       from '../navigation/wait-for-load.ts';
import { browserRunFlowTool }           from '../navigation/run-user-flow.ts';
import { browserTestViewportTool }      from '../navigation/test-viewport.ts';
import { browserResponsiveTestsTool }   from '../navigation/responsive-tests.ts';

// ── Interaction ────────────────────────────────────────────────────────────────
import { browserClickTool }             from '../interaction/click-element.ts';
import { browserFillTool }              from '../interaction/fill-input.ts';
import { browserSelectTool }            from '../interaction/select-option.ts';
import { browserWaitForElementTool }    from '../interaction/wait-for-element.ts';
import { browserWaitForVisibleTool }    from '../interaction/wait-for-visible.ts';
import { browserIsElementPresentTool }  from '../interaction/is-element-present.ts';
import { browserIsElementVisibleTool }  from '../interaction/is-element-visible.ts';
import { browserCountElementsTool }     from '../interaction/count-elements.ts';
import { browserCaptureUIStateTool }    from '../interaction/capture-ui-state.ts';

// ── Validation ─────────────────────────────────────────────────────────────────
import { browserValidateUITool }             from '../validation/validate-ui.ts';
import { browserCompareScreenshotsTool }     from '../validation/compare-screenshots.ts';
import { browserCollectPerformanceTool }     from '../validation/collect-performance.ts';
import { browserValidatePerformanceTool }    from '../validation/validate-performance.ts';
import { browserConsoleCatcherTool,
         browserGetConsoleErrorsTool }        from '../validation/console-error-catcher.ts';
import { browserDetectCrashTool }            from '../validation/runtime-crash-detector.ts';
import { browserDetectBlankScreenTool }      from '../validation/blank-screen-detector.ts';
import { browserDetectHydrationErrorsTool }  from '../validation/hydration-error-detector.ts';

// ── Capture ────────────────────────────────────────────────────────────────────
import { browserScreenshotTool }             from '../capture/take-screenshot.ts';
import { browserElementScreenshotTool }      from '../capture/take-element-screenshot.ts';
import { browserAttachCrashListenerTool,
         browserGetCrashesTool }             from '../capture/attach-crash-listener.ts';

// ── Monitoring ─────────────────────────────────────────────────────────────────
import { browserGetActionLogTool }           from '../monitoring/action-logger.ts';
import { browserGetMetricsTool }             from '../monitoring/browser-metrics.ts';

// ── All tools in registration order ───────────────────────────────────────────

const ALL_BROWSER_TOOLS = [
  // Health
  browserHealthTool,
  // Navigation
  browserNavigateTool,
  browserReloadTool,
  browserWaitForLoadTool,
  browserRunFlowTool,
  browserTestViewportTool,
  browserResponsiveTestsTool,
  // Interaction
  browserClickTool,
  browserFillTool,
  browserSelectTool,
  browserWaitForElementTool,
  browserWaitForVisibleTool,
  browserIsElementPresentTool,
  browserIsElementVisibleTool,
  browserCountElementsTool,
  browserCaptureUIStateTool,
  // Validation
  browserValidateUITool,
  browserCompareScreenshotsTool,
  browserCollectPerformanceTool,
  browserValidatePerformanceTool,
  browserConsoleCatcherTool,
  browserGetConsoleErrorsTool,
  browserDetectCrashTool,
  browserDetectBlankScreenTool,
  browserDetectHydrationErrorsTool,
  // Capture
  browserScreenshotTool,
  browserElementScreenshotTool,
  browserAttachCrashListenerTool,
  browserGetCrashesTool,
  // Monitoring
  browserGetActionLogTool,
  browserGetMetricsTool,
] as const;

let _registered = false;

/**
 * Register all browser tools.
 * Idempotent — safe to call multiple times (subsequent calls are no-ops).
 */
export function registerBrowserTools(): void {
  if (_registered) return;
  for (const tool of ALL_BROWSER_TOOLS) {
    registerTool(tool as Parameters<typeof registerTool>[0], { force: false });
  }
  _registered = true;
}

export const BROWSER_TOOL_COUNT = ALL_BROWSER_TOOLS.length;
export const BROWSER_TOOL_NAMES = ALL_BROWSER_TOOLS.map((t) => t.name);

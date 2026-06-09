/**
 * server/tools/browser/register-browser-tools.ts
 *
 * Registers ALL browser tools with the central platform registry.
 * Called once at application boot by tool-loader.ts, before sealRegistry().
 * Idempotent — subsequent calls are no-ops.
 */

import { registerTool } from '../registry/tool-registry.ts';

// Core lifecycle
import { browserLaunchTool, browserCloseTool, browserHealthTool }
  from './browser-core-tools.ts';

// Navigation
import {
  browserNavigateTool,
  browserReloadTool,
  browserWaitForLoadTool,
  browserScreenshotTool,
  browserElementScreenshotTool,
}                       from './browser-navigation-tools.ts';

// Interaction
import {
  browserClickTool,
  browserFillTool,
  browserSelectTool,
  browserWaitForElementTool,
  browserWaitForVisibleTool,
  browserIsElementPresentTool,
  browserIsElementVisibleTool,
  browserCountElementsTool,
}                       from './browser-interaction-tools.ts';

// Utility
import {
  browserCaptureUiStateTool,
  browserValidateUiTool,
  browserRunFlowTool,
  browserTestViewportTool,
  browserResponsiveTestsTool,
  browserCollectPerformanceTool,
  browserValidatePerformanceTool,
  browserConsoleCatcherTool,
  browserGetConsoleErrorsTool,
  browserDetectCrashTool,
  browserDetectBlankScreenTool,
}                       from './browser-utility-tools.ts';

const ALL_BROWSER_TOOLS = [
  // Lifecycle (3)
  browserLaunchTool,
  browserCloseTool,
  browserHealthTool,
  // Navigation (5)
  browserNavigateTool,
  browserReloadTool,
  browserWaitForLoadTool,
  browserScreenshotTool,
  browserElementScreenshotTool,
  // Interaction (8)
  browserClickTool,
  browserFillTool,
  browserSelectTool,
  browserWaitForElementTool,
  browserWaitForVisibleTool,
  browserIsElementPresentTool,
  browserIsElementVisibleTool,
  browserCountElementsTool,
  // Utility (11)
  browserCaptureUiStateTool,
  browserValidateUiTool,
  browserRunFlowTool,
  browserTestViewportTool,
  browserResponsiveTestsTool,
  browserCollectPerformanceTool,
  browserValidatePerformanceTool,
  browserConsoleCatcherTool,
  browserGetConsoleErrorsTool,
  browserDetectCrashTool,
  browserDetectBlankScreenTool,
] as const;

let _registered = false;

export function registerBrowserTools(): void {
  if (_registered) return;
  for (const tool of ALL_BROWSER_TOOLS) {
    registerTool(tool as Parameters<typeof registerTool>[0], { force: false });
  }
  _registered = true;
  console.log(`[register-browser-tools] Registered ${ALL_BROWSER_TOOLS.length} browser tools`);
}

export const BROWSER_TOOL_COUNT = ALL_BROWSER_TOOLS.length;
export const BROWSER_TOOL_NAMES = ALL_BROWSER_TOOLS.map(t => t.name);

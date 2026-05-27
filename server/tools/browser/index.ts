/**
 * server/tools/browser/index.ts
 *
 * Public entry point for the browser tool layer.
 *
 * Migration status: COMPLETE
 * All browser execution logic has been extracted from server/agents/browser/
 * and re-exposed here as registered ToolDefinition objects that flow through
 * the central tool registry → dispatcher pipeline.
 *
 * The original server/agents/browser/ module is PRESERVED as a compatibility
 * layer — it still exports the same public API used by existing agent code.
 */

// ── Registration ──────────────────────────────────────────────────────────────
export {
  registerBrowserTools,
  BROWSER_TOOL_COUNT,
  BROWSER_TOOL_NAMES,
} from './registry/register-browser-tools.ts';

// ── Session management (tool-layer) ───────────────────────────────────────────
export { launchBrowser, closeBrowser }                from './session/browser-lifecycle.ts';
export { getSession, hasSession, activeSessionCount } from './session/browser-context.ts';

// ── Types re-exported for consumers ───────────────────────────────────────────
export type {
  NavigateInput,
  ClickInput,
  FillInput,
  SelectInput,
  WaitForElementInput,
  ScreenshotInput,
  UserFlowInput,
  ResponsiveTestInput,
  RunBrowserAgentInput,
} from './shared/browser-types.ts';

export { BrowserToolError } from './shared/browser-errors.ts';

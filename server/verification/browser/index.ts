/**
 * server/verification/browser/index.ts
 *
 * Public API for the browser verification engine.
 * All external consumers import from here only.
 */

export { runBrowserVerification }           from "./browser-verifier.ts";
export { validateDom, scoreDom }            from "./dom-validator.ts";
export { analyzeVisuals, isAppRendered }    from "./screenshot-analyzer.ts";
export {
  extractConsoleErrorsFromHtml,
  extractConsoleErrorsFromLogs,
  scoreConsoleErrors,
}                                           from "./console-monitor.ts";
export { runInteractions, scoreInteractions, deriveDefaultInteractions } from "./interaction-runner.ts";
export { isPlaywrightAvailable, isPlaywrightFeatureFlagEnabled }         from "./playwright-manager.ts";

export type {
  BrowserVerificationResult,
  VerificationTarget,
  VerificationDepth,
  DomReport,
  NetworkReport,
  ConsoleError,
  InteractionResult,
  AccessibilityReport,
}                                           from "./verification-types.ts";

/**
 * server/browser/index.ts
 * Public API for the browser intelligence system.
 */

export { runBrowserValidation }     from "./browser-validator.ts";
export { createBrowserSession, closeSession } from "./runtime/browser-session-manager.ts";
export { detectBlankScreen }        from "./checks/blank-screen-detector.ts";
export { detectHydrationFailure }   from "./checks/hydration-failure-detector.ts";
export { collectConsoleErrors }     from "./checks/console-error-collector.ts";
export { checkDOMStability }        from "./checks/dom-stability-checker.ts";
export { detectAssetFailures }      from "./checks/asset-failure-detector.ts";
export { analyzeScreenshot }        from "./vision/screenshot-analyzer.ts";
export { detectResponsiveIssues }   from "./vision/responsive-overflow-detector.ts";
export { validateInteractions }     from "./interactions/interaction-validator.ts";
export { validateRoutes }           from "./interactions/route-navigation-validator.ts";
export type {
  BrowserValidationReport, BrowserSession,
  ScreenshotAnalysis, DOMSnapshot,
  ConsoleError, ResponsiveIssue,
  VisualStatus, HydrationStatus, InteractionStatus,
} from "./types.ts";

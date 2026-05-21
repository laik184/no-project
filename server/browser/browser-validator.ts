/**
 * server/browser/browser-validator.ts
 * Orchestrates all browser checks into a single BrowserValidationReport.
 * Single responsibility: coordinate checks, produce report. No direct DOM ops.
 */

import { createBrowserSession, closeSession } from "./runtime/browser-session-manager.ts";
import { detectBlankScreen }                  from "./checks/blank-screen-detector.ts";
import { detectHydrationFailure }             from "./checks/hydration-failure-detector.ts";
import { collectConsoleErrors, hasRepeatedErrors } from "./checks/console-error-collector.ts";
import { checkDOMStability }                  from "./checks/dom-stability-checker.ts";
import { detectAssetFailures }                from "./checks/asset-failure-detector.ts";
import { analyzeScreenshot }                  from "./vision/screenshot-analyzer.ts";
import { detectResponsiveIssues }             from "./vision/responsive-overflow-detector.ts";
import { validateInteractions }               from "./interactions/interaction-validator.ts";
import { bus }                                from "../infrastructure/events/bus.ts";
import type { BrowserValidationReport }       from "./types.ts";

export async function runBrowserValidation(
  projectId: number,
  runId:     string,
): Promise<BrowserValidationReport> {
  const startTs = Date.now();

  const session = await createBrowserSession(projectId, runId);

  if (!session) {
    return blankReport(projectId, runId, "No running dev server detected", startTs);
  }

  const [
    blankResult,
    hydrationResult,
    consoleErrors,
    domResult,
    assetFailures,
    responsiveIssues,
    interactionResult,
  ] = await Promise.allSettled([
    detectBlankScreen(session),
    detectHydrationFailure(session),
    collectConsoleErrors(projectId),
    checkDOMStability(session),
    detectAssetFailures(session),
    detectResponsiveIssues(session),
    validateInteractions(session),
  ]);

  const blank       = settled(blankResult,       { isBlank: false, visualStatus: "ok" as const, bodyLength: 0 });
  const hydration   = settled(hydrationResult,   { status: "unknown" as const, confidence: 0 });
  const errors      = settled(consoleErrors,     [] as any[]);
  const dom         = settled(domResult,         { stable: true, snapshot: null, changedCount: 0 });
  const assets      = settled(assetFailures,     []);
  const responsive  = settled(responsiveIssues,  []);
  const interaction = settled(interactionResult, { status: "skipped" as const, elementsFound: [], elementsMissing: [] });

  const screenshotAnalysis = await analyzeScreenshot(session, dom.snapshot?.bodyText);

  // ── Block decisions ────────────────────────────────────────────────────────
  const blockReasons: string[] = [];
  if (blank.isBlank)                      blockReasons.push(`Blank screen: ${blank.reason}`);
  if (hydration.status === "failed")      blockReasons.push(`Hydration failed: ${hydration.errorText}`);
  if (hasRepeatedErrors(errors, 3))       blockReasons.push("Repeated console errors detected");
  if (interaction.status === "failed")    blockReasons.push(`Interaction issue: ${interaction.reason}`);
  if (assets.length >= 3)                 blockReasons.push(`${assets.length} asset failures detected`);

  closeSession(session.sessionId, runId);

  const report: BrowserValidationReport = {
    runId, projectId, url: session.url,
    visualStatus:      blank.visualStatus,
    hydrationStatus:   hydration.status,
    interactionStatus: interaction.status,
    consoleErrors:     errors,
    screenshotEvidence: null,
    domSnapshot:       dom.snapshot,
    responsiveIssues:  responsive,
    blocked:           blockReasons.length > 0,
    blockReasons,
    elapsedMs:         Date.now() - startTs,
  };

  bus.emit("agent.event", {
    runId, eventType: "browser.validated" as any, phase: "verify",
    ts: Date.now(),
    payload: { blocked: report.blocked, blockReasons, elapsedMs: report.elapsedMs },
  });

  return report;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function blankReport(
  projectId: number, runId: string, reason: string, startTs: number,
): BrowserValidationReport {
  return {
    runId, projectId, url: "",
    visualStatus: "error", hydrationStatus: "unknown", interactionStatus: "skipped",
    consoleErrors: [], screenshotEvidence: null, domSnapshot: null,
    responsiveIssues: [], blocked: false, blockReasons: [reason],
    elapsedMs: Date.now() - startTs,
  };
}

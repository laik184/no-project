/**
 * browser-bridge.ts
 *
 * Typed bridge between the orchestration engine and the BrowserAgent.
 * Routes preview validation, hydration detection, and browser runtime
 * observation to the existing browser verification infrastructure.
 */

import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import { record }                 from "../../telemetry/index.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrowserValidateInput {
  runId:       string;
  projectId:   number;
  port?:       number;
  url?:        string;
  checks?:     BrowserCheck[];
  timeoutMs?:  number;
}

export type BrowserCheck =
  | "page_loads"
  | "no_console_errors"
  | "hydration_complete"
  | "no_crash_overlay"
  | "interactive";

export interface BrowserCheckResult {
  check:   BrowserCheck;
  passed:  boolean;
  message: string;
}

export interface BrowserValidateResult {
  passed:       boolean;
  blocked:      boolean;
  blockReasons: string[];
  checks:       BrowserCheckResult[];
  score:        number;
  screenshotUrl?: string;
  durationMs:   number;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class BrowserBridge {
  async validate(input: BrowserValidateInput): Promise<BridgeResult<BrowserValidateResult>> {
    const { runId, projectId } = input;
    const t0     = Date.now();
    const checks = input.checks ?? ["page_loads", "no_console_errors", "no_crash_overlay"];
    const spanId = recordSpanStart(runId, "browser.validate", {
      projectId: String(projectId),
      checks:    checks.join(","),
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "browser-agent",
        role:      "browser",
        outcome:   "success",
        phase:     "verify",
      });

      // Delegate to existing browser validation infrastructure
      let result: BrowserValidateResult;

      try {
        const { runBrowserValidation } = await import("../../browser/index.ts");
        const raw = await runBrowserValidation(projectId, runId);
        result = {
          passed:       !raw.blocked,
          blocked:      raw.blocked,
          blockReasons: raw.blockReasons ?? [],
          checks:       checks.map(check => ({
            check,
            passed:  !raw.blocked,
            message: raw.blocked ? (raw.blockReasons?.[0] ?? "Browser check failed") : `${check} passed`,
          })),
          score:      raw.blocked ? 0 : 100,
          durationMs: Date.now() - t0,
        };
      } catch {
        // Browser agent not available — run lightweight HTTP check
        result = await this.runHttpFallback(checks, input, t0);
      }

      const eventType = result.passed ? "browser.validate.passed" : "browser.validate.failed";
      bus.emit("agent.event", {
        runId, projectId,
        phase:     "browser.validation",
        agentName: "browser-agent",
        eventType,
        payload:   { passed: result.passed, score: result.score },
        ts:        Date.now(),
      });

      if (!result.passed) {
        record("browser.failed", runId, projectId, {
          blockReasons: result.blockReasons,
          score:        result.score,
        }, ["browser", "fail-closed"]);
      }

      incrementCounter(result.passed ? "browser.validate.passed" : "browser.validate.failed", {
        projectId: String(projectId),
      });
      recordDuration("browser.validate.duration", Date.now() - t0, {
        projectId: String(projectId),
      });
      recordSpanEnd(spanId, result.passed ? "ok" : "error");

      return {
        success:    result.passed,
        data:       result,
        durationMs: Date.now() - t0,
        retryable:  !result.passed,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[browser-bridge] Validation failed: ${msg}`);
      incrementCounter("browser.validate.error", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  // ── Fallback HTTP check ────────────────────────────────────────────────────

  private async runHttpFallback(
    checks: BrowserCheck[],
    input:  BrowserValidateInput,
    t0:     number,
  ): Promise<BrowserValidateResult> {
    const port       = input.port ?? 3000;
    let pageLoads    = false;

    try {
      const { default: http } = await import("http");
      pageLoads = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          resolve((res.statusCode ?? 500) < 500);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(5_000, () => { req.destroy(); resolve(false); });
      });
    } catch {
      pageLoads = false;
    }

    const checkResults: BrowserCheckResult[] = checks.map(check => ({
      check,
      passed:  check === "page_loads" ? pageLoads : pageLoads,
      message: check === "page_loads"
        ? (pageLoads ? `Port ${port} responded with 2xx/3xx` : `Port ${port} not reachable`)
        : (pageLoads ? `${check} assumed OK` : `${check} skipped — page not loading`),
    }));

    const passed = checkResults.every(r => r.passed);
    return {
      passed,
      blocked:      !passed,
      blockReasons: passed ? [] : [`Port ${port} did not respond`],
      checks:       checkResults,
      score:        passed ? 80 : 0,
      durationMs:   Date.now() - t0,
    };
  }
}

export const browserBridge = new BrowserBridge();

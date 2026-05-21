/**
 * server/completion/completion-gate.ts
 * Orchestrates all completion checks — LLM cannot declare success alone.
 * Single responsibility: completion authority. No business/execution logic.
 */

import { runBuildValidationCheck }      from "./checks/build-validation-check.ts";
import { runRuntimeHealthCheck }        from "./checks/runtime-health-check.ts";
import { runBrowserValidationCheck }    from "./checks/browser-validation-check.ts";
import { runSecurityValidationCheck }   from "./checks/security-validation-check.ts";
import { runDependencyValidationCheck } from "./checks/dependency-validation-check.ts";
import { runFinalReconciliation }       from "./runtime/final-reconciliation.ts";
import { bus }                          from "../infrastructure/events/bus.ts";
import type {
  CompletionGateInput,
  CompletionGateOutput,
  CompletionCheckResult,
} from "./types.ts";

export async function runCompletionGate(
  input: CompletionGateInput,
): Promise<CompletionGateOutput> {
  const start = Date.now();

  bus.emit("agent.event", {
    runId: input.runId, eventType: "completion.gate.started" as any,
    phase: "completion", ts: Date.now(), payload: { projectId: input.projectId },
  });

  // Run independent checks in parallel
  const [build, runtime, security, deps] = await Promise.all([
    runBuildValidationCheck(input),
    runRuntimeHealthCheck(input),
    runSecurityValidationCheck(input),
    runDependencyValidationCheck(input),
  ]);

  // Browser check — sequential (needs runtime)
  const browser = runtime.passed
    ? await runBrowserValidationCheck(input)
    : skipCheck("BrowserValidation", "Runtime not healthy — browser check skipped.");

  const checks = [build, runtime, security, deps, browser];

  // Final reconciliation
  const reconcile = await runFinalReconciliation(input, checks);
  checks.push(reconcile);

  const failedChecks = checks.filter(c => !c.passed && c.status !== "skipped");
  const passedChecks = checks.filter(c => c.passed || c.status === "skipped");
  const passed       = failedChecks.length === 0;

  const output: CompletionGateOutput = {
    passed,
    failedChecks,
    passedChecks,
    runtimeStatus:         runtime.details,
    browserStatus:         browser.details,
    securityStatus:        security.details,
    reconciliationSummary: reconcile.details,
    elapsedMs:             Date.now() - start,
  };

  bus.emit("agent.event", {
    runId: input.runId, eventType: (passed ? "completion.gate.passed" : "completion.gate.rejected") as any,
    phase: "completion", ts: Date.now(),
    payload: { passed, failedCount: failedChecks.length, elapsedMs: output.elapsedMs },
  });

  return output;
}

function skipCheck(check: CompletionCheckResult["check"], details: string): CompletionCheckResult {
  return { check, status: "skipped", passed: true, details };
}

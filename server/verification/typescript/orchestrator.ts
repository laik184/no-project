/**
 * server/verification/typescript/orchestrator.ts
 *
 * TypeScriptVerificationOrchestrator — top-level coordinator.
 * Wires all modules together. Owns the session lifecycle.
 * Single entry point: verify(options) → VerificationResult
 *
 * Flow:
 *   IDLE → STARTING → (cache hit → PASSED)
 *        → RUNNING → PARSING → PASSED | FAILED | CORRUPTED
 *        → TIMEOUT | CANCELLED on infrastructure failure
 *   + retry loop for retryable failures
 */

import { randomUUID } from "crypto";
import type {
  VerificationOptions,
  VerificationResult,
  VerificationState,
  TSCExecutionResult,
} from "./types.ts";
import { VerificationStateMachine } from "./state-machine.ts";
import { TSCProcessRunner } from "./tsc-process-runner.ts";
import { TSConfigResolver } from "./tsconfig-resolver.ts";
import { VerificationResultParser } from "./result-parser.ts";
import { FailureClassifier } from "./failure-classifier.ts";
import { RetryPolicyEngine } from "./retry-policy-engine.ts";
import { VerificationAuditLogger } from "./audit-logger.ts";
import { evidenceStore } from "./evidence-store.ts";
import { verificationCache } from "./verification-cache.ts";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const COMPILER_VERSION_CMD = "tsc --version";

export class TypeScriptVerificationOrchestrator {
  private readonly _runner: TSCProcessRunner;
  private readonly _resolver: TSConfigResolver;
  private readonly _parser: VerificationResultParser;
  private readonly _classifier: FailureClassifier;
  private readonly _retryEngine: RetryPolicyEngine;

  constructor() {
    this._runner = new TSCProcessRunner();
    this._resolver = new TSConfigResolver();
    this._parser = new VerificationResultParser();
    this._classifier = new FailureClassifier();
    this._retryEngine = new RetryPolicyEngine();
  }

  async verify(opts: VerificationOptions): Promise<VerificationResult> {
    const sessionId = randomUUID();
    const logger = new VerificationAuditLogger(sessionId);
    const machine = new VerificationStateMachine();
    const startMs = Date.now();

    logger.log("SESSION_STARTED", {
      workspacePath: opts.workspacePath,
      tsconfigPath: opts.tsconfigPath ?? "auto",
    });

    machine.transition("STARTING");

    // ── 1. Resolve tsconfig ────────────────────────────────────────────────
    const configResult = this._resolver.resolve(
      opts.workspacePath,
      opts.tsconfigPath
    );

    if (!configResult) {
      logger.log("SESSION_COMPLETED", { outcome: "FAILED", reason: "no_tsconfig" });
      return this._makeResult(sessionId, opts, machine, null, {
        exitCode: null, stdout: "", stderr: "",
        durationMs: 0, timedOut: false, cancelled: false, spawnError: null,
      }, startMs, 0, "No tsconfig.json found in workspace.");
    }

    // ── 2. Cache lookup ────────────────────────────────────────────────────
    if (!opts.skipCache) {
      const wsChecksum = this._resolver.computeWorkspaceChecksum(opts.workspacePath);
      const cacheKey = verificationCache.buildKey({
        tsconfigHash: configResult.hash,
        workspaceChecksum: wsChecksum,
      });
      const cached = verificationCache.get(cacheKey);
      if (cached) {
        logger.log("CACHE_HIT", { cacheKey });
        machine.forceTerminal("PASSED");
        return cached;
      }
      logger.log("CACHE_MISS", { cacheKey });
    }

    // ── 3. Execution + retry loop ──────────────────────────────────────────
    const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let attempt = 0;
    let lastExecution: TSCExecutionResult | null = null;

    while (true) {
      if (opts.signal?.aborted) {
        machine.forceTerminal("CANCELLED");
        break;
      }

      machine.tryTransition("RUNNING");
      logger.log("TSC_SPAWNED", { attempt, tsconfigPath: configResult.absolutePath });

      const execution = await this._runner.run({
        tsconfigPath: configResult.absolutePath,
        workspacePath: opts.workspacePath,
        timeoutMs,
        signal: opts.signal,
      });

      lastExecution = execution;
      logger.log("TSC_COMPLETED", {
        exitCode: execution.exitCode,
        timedOut: execution.timedOut,
        cancelled: execution.cancelled,
        durationMs: execution.durationMs,
        spawnError: execution.spawnError,
      });

      // Handle cancellation
      if (execution.cancelled) {
        machine.forceTerminal("CANCELLED");
        break;
      }

      // Handle timeout
      if (execution.timedOut) {
        const classification = this._classifier.classify(execution, [], []);
        const decision = this._retryEngine.decide({ attempt, maxRetries, classification });
        logger.log("FAILURE_CLASSIFIED", { class: classification.class, retryable: decision.shouldRetry });
        if (decision.shouldRetry) {
          logger.log("RETRY_SCHEDULED", { attempt, delayMs: decision.delayMs });
          await this._retryEngine.wait(decision.delayMs, opts.signal);
          attempt++;
          machine.tryTransition("STARTING");
          continue;
        }
        machine.forceTerminal("TIMEOUT");
        break;
      }

      // Spawn error path
      if (execution.spawnError) {
        const classification = this._classifier.classify(execution, [], []);
        const decision = this._retryEngine.decide({ attempt, maxRetries, classification });
        logger.log("FAILURE_CLASSIFIED", { class: classification.class, retryable: decision.shouldRetry });
        if (decision.shouldRetry) {
          logger.log("RETRY_SCHEDULED", { attempt, delayMs: decision.delayMs });
          await this._retryEngine.wait(decision.delayMs, opts.signal);
          attempt++;
          machine.tryTransition("STARTING");
          continue;
        }
        machine.forceTerminal("FAILED");
        break;
      }

      // ── 4. Parse output ────────────────────────────────────────────────
      machine.tryTransition("PARSING");
      const { diagnostics, parseErrors } = this._parser.parse(
        execution.stdout,
        execution.stderr
      );
      logger.log("PARSE_COMPLETED", {
        diagnosticCount: diagnostics.length,
        parseErrorCount: parseErrors.length,
      });

      // ── 5. Determine terminal state ───────────────────────────────────
      if (execution.exitCode === 0) {
        machine.transition("PASSED");
        break;
      }

      const classification = this._classifier.classify(execution, diagnostics, parseErrors);
      logger.log("FAILURE_CLASSIFIED", { class: classification.class, retryable: classification.retryable });

      if (classification.class === "PARSE_FAILURE") {
        machine.forceTerminal("CORRUPTED");
        break;
      }

      if (!classification.retryable) {
        machine.forceTerminal("FAILED");
        break;
      }

      const decision = this._retryEngine.decide({ attempt, maxRetries, classification });
      if (!decision.shouldRetry) {
        logger.log("RETRY_ABORTED", { reason: decision.reason });
        machine.forceTerminal("FAILED");
        break;
      }

      logger.log("RETRY_SCHEDULED", { attempt, delayMs: decision.delayMs });
      await this._retryEngine.wait(decision.delayMs, opts.signal);
      attempt++;
      machine.tryTransition("STARTING");
    }

    const result = this._makeResult(
      sessionId,
      opts,
      machine,
      configResult,
      lastExecution ?? {
        exitCode: null, stdout: "", stderr: "",
        durationMs: 0, timedOut: false, cancelled: false, spawnError: null,
      },
      startMs,
      attempt,
      null
    );

    // ── 6. Store evidence + cache ────────────────────────────────────────
    const finalClassification = result.passed
      ? null
      : this._classifier.classify(
          result.execution,
          result.diagnostics,
          []
        );

    evidenceStore.append(result, finalClassification?.class ?? null);

    if (result.passed && !opts.skipCache) {
      const wsChecksum = this._resolver.computeWorkspaceChecksum(opts.workspacePath);
      const cacheKey = verificationCache.buildKey({
        tsconfigHash: configResult.hash,
        workspaceChecksum: wsChecksum,
      });
      verificationCache.set(cacheKey, result);
      logger.log("CACHE_STORED", { cacheKey });
    }

    logger.log("SESSION_COMPLETED", { outcome: result.state, passed: result.passed });
    return result;
  }

  private _makeResult(
    sessionId: string,
    opts: VerificationOptions,
    machine: VerificationStateMachine,
    configResult: { absolutePath: string; hash: string } | null,
    execution: TSCExecutionResult,
    startMs: number,
    retryCount: number,
    overrideFailureReason: string | null
  ): VerificationResult {
    const { diagnostics, parseErrors } = this._parser.parse(
      execution.stdout,
      execution.stderr
    );
    const errors = diagnostics.filter((d) => d.severity === "error");
    const warnings = diagnostics.filter((d) => d.severity === "warning");
    const passed = machine.state === "PASSED";

    const failureReason = overrideFailureReason ??
      (passed ? null : this._buildFailureReason(machine.state as VerificationState, diagnostics));

    return Object.freeze({
      sessionId,
      workspacePath: opts.workspacePath,
      tsconfigPath: configResult?.absolutePath ?? "",
      state: machine.state as VerificationState,
      passed,
      diagnostics: Object.freeze(diagnostics),
      errorCount: errors.length,
      warningCount: warnings.length,
      execution,
      compilerVersion: "tsc",
      tsconfigHash: configResult?.hash ?? "",
      timestamp: Date.now(),
      durationMs: Date.now() - startMs,
      retryCount,
      failureReason,
    });
  }

  private _buildFailureReason(
    state: VerificationState,
    diagnostics: readonly { severity: string; code: number; message: string; filePath: string; line: number }[]
  ): string {
    if (state === "TIMEOUT") return "tsc exceeded the timeout budget.";
    if (state === "CANCELLED") return "Verification was cancelled.";
    if (state === "CORRUPTED") return "tsc output could not be parsed.";
    const errors = diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      return `${errors.length} TypeScript error(s). First: TS${errors[0].code} in ${errors[0].filePath}:${errors[0].line} — ${errors[0].message}`;
    }
    return "tsc exited non-zero with no parseable diagnostics.";
  }
}

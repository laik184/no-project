/**
 * server/verification/typescript/orchestrator.ts
 *
 * TypeScriptVerificationOrchestrator — top-level coordinator.
 * Wires all modules together. Owns the session lifecycle.
 * Single entry point: verify(options) → VerificationResult
 *
 * Result assembly is delegated to VerificationResultBuilder.
 *
 * Flow:
 *   IDLE → STARTING → (cache hit → PASSED)
 *        → RUNNING → PARSING → PASSED | FAILED | CORRUPTED
 *        → TIMEOUT | CANCELLED on infrastructure failure
 *   + retry loop for retryable failures
 */

import { randomUUID } from "crypto";
import type { VerificationOptions, VerificationResult, TSCExecutionResult } from "./types.ts";
import { VerificationStateMachine } from "./state-machine.ts";
import { TSCProcessRunner }         from "./tsc-process-runner.ts";
import { TSConfigResolver }         from "./tsconfig-resolver.ts";
import { VerificationResultParser } from "./result-parser.ts";
import { FailureClassifier }        from "./failure-classifier.ts";
import { RetryPolicyEngine }        from "./retry-policy-engine.ts";
import { VerificationAuditLogger }  from "./audit-logger.ts";
import { VerificationResultBuilder } from "./result-builder.ts";
import { evidenceStore }            from "./evidence-store.ts";
import { verificationCache }        from "./verification-cache.ts";

const DEFAULT_TIMEOUT_MS  = 60_000;
const DEFAULT_MAX_RETRIES = 2;

const NULL_EXECUTION: TSCExecutionResult = {
  exitCode: null, stdout: "", stderr: "",
  durationMs: 0, timedOut: false, cancelled: false, spawnError: null,
};

export class TypeScriptVerificationOrchestrator {
  private readonly _runner:  TSCProcessRunner;
  private readonly _resolver: TSConfigResolver;
  private readonly _parser:  VerificationResultParser;
  private readonly _classifier: FailureClassifier;
  private readonly _retryEngine: RetryPolicyEngine;
  private readonly _builder: VerificationResultBuilder;

  constructor() {
    this._runner      = new TSCProcessRunner();
    this._resolver    = new TSConfigResolver();
    this._parser      = new VerificationResultParser();
    this._classifier  = new FailureClassifier();
    this._retryEngine = new RetryPolicyEngine();
    this._builder     = new VerificationResultBuilder(this._parser);
  }

  async verify(opts: VerificationOptions): Promise<VerificationResult> {
    const sessionId = randomUUID();
    const logger    = new VerificationAuditLogger(sessionId);
    const machine   = new VerificationStateMachine();
    const startMs   = Date.now();

    logger.log("SESSION_STARTED", { workspacePath: opts.workspacePath });
    machine.transition("STARTING");

    // ── 1. Resolve tsconfig ────────────────────────────────────────────────
    const configResult = this._resolver.resolve(opts.workspacePath, opts.tsconfigPath);
    if (!configResult) {
      logger.log("SESSION_COMPLETED", { outcome: "FAILED", reason: "no_tsconfig" });
      return this._builder.build(sessionId, opts, machine, null, NULL_EXECUTION, startMs, 0,
        "No tsconfig.json found in workspace.");
    }

    // ── 2. Cache lookup ────────────────────────────────────────────────────
    if (!opts.skipCache) {
      const wsChecksum = this._resolver.computeWorkspaceChecksum(opts.workspacePath);
      const cacheKey   = verificationCache.buildKey({ tsconfigHash: configResult.hash, workspaceChecksum: wsChecksum });
      const cached     = verificationCache.get(cacheKey);
      if (cached) {
        logger.log("CACHE_HIT", { cacheKey });
        machine.forceTerminal("PASSED");
        return cached;
      }
      logger.log("CACHE_MISS", { cacheKey });
    }

    // ── 3. Execution + retry loop ──────────────────────────────────────────
    const maxRetries  = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    const timeoutMs   = opts.timeoutMs  ?? DEFAULT_TIMEOUT_MS;
    let attempt       = 0;
    let lastExecution: TSCExecutionResult = NULL_EXECUTION;

    while (true) {
      if (opts.signal?.aborted) { machine.forceTerminal("CANCELLED"); break; }

      machine.tryTransition("RUNNING");
      logger.log("TSC_SPAWNED", { attempt });

      const execution = await this._runner.run({
        tsconfigPath: configResult.absolutePath,
        workspacePath: opts.workspacePath,
        timeoutMs, signal: opts.signal,
      });
      lastExecution = execution;
      logger.log("TSC_COMPLETED", {
        exitCode: execution.exitCode, timedOut: execution.timedOut,
        cancelled: execution.cancelled, durationMs: execution.durationMs,
      });

      if (execution.cancelled) { machine.forceTerminal("CANCELLED"); break; }

      if (execution.timedOut || execution.spawnError) {
        const cls = this._classifier.classify(execution, [], []);
        const dec = this._retryEngine.decide({ attempt, maxRetries, classification: cls });
        logger.log("FAILURE_CLASSIFIED", { class: cls.class, retryable: dec.shouldRetry });
        if (dec.shouldRetry) {
          logger.log("RETRY_SCHEDULED", { attempt, delayMs: dec.delayMs });
          await this._retryEngine.wait(dec.delayMs, opts.signal);
          attempt++; machine.tryTransition("STARTING"); continue;
        }
        machine.forceTerminal(execution.timedOut ? "TIMEOUT" : "FAILED"); break;
      }

      // ── 4. Parse + classify ────────────────────────────────────────────
      machine.tryTransition("PARSING");
      const { diagnostics, parseErrors } = this._parser.parse(execution.stdout, execution.stderr);
      logger.log("PARSE_COMPLETED", { diagnosticCount: diagnostics.length });

      if (execution.exitCode === 0) { machine.transition("PASSED"); break; }

      const cls = this._classifier.classify(execution, diagnostics, parseErrors);
      logger.log("FAILURE_CLASSIFIED", { class: cls.class });

      if (cls.class === "PARSE_FAILURE") { machine.forceTerminal("CORRUPTED"); break; }
      if (!cls.retryable) { machine.forceTerminal("FAILED"); break; }

      const dec = this._retryEngine.decide({ attempt, maxRetries, classification: cls });
      if (!dec.shouldRetry) { logger.log("RETRY_ABORTED", { reason: dec.reason }); machine.forceTerminal("FAILED"); break; }

      logger.log("RETRY_SCHEDULED", { attempt, delayMs: dec.delayMs });
      await this._retryEngine.wait(dec.delayMs, opts.signal);
      attempt++; machine.tryTransition("STARTING");
    }

    const result = this._builder.build(sessionId, opts, machine, configResult, lastExecution, startMs, attempt, null);

    // ── 5. Evidence + cache ────────────────────────────────────────────────
    const finalCls = result.passed ? null : this._classifier.classify(result.execution, result.diagnostics, []);
    evidenceStore.append(result, finalCls?.class ?? null);

    if (result.passed && !opts.skipCache) {
      const wsChecksum = this._resolver.computeWorkspaceChecksum(opts.workspacePath);
      const cacheKey   = verificationCache.buildKey({ tsconfigHash: configResult.hash, workspaceChecksum: wsChecksum });
      verificationCache.set(cacheKey, result);
      logger.log("CACHE_STORED", { cacheKey });
    }

    logger.log("SESSION_COMPLETED", { outcome: result.state, passed: result.passed });
    return result;
  }
}

/**
 * server/verification/typescript/result-builder.ts
 *
 * VerificationResultBuilder — assembles an immutable VerificationResult
 * from raw execution output, parsed diagnostics, and machine state.
 * No I/O. No state. Pure transformation.
 */

import type {
  VerificationResult,
  VerificationOptions,
  VerificationState,
  TSCExecutionResult,
} from "./types.ts";
import type { VerificationStateMachine } from "./state-machine.ts";
import type { VerificationResultParser } from "./result-parser.ts";

export class VerificationResultBuilder {
  private readonly _parser: VerificationResultParser;

  constructor(parser: VerificationResultParser) {
    this._parser = parser;
  }

  build(
    sessionId: string,
    opts: VerificationOptions,
    machine: VerificationStateMachine,
    configResult: { absolutePath: string; hash: string } | null,
    execution: TSCExecutionResult,
    startMs: number,
    retryCount: number,
    overrideFailureReason: string | null
  ): VerificationResult {
    const { diagnostics } = this._parser.parse(execution.stdout, execution.stderr);
    const errors   = diagnostics.filter((d) => d.severity === "error");
    const warnings = diagnostics.filter((d) => d.severity === "warning");
    const passed   = machine.state === "PASSED";

    const failureReason =
      overrideFailureReason ??
      (passed ? null : this._buildReason(machine.state as VerificationState, diagnostics));

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

  private _buildReason(
    state: VerificationState,
    diagnostics: readonly { severity: string; code: number; message: string; filePath: string; line: number }[]
  ): string {
    if (state === "TIMEOUT")   return "tsc exceeded the timeout budget.";
    if (state === "CANCELLED") return "Verification was cancelled.";
    if (state === "CORRUPTED") return "tsc output could not be parsed.";
    const errors = diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      return `${errors.length} TypeScript error(s). First: TS${errors[0].code} in ${errors[0].filePath}:${errors[0].line} — ${errors[0].message}`;
    }
    return "tsc exited non-zero with no parseable diagnostics.";
  }
}

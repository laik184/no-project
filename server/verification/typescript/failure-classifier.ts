/**
 * server/verification/typescript/failure-classifier.ts
 *
 * FailureClassifier — maps a raw execution + parse result to a FailureClass.
 * Determines retryability. Stateless. No side effects.
 */

import type {
  TSCExecutionResult,
  TSDiagnostic,
  FailureClass,
  FailureClassification,
} from "./types.ts";

// ─── ENOMEM / spawn signals ───────────────────────────────────────────────────

const MEMORY_PATTERNS = [/ENOMEM/i, /out of memory/i, /allocation failed/i];
const SPAWN_PATTERNS = [/ENOENT/i, /spawn.*ENOENT/i, /not found/i, /no such file/i];
const FS_PATTERNS = [/EBUSY/i, /EMFILE/i, /EACCES/i, /EPERM/i, /ENOTEMPTY/i];

// ─── TS error codes that are NEVER retryable ──────────────────────────────────
// (representative set — compiler errors mean the code is wrong)

const COMPILER_CODES = new Set([
  1002, 1003, 1005, 1006, 1007, 1009, 1010, 1011, 1012, 1013, 1014, 1015,
  1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027,
  1028, 1029, 1030, 1031, 1032, 1033, 1034, 1035, 1036, 1037, 1038, 1039,
  1040, 1041, 1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050,
  2304, 2322, 2339, 2345, 2349, 2351, 2355, 2362, 2365, 2367, 2395, 2503,
  2532, 2540, 2551, 2554, 2571, 2582, 2683, 2694, 2741, 2745, 2769, 2786,
  4023, 4025, 4027, 4060, 4082, 4114,
  7005, 7006, 7010, 7015, 7016, 7017, 7018, 7019, 7022, 7023, 7024, 7025,
  7030, 7031, 7032, 7033, 7034,
]);

export class FailureClassifier {
  classify(
    execution: TSCExecutionResult,
    diagnostics: readonly TSDiagnostic[],
    parseErrors: readonly string[]
  ): FailureClassification {
    if (execution.cancelled) {
      return { class: "CANCELLATION", retryable: false, reason: "Verification was cancelled." };
    }

    if (execution.timedOut) {
      return { class: "TIMEOUT", retryable: true, reason: "tsc process exceeded timeout budget." };
    }

    if (execution.spawnError) {
      return this._classifySpawnError(execution.spawnError);
    }

    if (parseErrors.length > 0 && diagnostics.length === 0 && execution.exitCode !== 0) {
      return {
        class: "PARSE_FAILURE",
        retryable: false,
        reason: `Output could not be parsed. First unrecognised line: ${parseErrors[0]}`,
      };
    }

    const errors = diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      const hasCompilerCode = errors.some((d) => COMPILER_CODES.has(d.code));
      return {
        class: "COMPILER_ERROR",
        retryable: false,
        reason: `${errors.length} TypeScript error(s). First: TS${errors[0].code} — ${errors[0].message}`,
      };
    }

    return {
      class: "UNKNOWN",
      retryable: false,
      reason: `tsc exited with code ${execution.exitCode} but no diagnostics were produced.`,
    };
  }

  private _classifySpawnError(msg: string): FailureClassification {
    if (MEMORY_PATTERNS.some((p) => p.test(msg))) {
      return { class: "MEMORY_ERROR", retryable: true, reason: `OOM during spawn: ${msg}` };
    }
    if (SPAWN_PATTERNS.some((p) => p.test(msg))) {
      return { class: "SPAWN_FAILURE", retryable: true, reason: `tsc binary not found: ${msg}` };
    }
    if (FS_PATTERNS.some((p) => p.test(msg))) {
      return { class: "FILESYSTEM_ERROR", retryable: true, reason: `Filesystem error: ${msg}` };
    }
    return { class: "SPAWN_FAILURE", retryable: true, reason: `Spawn failed: ${msg}` };
  }
}

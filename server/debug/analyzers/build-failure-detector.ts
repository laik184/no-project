/**
 * build-failure-detector.ts
 *
 * Detect build failures from shell command output.
 *
 * The observation-controller watches running processes.  This module fills
 * the gap: it watches for build-phase failures that happen BEFORE a server
 * even starts (e.g. `npm run build` exits non-zero, `tsc --noEmit` fails).
 *
 * Consumers: shell-tools.ts wraps spawnWithStream — it can call
 * detectBuildFailure on the final output to decide whether to emit a
 * process.crashed event that triggers autonomous recovery.
 *
 * Pure function — no I/O, no bus, no state.
 * Ownership: autonomous-debug/analyzers — single responsibility: build error detection.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuildFailureKind =
  | "typescript_error"
  | "missing_dependency"
  | "syntax_error"
  | "test_failure"
  | "generic_build_error"
  | "none";

export interface BuildFailureResult {
  readonly failed: boolean;
  readonly kind: BuildFailureKind;
  readonly errorLines: string[];
  readonly exitCode: number | null;
  readonly summary: string;
}

// ─── Patterns ─────────────────────────────────────────────────────────────────

interface BuildPattern {
  kind: BuildFailureKind;
  patterns: RegExp[];
}

const BUILD_PATTERNS: BuildPattern[] = [
  {
    kind: "typescript_error",
    patterns: [/error TS\d+/i, /Found \d+ error/i, /type.*error/i, /compilation failed/i],
  },
  {
    kind: "missing_dependency",
    patterns: [/cannot find module/i, /module not found/i, /failed to resolve/i, /package.*not found/i],
  },
  {
    kind: "syntax_error",
    patterns: [/SyntaxError/i, /unexpected token/i, /parse error/i, /unexpected end/i],
  },
  {
    kind: "test_failure",
    patterns: [/\d+ (test|spec|suite).*fail/i, /FAIL\s+/i, /tests? failed/i, /assertion.*failed/i],
  },
  {
    kind: "generic_build_error",
    patterns: [/\berror\b.*exit/i, /build failed/i, /npm ERR!/i, /ENOENT/i, /EACCES/i],
  },
];

// ─── Exit-code signals ────────────────────────────────────────────────────────

const SUCCESS_EXIT_CODES = new Set([0]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse the output lines and exit code of a build/shell command.
 * Returns a structured failure result.
 */
export function detectBuildFailure(
  lines: string[],
  exitCode: number | null,
): BuildFailureResult {
  const failed = exitCode !== null && !SUCCESS_EXIT_CODES.has(exitCode);
  if (!failed) {
    return { failed: false, kind: "none", errorLines: [], exitCode, summary: "Build succeeded." };
  }

  const errorLines: string[] = [];
  let   kind: BuildFailureKind = "generic_build_error";
  let   matched = false;

  for (const line of lines) {
    for (const bp of BUILD_PATTERNS) {
      if (bp.patterns.some(p => p.test(line))) {
        errorLines.push(line.slice(0, 300));
        if (!matched) {
          kind    = bp.kind;
          matched = true;
        }
        break;
      }
    }
  }

  const topError = errorLines[0]?.slice(0, 200) ?? "(no error lines captured)";
  const summary  = `Build failed (exit ${exitCode}) [${kind}]: ${topError}`;

  return { failed, kind, errorLines: errorLines.slice(0, 10), exitCode, summary };
}

/**
 * Build commands that should trigger autonomous recovery on failure.
 * Used by shell-tools to decide whether to emit a crash event.
 */
export function isBuildCommand(command: string, args: string[]): boolean {
  const cmd = command.toLowerCase();
  const argStr = args.join(" ").toLowerCase();

  if (cmd === "npm" && (argStr.includes("run build") || argStr.includes("run start") || argStr.includes("run dev"))) return true;
  if (cmd === "npx" && argStr.includes("tsc")) return true;
  if (cmd === "tsc") return true;
  if (cmd === "vite" && argStr.includes("build")) return true;
  return false;
}

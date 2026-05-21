/**
 * server/security/runtime-command-policy/index.ts
 *
 * Public entry point for the runtime command policy module.
 *
 * Composes parsing + existing command/arg validation + telemetry into a
 * single function that process-registry.ts calls before every spawn().
 *
 * Reuses server/security/command-validator.ts for arg-level validation
 * (metacharacter checks, forbidden flags, npm subcommand allowlist) so
 * there is no duplication of validation logic.
 */

import { parseRuntimeCommand }       from "./command-parser.ts";
import { validateArgs }               from "../command-validator.ts";
import {
  emitCommandAccepted,
  emitCommandRejected,
  emitSecurityBlocked,
  emitSpawnStarted,
  emitSpawnFailed,
} from "./telemetry-hooks.ts";
import type { RuntimeCommandResult }  from "./command-types.ts";

export type { RuntimeCommandResult, ParsedCommand } from "./command-types.ts";
export { emitSpawnStarted, emitSpawnFailed }        from "./telemetry-hooks.ts";

// ── Main validation entry point ───────────────────────────────────────────────

/**
 * Parse and fully validate a raw runtime command string.
 *
 * Steps:
 *   1. Inject-safe parse → {cmd, args}
 *   2. Per-arg metacharacter + forbidden-flag check (command-validator.ts)
 *   3. Emit telemetry on every outcome
 *
 * Returns ok=false (fail-closed) on ANY validation failure.
 * Never falls back to shell execution.
 */
export function parseAndValidateRuntimeCommand(
  raw:       string,
  projectId: number,
): RuntimeCommandResult {
  // ── Step 1: Parse ───────────────────────────────────────────────────────────
  const parseResult = parseRuntimeCommand(raw);

  if (!parseResult.ok || !parseResult.parsed) {
    const reason = parseResult.reason ?? "command parse failed";
    emitCommandRejected(raw, reason, projectId);
    emitSecurityBlocked(raw, reason, projectId);
    return { ok: false, reason };
  }

  const { cmd, args } = parseResult.parsed;

  // ── Step 2: Per-arg validation (reuse existing validator) ───────────────────
  const argsResult = validateArgs(cmd, args);

  if (!argsResult.valid) {
    const reason = argsResult.reason ?? "argument validation failed";
    emitCommandRejected(raw, reason, projectId);
    emitSecurityBlocked(raw, reason, projectId);
    return { ok: false, reason };
  }

  // ── Step 3: Accepted ────────────────────────────────────────────────────────
  emitCommandAccepted(cmd, args, raw, projectId);
  return { ok: true, parsed: parseResult.parsed };
}

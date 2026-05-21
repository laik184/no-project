/**
 * server/security/runtime-command-policy/command-parser.ts
 *
 * Converts a raw command string into a validated {cmd, args} pair safe for
 * shell-free spawn.
 *
 * Rejects:
 *   - Shell metacharacters (&&, ||, ;, |, >, <, backticks, subshells, etc.)
 *   - Empty or oversized input
 *   - Commands not in the runtime allowlist
 *   - Args that exceed length limits or contain metacharacters
 *
 * Single responsibility: parse + allowlist-check only. No bus access.
 */

import {
  RUNTIME_ALLOWED_COMMANDS,
  INJECTION_RE,
  MAX_COMMAND_LENGTH,
  MAX_ARG_LENGTH,
} from "./command-whitelist.ts";
import type { CommandParseResult } from "./command-types.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a raw command string into a {cmd, args} pair.
 * Returns ok=false with a reason if the command is unsafe or not allowed.
 */
export function parseRuntimeCommand(raw: string): CommandParseResult {
  if (!raw || !raw.trim()) {
    return { ok: false, reason: "Command is empty" };
  }

  if (raw.length > MAX_COMMAND_LENGTH) {
    return {
      ok:     false,
      reason: `Command too long (${raw.length} chars, max ${MAX_COMMAND_LENGTH})`,
    };
  }

  // Reject any shell metacharacter in the full command string
  if (INJECTION_RE.test(raw)) {
    return {
      ok:     false,
      reason: `Command contains shell injection characters: "${raw.slice(0, 80)}"`,
    };
  }

  const parts = raw.trim().split(/\s+/);
  const [cmd, ...args] = parts;

  if (!cmd) {
    return { ok: false, reason: "Could not extract command token from input" };
  }

  // Allowlist check
  if (!RUNTIME_ALLOWED_COMMANDS.has(cmd)) {
    return {
      ok:     false,
      reason: `Command "${cmd}" is not in the runtime allowlist. ` +
              `Allowed: ${[...RUNTIME_ALLOWED_COMMANDS].join(", ")}`,
    };
  }

  // Validate each argument independently
  for (const arg of args) {
    if (arg.length > MAX_ARG_LENGTH) {
      return {
        ok:     false,
        reason: `Argument too long: "${arg.slice(0, 40)}…" (max ${MAX_ARG_LENGTH} chars)`,
      };
    }
    if (INJECTION_RE.test(arg)) {
      return {
        ok:     false,
        reason: `Argument "${arg.slice(0, 60)}" contains shell metacharacters`,
      };
    }
  }

  return { ok: true, parsed: { cmd, args, raw } };
}

/**
 * server/policies/filesystem/safe-filesystem-policy.ts
 * Blocks file operations outside the project sandbox.
 * Single responsibility: sandbox boundary enforcement. No side effects.
 */

import path from "path";
import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { PolicyContext, PolicyResult } from "../types.ts";

const ALWAYS_BLOCKED_PATHS = [
  "/etc", "/usr", "/bin", "/sbin", "/root",
  "/var/log", "/proc", "/sys", "/boot",
];

export function applySafeFilesystemPolicy(ctx: PolicyContext): PolicyResult {
  const filePath = ctx.filePath;

  if (!filePath) {
    return { policy: "SafeFilesystemPolicy", decision: "allow", severity: "low", reason: "No file path in context." };
  }

  const resolved = path.resolve(filePath);

  // Block system paths
  for (const blocked of ALWAYS_BLOCKED_PATHS) {
    if (resolved.startsWith(blocked)) {
      return {
        policy:   "SafeFilesystemPolicy",
        decision: "block",
        severity: "critical",
        reason:   `File path "${resolved}" is outside the allowed filesystem — system path blocked.`,
        remediation: "Only write files within the project sandbox directory.",
      };
    }
  }

  // Warn if outside project sandbox but don't block (could be workspace root)
  const projectDir = getProjectDir(ctx.projectId);
  if (!resolved.startsWith(path.resolve(projectDir)) && !resolved.startsWith(process.cwd())) {
    return {
      policy:   "SafeFilesystemPolicy",
      decision: "escalate",
      severity: "medium",
      reason:   `File path "${resolved}" is outside the project sandbox.`,
      remediation: "Verify the file path is within the project directory.",
    };
  }

  return {
    policy:   "SafeFilesystemPolicy",
    decision: "allow",
    severity: "low",
    reason:   "File path is within sandbox boundaries.",
  };
}

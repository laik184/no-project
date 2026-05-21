/**
 * server/policies/filesystem/filesystem-policy.ts
 * Blocks writes outside sandbox and protects sensitive config files.
 * Single responsibility: filesystem scope enforcement. No side effects.
 */

import path from "path";
import type { PolicyContext, PolicyResult } from "../types.ts";

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? ".sandbox";

const PROTECTED_FILES = [
  ".env", ".env.local", ".env.production", ".env.development",
  "drizzle.config.ts", "drizzle.config.js",
  ".replit", "replit.nix",
  "package-lock.json",
];

const PROTECTED_PATTERNS = [
  /^\.git\//,
  /\/\.env(\.|$)/,
  /\/secrets?\//i,
  /node_modules\//,
];

function isOutsideSandbox(filePath: string): boolean {
  const resolved  = path.resolve(filePath);
  const sandboxAbs = path.resolve(SANDBOX_ROOT);
  return !resolved.startsWith(sandboxAbs + path.sep) && resolved !== sandboxAbs;
}

function isProtectedFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  if (PROTECTED_FILES.includes(basename)) return true;
  return PROTECTED_PATTERNS.some(p => p.test(filePath));
}

export function applyFilesystemPolicy(ctx: PolicyContext): PolicyResult {
  const filePath = ctx.filePath ?? (ctx.metadata?.filePath as string) ?? "";

  if (!filePath) {
    return {
      policy: "SafeFilesystemPolicy",
      decision: "allow",
      severity: "low",
      reason: "No file path in context.",
    };
  }

  if (isOutsideSandbox(filePath)) {
    return {
      policy: "SafeFilesystemPolicy",
      decision: "block",
      severity: "critical",
      reason: `Write blocked — path "${filePath}" is outside sandbox root "${SANDBOX_ROOT}".`,
      remediation: "All file writes must stay within the project sandbox directory.",
    };
  }

  if (isProtectedFile(filePath)) {
    return {
      policy: "SafeFilesystemPolicy",
      decision: "block",
      severity: "high",
      reason: `Write blocked — "${path.basename(filePath)}" is a protected configuration file.`,
      remediation: "Do not overwrite environment or configuration files autonomously.",
    };
  }

  return {
    policy: "SafeFilesystemPolicy",
    decision: "allow",
    severity: "low",
    reason: "File path is within sandbox and not protected.",
  };
}

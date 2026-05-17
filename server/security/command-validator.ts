/**
 * server/security/command-validator.ts
 *
 * Centralised, strict validation for shell commands and their arguments.
 * Single source of truth — imported by all spawn wrappers and tool handlers.
 *
 * Design principles:
 *  - Allowlist-only for commands (deny everything not explicitly permitted)
 *  - Per-argument metacharacter rejection (not just the whole JSON blob)
 *  - Per-command argument policies (deny -e/-c for node/python, etc.)
 *  - Package name format validation (npm/pip install)
 *  - Sandbox cwd escape prevention
 */

import path from "path";

// ── Strict command allowlist ───────────────────────────────────────────────────
// curl, wget, env, printenv, python, node removed — too dangerous.
// npx kept but restricted via argument policy below.

export const SAFE_COMMANDS = new Set<string>([
  "npm", "npx",
  "git",
  "ls", "cat", "head", "tail", "echo", "pwd",
  "mkdir", "touch", "grep", "find", "cp", "mv", "rm",
  "chmod", "df", "du", "ps",
  "tsx", "ts-node", "tsc",
  "vite", "next",
  "eslint",
  "drizzle-kit", "prisma",
  "pip", "pip3",
  "which",
]);

// ── Shell metacharacters that must never appear in any argument ────────────────
// Covers all injection vectors: pipes, redirects, subshells, chaining, quoting.

const ARG_METACHAR_RE = /[|;&`$<>!\\()\n\r"'{}[\]]/;

// ── Per-command forbidden flag prefixes ───────────────────────────────────────
// These flags allow arbitrary code execution even with shell:false.

const FORBIDDEN_ARG_PREFIXES: Record<string, string[]> = {
  node:      ["-e", "--eval", "-p", "--print", "-i", "--interactive", "--input-type"],
  tsx:       ["-e", "--eval"],
  "ts-node": ["-e", "--eval", "-p", "--print"],
  npx:       ["--yes", "-y"],           // disallow auto-install of arbitrary packages
  python:    ["-c", "--command"],
  python3:   ["-c", "--command"],
  pip:       ["--index-url", "--extra-index-url", "--find-links", "--trusted-host"],
  pip3:      ["--index-url", "--extra-index-url", "--find-links", "--trusted-host"],
  npm:       ["--prefix"],              // prevents escaping sandbox cwd
  git:       ["--exec-path", "--upload-pack", "--receive-pack"],
};

// ── Npm subcommand allowlist ──────────────────────────────────────────────────

const ALLOWED_NPM_SUBCOMMANDS = new Set([
  "install", "uninstall", "run", "start", "test", "build",
  "audit", "ci", "list", "ls", "view", "info",
  "update", "outdated", "version", "init",
]);

// ── Npx package allowlist ─────────────────────────────────────────────────────
// Only allow well-known, safe package runners.

const ALLOWED_NPX_PACKAGES = new Set([
  "tsc", "eslint", "prettier", "drizzle-kit", "prisma",
  "vite", "create-vite", "create-react-app",
]);

// ── Validation result ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:   boolean;
  reason?: string;
}

// ── Command validation ────────────────────────────────────────────────────────

export function validateCommand(command: string): ValidationResult {
  const cmd = command.trim();
  if (!cmd) return { valid: false, reason: "Command is empty" };
  if (ARG_METACHAR_RE.test(cmd)) {
    return { valid: false, reason: `Command "${cmd}" contains disallowed characters` };
  }
  if (!SAFE_COMMANDS.has(cmd)) {
    return {
      valid:  false,
      reason: `Command "${cmd}" is not permitted. Allowed: ${[...SAFE_COMMANDS].join(", ")}`,
    };
  }
  return { valid: true };
}

// ── Per-argument validation ───────────────────────────────────────────────────

export function validateArg(command: string, arg: string): ValidationResult {
  if (typeof arg !== "string") {
    return { valid: false, reason: `Argument must be a string, got ${typeof arg}` };
  }
  if (arg.length > 512) {
    return { valid: false, reason: `Argument too long (${arg.length} chars, max 512)` };
  }
  if (ARG_METACHAR_RE.test(arg)) {
    return {
      valid:  false,
      reason: `Argument "${arg.slice(0, 60)}" contains disallowed shell metacharacter`,
    };
  }

  const forbidden = FORBIDDEN_ARG_PREFIXES[command] ?? [];
  for (const prefix of forbidden) {
    if (arg === prefix || arg.startsWith(prefix + "=") || arg.startsWith(prefix + " ")) {
      return { valid: false, reason: `Flag "${arg}" is not allowed for command "${command}"` };
    }
  }

  return { valid: true };
}

// ── Full args array validation ────────────────────────────────────────────────

export function validateArgs(command: string, args: unknown[]): ValidationResult {
  if (!Array.isArray(args)) return { valid: false, reason: "args must be an array" };

  for (const arg of args) {
    const result = validateArg(command, String(arg));
    if (!result.valid) return result;
  }

  // npm subcommand check
  if (command === "npm" && args.length > 0) {
    const sub = String(args[0]);
    if (!ALLOWED_NPM_SUBCOMMANDS.has(sub)) {
      return { valid: false, reason: `npm subcommand "${sub}" is not permitted` };
    }
  }

  // npx package allowlist
  if (command === "npx" && args.length > 0) {
    const pkg = String(args[0]).split("@")[0];
    if (!ALLOWED_NPX_PACKAGES.has(pkg)) {
      return { valid: false, reason: `npx package "${pkg}" is not in the allowlist` };
    }
  }

  return { valid: true };
}

// ── Sandbox cwd validation ────────────────────────────────────────────────────
// Ensures the working directory stays strictly inside the project sandbox root.

export function validateSandboxCwd(cwd: string, projectRoot: string): ValidationResult {
  const resolved = path.resolve(cwd);
  const root     = path.resolve(projectRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return { valid: false, reason: `cwd "${resolved}" escapes project sandbox "${root}"` };
  }
  return { valid: true };
}

// ── Package name validation (npm install / pip install) ───────────────────────
// Follows the npm package name specification + blocks URL/path/git installs.

const NPM_PKG_RE = /^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9._-]{1,214}(@[\w.^~>=<-]+)?$/;

const DANGEROUS_PKG_PREFIXES = [
  "http://", "https://", "git+", "git://", "file:", "../", "./", "/",
];

export function validatePackageName(pkg: string): ValidationResult {
  if (!pkg || typeof pkg !== "string") {
    return { valid: false, reason: "Package name must be a non-empty string" };
  }
  for (const prefix of DANGEROUS_PKG_PREFIXES) {
    if (pkg.startsWith(prefix)) {
      return {
        valid:  false,
        reason: `Package "${pkg}" uses a disallowed install source (${prefix})`,
      };
    }
  }
  if (!NPM_PKG_RE.test(pkg)) {
    return { valid: false, reason: `Package name "${pkg}" is not a valid npm package name` };
  }
  return { valid: true };
}

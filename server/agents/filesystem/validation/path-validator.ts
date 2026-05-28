/**
 * server/agents/filesystem/validation/path-validator.ts
 *
 * Validates path safety at the agent orchestration layer.
 * Detects traversal, blocked paths, and invalid sandbox access.
 * No actual filesystem I/O — string-only analysis.
 */

import { normalizeSeparators } from '../utils/filesystem-utils.ts';

// ── Error type ────────────────────────────────────────────────────────────────

export class PathValidationError extends Error {
  constructor(message: string) {
    super(`[path-validator] ${message}`);
    this.name = 'PathValidationError';
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/,          // ../
  /[/\\]\.\./,          // /..
  /^\.\.$/, /^\.\.$/,   // bare ..
];

const BLOCKED_SEGMENTS = new Set([
  '.git', 'node_modules', '.env', '.env.local', '.env.production',
  '.ssh', '.gnupg', 'passwd', 'shadow',
]);

// ── Validation result ─────────────────────────────────────────────────────────

export interface PathValidationResult {
  ok:      boolean;
  path:    string;
  reason?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function hasTraversal(p: string): boolean {
  return TRAVERSAL_PATTERNS.some((re) => re.test(p));
}

function hasBlockedSegment(p: string): boolean {
  const segments = normalizeSeparators(p).split('/');
  return segments.some((seg) => BLOCKED_SEGMENTS.has(seg));
}

function isAbsoluteEscape(path: string, sandboxRoot: string): boolean {
  const norm = normalizeSeparators(path);
  const root = normalizeSeparators(sandboxRoot);
  // If the path is absolute and does not start with sandboxRoot, it's an escape
  if (norm.startsWith('/') && !norm.startsWith(root)) return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function validatePath(
  path:        string,
  sandboxRoot: string,
): PathValidationResult {
  if (!path || !path.trim()) {
    return { ok: false, path, reason: 'Path must be a non-empty string.' };
  }
  if (hasTraversal(path)) {
    return { ok: false, path, reason: 'Path traversal detected (contains "..").' };
  }
  if (hasBlockedSegment(path)) {
    return { ok: false, path, reason: 'Path contains a blocked segment.' };
  }
  if (isAbsoluteEscape(path, sandboxRoot)) {
    return { ok: false, path, reason: 'Absolute path escapes the sandbox root.' };
  }
  return { ok: true, path };
}

export function assertPath(path: string, sandboxRoot: string): void {
  const result = validatePath(path, sandboxRoot);
  if (!result.ok) throw new PathValidationError(result.reason!);
}

export function validatePaths(
  paths:       string[],
  sandboxRoot: string,
): PathValidationResult[] {
  return paths.map((p) => validatePath(p, sandboxRoot));
}

export function allPathsValid(
  paths:       string[],
  sandboxRoot: string,
): boolean {
  return validatePaths(paths, sandboxRoot).every((r) => r.ok);
}

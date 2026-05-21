/**
 * server/sandbox/filesystem/filesystem-guard.ts
 * Prevents any filesystem operation outside the project sandbox root.
 * Single responsibility: path scope enforcement. No execution.
 */

import path from "path";

export interface FilesystemGuardResult {
  blocked: boolean;
  reason:  string;
  scope:   string;
}

const PROTECTED_BASENAMES: Set<string> = new Set([
  ".env", ".env.local", ".env.production", ".env.development",
  ".env.staging", "id_rsa", "id_ed25519", ".npmrc", ".netrc",
]);

const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /\/\.git\//,
  /\/node_modules\/\.cache\//,
  /\/\.ssh\//,
  /\/\.aws\//,
  /\/\.config\/gcloud/,
  /^\/(?:etc|proc|sys|dev|root|usr\/bin|usr\/sbin|bin|sbin)\//,
];

export function guardFilesystem(
  targetPath: string,
  sandboxRoot: string,
): FilesystemGuardResult {
  const resolved  = path.resolve(targetPath);
  const rootAbs   = path.resolve(sandboxRoot);
  const scope     = rootAbs;

  // Must be inside sandbox root
  if (!resolved.startsWith(rootAbs + path.sep) && resolved !== rootAbs) {
    return {
      blocked: true,
      reason:  `Path "${targetPath}" is outside sandbox root "${rootAbs}".`,
      scope,
    };
  }

  // System path check
  for (const pattern of PROTECTED_PATH_PATTERNS) {
    if (pattern.test(resolved)) {
      return {
        blocked: true,
        reason:  `Path "${targetPath}" matches a protected system pattern.`,
        scope,
      };
    }
  }

  // Protected filename check
  const basename = path.basename(resolved);
  if (PROTECTED_BASENAMES.has(basename)) {
    return {
      blocked: true,
      reason:  `File "${basename}" is a protected credential/config file.`,
      scope,
    };
  }

  return { blocked: false, reason: "Path is within sandbox scope.", scope };
}

export function guardBatchPaths(
  paths: string[],
  sandboxRoot: string,
): FilesystemGuardResult[] {
  return paths.map(p => guardFilesystem(p, sandboxRoot));
}

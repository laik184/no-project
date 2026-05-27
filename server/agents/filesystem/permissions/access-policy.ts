import { normalizePath, basename, extname } from '../utils/path-utils.ts';

export interface AccessPolicy {
  protectedPaths: string[];
  readOnlyPaths: string[];
  blockedExtensions: string[];
  blockedPatterns: RegExp[];
}

const DEFAULT_POLICY: AccessPolicy = {
  protectedPaths: [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    '.env',
    '.env.local',
    '.env.production',
    '.gitignore',
    '.git',
  ],
  readOnlyPaths: [
    'node_modules',
  ],
  blockedExtensions: ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.bash'],
  blockedPatterns: [
    /^\.git\//,
    /^node_modules\//,
    /\/\.git\//,
    /\/node_modules\//,
  ],
};

export function isProtectedPath(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  const name = basename(normalized);
  return policy.protectedPaths.some(
    pp => name === pp || normalized === pp || normalized.endsWith('/' + pp),
  );
}

export function isReadOnlyPath(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  return policy.readOnlyPaths.some(
    rp => normalized === rp || normalized.startsWith(rp + '/') || normalized.includes('/' + rp + '/'),
  );
}

export function isBlockedExtension(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const ext = extname(p).toLowerCase();
  return policy.blockedExtensions.includes(ext);
}

export function isBlockedByPattern(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  return policy.blockedPatterns.some(re => re.test(normalized));
}

export function canWrite(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  if (isProtectedPath(p, policy)) return false;
  if (isReadOnlyPath(p, policy)) return false;
  if (isBlockedByPattern(p, policy)) return false;
  return true;
}

export function canDelete(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  if (isProtectedPath(p, policy)) return false;
  if (isReadOnlyPath(p, policy)) return false;
  if (isBlockedByPattern(p, policy)) return false;
  return true;
}

export function canRead(_p: string, _policy: AccessPolicy = DEFAULT_POLICY): boolean {
  return true;
}

export { DEFAULT_POLICY };

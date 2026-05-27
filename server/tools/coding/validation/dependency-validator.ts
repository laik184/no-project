/**
 * server/tools/coding/validation/dependency-validator.ts
 *
 * Checks that third-party packages imported by generated code
 * are declared in package.json.
 * Pure function after reading the package.json once.
 */

import { readFileSync } from 'node:fs';
import { join }         from 'node:path';

export interface DependencyValidationResult {
  valid:       boolean;
  errors:      string[];
  warnings:    string[];
  missing:     string[];
}

let _cachedDeps: Set<string> | null = null;

function loadDeclaredDeps(sandboxRoot: string): Set<string> {
  if (_cachedDeps) return _cachedDeps;
  try {
    const raw = readFileSync(join(sandboxRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    _cachedDeps = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
  } catch {
    _cachedDeps = new Set();
  }
  return _cachedDeps;
}

const BUILTIN_PREFIXES = ['node:', 'bun:'];
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
  'module', 'net', 'os', 'path', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'tty',
  'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

function extractThirdPartyImports(code: string): string[] {
  const re = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const p = m[1];
    if (p.startsWith('.') || p.startsWith('/')) continue;
    if (BUILTIN_PREFIXES.some(prefix => p.startsWith(prefix))) continue;
    const root = p.startsWith('@') ? p.split('/').slice(0, 2).join('/') : p.split('/')[0];
    if (!NODE_BUILTINS.has(root)) found.push(root);
  }
  return found;
}

export function validateDependencies(
  files:       Record<string, string>,
  sandboxRoot: string,
): DependencyValidationResult {
  const declared = loadDeclaredDeps(sandboxRoot);
  const missing  = new Set<string>();

  for (const code of Object.values(files)) {
    for (const dep of extractThirdPartyImports(code)) {
      if (!declared.has(dep)) missing.add(dep);
    }
  }

  const missingList = [...missing];
  const errors: string[] = missingList.map(
    d => `Package "${d}" is not declared in package.json — install it first`,
  );

  return {
    valid:    missingList.length === 0,
    errors,
    warnings: [],
    missing:  missingList,
  };
}

export function clearDepCache(): void {
  _cachedDeps = null;
}

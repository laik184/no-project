/**
 * dependency-context.ts
 * Extracts dependency information from package.json for LLM context.
 */

import { fileReader } from '../filesystem/file-reader.ts';

export interface DependencyContext {
  dependencies:    Record<string, string>;
  devDependencies: Record<string, string>;
  allPackages:     string[];
  hasPackage:      (name: string) => boolean;
}

const EMPTY: DependencyContext = {
  dependencies:    {},
  devDependencies: {},
  allPackages:     [],
  hasPackage:      () => false,
};

export async function buildDependencyContext(projectId: string): Promise<DependencyContext> {
  let raw: string;
  try {
    raw = await fileReader.read(projectId, 'package.json');
  } catch {
    return EMPTY;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return EMPTY;
  }

  const deps    = (pkg.dependencies as Record<string, string>)    ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string>) ?? {};
  const all     = [...new Set([...Object.keys(deps), ...Object.keys(devDeps)])];

  return {
    dependencies:    deps,
    devDependencies: devDeps,
    allPackages:     all,
    hasPackage:      (name: string) => all.includes(name),
  };
}

/** Format dependencies for prompt injection (short form). */
export function formatDependencies(ctx: DependencyContext, limit = 30): string {
  const listed = ctx.allPackages.slice(0, limit).join(', ');
  const more   = ctx.allPackages.length > limit ? ` (+${ctx.allPackages.length - limit} more)` : '';
  return `Installed packages: ${listed}${more}`;
}

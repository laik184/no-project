/**
 * architecture-context.ts
 * Detects project architecture patterns (monorepo, MVC, etc.)
 * for more accurate LLM code generation.
 */

import { fileSearch } from '../../filesystem/file-search.ts';

export type ArchPattern = 'monorepo' | 'fullstack-single' | 'frontend-only' | 'backend-only' | 'unknown';
export type CssFramework = 'tailwind' | 'css-modules' | 'styled-components' | 'none';
export type TestFramework = 'vitest' | 'jest' | 'node-test' | 'none';

export interface ArchitectureContext {
  pattern:      ArchPattern;
  cssFramework: CssFramework;
  testFramework:TestFramework;
  hasTypescript: boolean;
  routingStyle: 'wouter' | 'react-router' | 'next-router' | 'express' | 'none';
  stateLib:     'tanstack-query' | 'zustand' | 'redux' | 'none';
  conventions:  string[];
}

export async function detectArchitecture(projectId: string): Promise<ArchitectureContext> {
  const files = await fileSearch.listDir(projectId, '.', true).catch(() => [] as string[]);
  const fileSet = new Set(files.map((f) => f.toLowerCase()));

  const pattern      = detectPattern(fileSet);
  const cssFramework = detectCss(fileSet);
  const testFramework = detectTests(fileSet);

  const hasTs        = fileSet.has('tsconfig.json') || files.some((f) => f.endsWith('.ts'));
  const routingStyle = detectRouting(fileSet);
  const stateLib     = detectState(fileSet);

  const conventions  = buildConventions(pattern, hasTs, cssFramework);

  return { pattern, cssFramework, testFramework, hasTypescript: hasTs, routingStyle, stateLib, conventions };
}

function detectPattern(files: Set<string>): ArchPattern {
  if (files.has('client/package.json') && files.has('server/package.json')) return 'monorepo';
  if (files.has('client') && files.has('server')) return 'fullstack-single';
  if (files.has('src/app.tsx') || files.has('src/main.tsx')) return 'frontend-only';
  if (files.has('main.ts') && !files.has('src/main.tsx')) return 'backend-only';
  return 'unknown';
}

function detectCss(files: Set<string>): CssFramework {
  if (files.has('tailwind.config.ts') || files.has('tailwind.config.js')) return 'tailwind';
  if ([...files].some((f) => f.endsWith('.module.css'))) return 'css-modules';
  if ([...files].some((f) => f.includes('styled-components'))) return 'styled-components';
  return 'none';
}

function detectTests(files: Set<string>): TestFramework {
  if (files.has('vitest.config.ts') || files.has('vitest.config.js')) return 'vitest';
  if (files.has('jest.config.js') || files.has('jest.config.ts')) return 'jest';
  if ([...files].some((f) => f.endsWith('.test.ts') || f.endsWith('.test.js'))) return 'node-test';
  return 'none';
}

function detectRouting(files: Set<string>): ArchitectureContext['routingStyle'] {
  if ([...files].some((f) => f.includes('wouter'))) return 'wouter';
  if ([...files].some((f) => f.includes('react-router'))) return 'react-router';
  if ([...files].some((f) => f.includes('pages/'))) return 'next-router';
  if ([...files].some((f) => f.includes('routes/'))) return 'express';
  return 'none';
}

function detectState(files: Set<string>): ArchitectureContext['stateLib'] {
  if ([...files].some((f) => f.includes('react-query') || f.includes('tanstack'))) return 'tanstack-query';
  if ([...files].some((f) => f.includes('zustand'))) return 'zustand';
  if ([...files].some((f) => f.includes('redux'))) return 'redux';
  return 'none';
}

function buildConventions(
  pattern:      ArchPattern,
  hasTs:        boolean,
  cssFramework: CssFramework,
): string[] {
  const c: string[] = [];
  if (hasTs) c.push('TypeScript — always use types, avoid `any`');
  if (cssFramework === 'tailwind') c.push('Tailwind CSS — use utility classes, not inline styles');
  if (pattern === 'fullstack-single') c.push('Fullstack monolith — client/ for frontend, server/ for backend');
  return c;
}

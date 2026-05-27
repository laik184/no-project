/**
 * project-context.ts
 * Builds a structured summary of the project for LLM context injection.
 */

import { fileReader } from '../filesystem/file-reader.ts';
import { fileSearch } from '../filesystem/file-search.ts';

export interface ProjectContext {
  name:        string;
  description: string;
  techStack:   string[];
  fileCount:   number;
  hasFrontend: boolean;
  hasBackend:  boolean;
  hasDatabase: boolean;
  entryFiles:  string[];
}

export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const files = await fileSearch.listDir(projectId, '.', true).catch(() => [] as string[]);

  // Read package.json for name/description
  let name = 'unknown';
  let description = '';
  let techStack: string[] = [];

  try {
    const pkg = JSON.parse(await fileReader.read(projectId, 'package.json')) as Record<string, unknown>;
    name        = String(pkg.name ?? 'unknown');
    description = String(pkg.description ?? '');
    techStack   = extractTechStack(pkg);
  } catch { /* no package.json */ }

  const fileSet = new Set(files);

  const hasFrontend = files.some((f) =>
    /\.(tsx|jsx)$/.test(f) || f.includes('src/pages') || f.includes('client/'),
  );
  const hasBackend  = files.some((f) =>
    /server\/|routes\/|api\//.test(f) || f.endsWith('main.ts') || f.endsWith('index.ts'),
  );
  const hasDatabase = fileSet.has('drizzle.config.ts') ||
    files.some((f) => f.includes('schema') || f.includes('migration'));

  const entryFiles = [
    'src/index.ts', 'src/main.ts', 'client/src/main.tsx',
    'server/index.ts', 'main.ts', 'index.ts',
  ].filter((f) => fileSet.has(f));

  return {
    name,
    description,
    techStack,
    fileCount:   files.length,
    hasFrontend,
    hasBackend,
    hasDatabase,
    entryFiles,
  };
}

function extractTechStack(pkg: Record<string, unknown>): string[] {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  const known: Record<string, string> = {
    react: 'React', vite: 'Vite', express: 'Express',
    'drizzle-orm': 'Drizzle ORM', postgresql: 'PostgreSQL',
    tailwindcss: 'Tailwind CSS', typescript: 'TypeScript',
    'next': 'Next.js', prisma: 'Prisma',
  };
  return Object.entries(known)
    .filter(([pkg]) => pkg in deps)
    .map(([, name]) => name);
}

/** Format project context as a compact string for prompt injection. */
export function formatProjectContext(ctx: ProjectContext): string {
  const lines = [
    `Project: ${ctx.name}${ctx.description ? ` — ${ctx.description}` : ''}`,
    `Stack: ${ctx.techStack.join(', ') || 'unknown'}`,
    `Files: ${ctx.fileCount} | Frontend: ${ctx.hasFrontend} | Backend: ${ctx.hasBackend} | DB: ${ctx.hasDatabase}`,
  ];
  if (ctx.entryFiles.length) lines.push(`Entry points: ${ctx.entryFiles.join(', ')}`);
  return lines.join('\n');
}

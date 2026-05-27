import { buildStructure, type StructureSpec } from './structure-builder.ts';
import { validateStructure } from './structure-validator.ts';
import type { BuildResult } from './structure-builder.ts';

export type ProjectTemplate = 'node-api' | 'react-app' | 'fullstack' | 'library';

export interface ScaffoldOptions {
  sandboxRoot: string;
  projectName: string;
  template: ProjectTemplate;
  rootPath?: string;
}

const TEMPLATES: Record<ProjectTemplate, (name: string) => StructureSpec> = {
  'node-api': (name) => ({
    rootPath: name,
    folders: [
      { path: 'src', subfolders: [{ path: 'routes' }, { path: 'middleware' }, { path: 'utils' }] },
    ],
    files: [
      { path: 'src/index.ts', content: `import express from 'express';\n\nconst app = express();\nconst PORT = Number(process.env.PORT) || 3000;\n\napp.use(express.json());\n\napp.get('/health', (_req, res) => res.json({ status: 'ok' }));\n\napp.listen(PORT, () => console.log(\`Server on port \${PORT}\`));\n` },
      { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', type: 'module', scripts: { dev: 'tsx src/index.ts', build: 'tsc' }, dependencies: { express: '^4.18.0' } }, null, 2) },
      { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true, outDir: 'dist' }, include: ['src'] }, null, 2) },
    ],
  }),

  'react-app': (name) => ({
    rootPath: name,
    folders: [
      { path: 'src', subfolders: [{ path: 'components' }, { path: 'pages' }, { path: 'hooks' }] },
      { path: 'public' },
    ],
    files: [
      { path: 'src/main.tsx', content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n` },
      { path: 'src/App.tsx', content: `export default function App(): React.ReactElement {\n  return <div><h1>${name}</h1></div>;\n}\n` },
      { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>${name}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n` },
      { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } }, null, 2) },
    ],
  }),

  'fullstack': (name) => ({
    rootPath: name,
    folders: [
      { path: 'client/src', subfolders: [{ path: 'components' }, { path: 'pages' }] },
      { path: 'server/src', subfolders: [{ path: 'routes' }, { path: 'middleware' }] },
      { path: 'shared' },
    ],
    files: [
      { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', workspaces: ['client', 'server'], scripts: { dev: 'concurrently "npm:dev:*"' } }, null, 2) },
    ],
  }),

  'library': (name) => ({
    rootPath: name,
    folders: [{ path: 'src' }, { path: 'tests' }],
    files: [
      { path: 'src/index.ts', content: `export * from './lib';\n` },
      { path: 'src/lib.ts', content: `export function main(): void {\n  // library entry point\n}\n` },
      { path: 'package.json', content: JSON.stringify({ name, version: '0.1.0', type: 'module', main: 'dist/index.js', scripts: { build: 'tsc', test: 'vitest' } }, null, 2) },
    ],
  }),
};

export async function generateScaffold(opts: ScaffoldOptions): Promise<BuildResult> {
  const rootPath = opts.rootPath ?? opts.projectName;
  const spec = TEMPLATES[opts.template](opts.projectName);
  const adjusted: StructureSpec = { ...spec, rootPath };

  const validation = validateStructure(adjusted);
  if (!validation.valid) {
    const errors = validation.issues.filter(i => i.severity === 'error').map(i => i.issue).join(', ');
    throw new Error(`Invalid scaffold spec: ${errors}`);
  }

  return buildStructure(opts.sandboxRoot, adjusted);
}

export function getAvailableTemplates(): ProjectTemplate[] {
  return Object.keys(TEMPLATES) as ProjectTemplate[];
}

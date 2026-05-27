import fs   from 'fs/promises';
import path  from 'path';
import { assertWorkspaceReady } from '../workspace/workspace-resolver.ts';
import { runtimeLogger }        from '../telemetry/runtime-logger.ts';

export interface PackageJsonTemplate {
  name:            string;
  version?:        string;
  type?:           'module' | 'commonjs';
  scripts?:        Record<string, string>;
  dependencies?:   Record<string, string>;
  devDependencies?: Record<string, string>;
}

const DEFAULT_SCRIPTS = {
  dev:   'node index.js',
  build: 'tsc',
  start: 'node dist/index.js',
};

export async function writePackageJson(
  runId:     string,
  projectId: string,
  template:  PackageJsonTemplate,
): Promise<void> {
  const cwd = await assertWorkspaceReady(projectId);
  const pkg = {
    name:            template.name,
    version:         template.version   ?? '1.0.0',
    type:            template.type      ?? 'module',
    scripts:         template.scripts   ?? DEFAULT_SCRIPTS,
    dependencies:    template.dependencies    ?? {},
    devDependencies: template.devDependencies ?? {},
  };

  const dest = path.join(cwd, 'package.json');
  await fs.writeFile(dest, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  runtimeLogger.info(runId, '[package-json-writer] Written', {
    name: pkg.name,
    depsCount: Object.keys(pkg.dependencies).length,
  });
}

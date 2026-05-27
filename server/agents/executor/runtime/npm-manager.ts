import { shellExecutor } from './shell-executor.ts';
import type { ShellResult } from './shell-executor.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';

const SAFE_PACKAGES_BLOCKLIST = [
  'child_process', 'fs', 'vm', 'cluster', 'worker_threads',
];

function isPackageAllowed(pkg: string): boolean {
  const name = pkg.split('@')[0];
  return !SAFE_PACKAGES_BLOCKLIST.includes(name);
}

export const npmManager = {
  async install(
    runId:     string,
    projectId: string,
    packages:  string[] = [],
    dev        = false,
  ): Promise<ShellResult> {
    for (const pkg of packages) {
      if (!isPackageAllowed(pkg)) {
        throw new Error(`Package '${pkg}' is blocked for security reasons`);
      }
    }

    const pkgArgs = packages.join(' ');
    const devFlag = dev ? ' --save-dev' : '';
    const cmd     = packages.length > 0
      ? `npm install ${pkgArgs}${devFlag}`
      : 'npm install';

    executorLogger.info(runId, `npm install: ${cmd}`);
    return shellExecutor.executeInSandbox(runId, projectId, cmd, 120_000);
  },

  async runScript(
    runId:     string,
    projectId: string,
    script:    string,
    timeoutMs  = 60_000,
  ): Promise<ShellResult> {
    executorLogger.info(runId, `npm run ${script}`);
    return shellExecutor.executeInSandbox(runId, projectId, `npm run ${script}`, timeoutMs);
  },

  async writePackageJson(
    runId:     string,
    projectId: string,
    name:      string,
    deps:      Record<string, string> = {},
    devDeps:   Record<string, string> = {},
  ): Promise<void> {
    const pkg = {
      name,
      version: '1.0.0',
      type:    'module',
      scripts: { dev: 'node index.js', build: 'tsc' },
      dependencies:    deps,
      devDependencies: devDeps,
    };
    const { fileWriter } = await import('../filesystem/file-writer.ts');
    await fileWriter.write(projectId, 'package.json', JSON.stringify(pkg, null, 2) + '\n');
    executorLogger.info(runId, 'package.json written', { name, depsCount: Object.keys(deps).length });
  },
};

/**
 * server/services/package/package.service.ts
 *
 * npm package management: install, uninstall, list.
 * Runs npm as a child process inside the sandbox directory.
 *
 * Dependency rule:
 *   Tool → PackageService (this) → child_process (infra)
 */

import { execFile }  from 'child_process';
import { promisify } from 'util';
import { getProjectDir } from '../../infrastructure/index.ts';

const exec = promisify(execFile);

export interface PackageResult {
  ok:      boolean;
  output?: string;
  error?:  string;
}

export interface InstalledPackage {
  name:    string;
  version: string;
}

class PackageService {
  private get cwd(): string {
    return getProjectDir(1);
  }

  async install(packageName: string, dev = false): Promise<PackageResult> {
    try {
      const args = ['install', packageName];
      if (dev) args.push('--save-dev');
      const { stdout, stderr } = await exec('npm', args, { cwd: this.cwd, timeout: 120_000 });
      return { ok: true, output: stdout || stderr };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async uninstall(packageName: string): Promise<PackageResult> {
    try {
      const { stdout, stderr } = await exec('npm', ['uninstall', packageName], {
        cwd:     this.cwd,
        timeout: 60_000,
      });
      return { ok: true, output: stdout || stderr };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async list(): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await exec('npm', ['list', '--depth=0', '--json'], {
        cwd:     this.cwd,
        timeout: 15_000,
      });
      const parsed = JSON.parse(stdout) as { dependencies?: Record<string, { version: string }> };
      return Object.entries(parsed.dependencies ?? {}).map(([name, info]) => ({
        name,
        version: info.version,
      }));
    } catch {
      return [];
    }
  }
}

export const packageService = new PackageService();

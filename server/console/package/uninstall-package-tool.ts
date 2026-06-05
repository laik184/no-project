/**
 * server/console/package/uninstall-package-tool.ts
 *
 * Uninstalls an npm package via PackageService.
 * Imports: PackageService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { packageService }                       from '../../services/package/index.ts';

export interface UninstallPackageInput {
  packageName: string;
}

export interface UninstallPackageOutput {
  packageName: string;
  output?:     string;
}

export class UninstallPackageTool implements ConsoleTool<UninstallPackageInput, ConsoleToolResult<UninstallPackageOutput>> {
  readonly id          = 'console.package.uninstall';
  readonly description = 'Uninstalls an npm package from the project sandbox.';

  async execute(input: UninstallPackageInput): Promise<ConsoleToolResult<UninstallPackageOutput>> {
    try {
      const result = await packageService.uninstall(input.packageName);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, data: { packageName: input.packageName, output: result.output } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const uninstallPackageTool = new UninstallPackageTool();

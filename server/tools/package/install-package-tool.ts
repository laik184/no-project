/**
 * server/tools/package/install-package-tool.ts
 *
 * Installs an npm package in the sandbox via PackageService + ProcessService.
 *
 * Imports: PackageService, ProcessService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult }  from '../contracts/tool.ts';
import { packageService }         from '../../services/package/index.ts';
import { processService }         from '../../services/console/index.ts';

export interface InstallPackageInput {
  packageName: string;
  dev?:        boolean;
  projectId?:  number;
}

export interface InstallPackageOutput {
  packageName: string;
  output?:     string;
}

export class InstallPackageTool implements Tool<InstallPackageInput, ToolResult<InstallPackageOutput>> {
  readonly id          = 'package.install';
  readonly description = 'Installs an npm package in the project sandbox.';

  async execute(input: InstallPackageInput): Promise<ToolResult<InstallPackageOutput>> {
    try {
      if (input.projectId !== undefined && processService.isRunning(input.projectId)) {
        processService.stop(input.projectId);
      }

      const result = await packageService.install(input.packageName, input.dev ?? false);
      if (!result.ok) return { ok: false, error: result.error };

      return {
        ok:   true,
        data: { packageName: input.packageName, output: result.output },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const installPackageTool = new InstallPackageTool();

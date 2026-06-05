import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface InstallPackageInput { packageName: string; dev?: boolean; projectId?: number; }
export interface InstallPackageOutput { packageName: string; output?: string; }

export class InstallPackageTool implements ConsoleTool<InstallPackageInput, ConsoleToolResult<InstallPackageOutput>> {
  readonly id          = 'console.package.install';
  readonly description = 'Installs an npm package in the project sandbox.';

  async execute(_input: InstallPackageInput): Promise<ConsoleToolResult<InstallPackageOutput>> {
    return { ok: false, error: 'Package service not available.' };
  }
}

export const installPackageTool = new InstallPackageTool();

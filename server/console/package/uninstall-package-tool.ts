import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface UninstallPackageInput { packageName: string; }
export interface UninstallPackageOutput { packageName: string; output?: string; }

export class UninstallPackageTool implements ConsoleTool<UninstallPackageInput, ConsoleToolResult<UninstallPackageOutput>> {
  readonly id          = 'console.package.uninstall';
  readonly description = 'Uninstalls an npm package from the project sandbox.';

  async execute(_input: UninstallPackageInput): Promise<ConsoleToolResult<UninstallPackageOutput>> {
    return { ok: false, error: 'Package service not available.' };
  }
}

export const uninstallPackageTool = new UninstallPackageTool();

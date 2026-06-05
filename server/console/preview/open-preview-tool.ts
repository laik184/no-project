import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface OpenPreviewInput { _?: never; }
export interface PreviewInfo { url: string | null; available: boolean; }
export type OpenPreviewOutput = PreviewInfo;

export class OpenPreviewTool implements ConsoleTool<OpenPreviewInput, ConsoleToolResult<OpenPreviewOutput>> {
  readonly id          = 'console.preview.open';
  readonly description = 'Returns the live preview URL and availability of the running sandbox.';

  async execute(_input: OpenPreviewInput): Promise<ConsoleToolResult<OpenPreviewOutput>> {
    return { ok: false, error: 'Preview service not available.' };
  }
}

export const openPreviewTool = new OpenPreviewTool();

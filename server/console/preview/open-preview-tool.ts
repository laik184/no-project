/**
 * server/console/preview/open-preview-tool.ts
 *
 * Resolves the live preview URL via PreviewService.
 * Imports: PreviewService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { previewService }                       from '../../services/preview/index.ts';
import type { PreviewInfo }                     from '../../services/preview/index.ts';

export interface OpenPreviewInput {
  _?: never;
}

export type OpenPreviewOutput = PreviewInfo;

export class OpenPreviewTool implements ConsoleTool<OpenPreviewInput, ConsoleToolResult<OpenPreviewOutput>> {
  readonly id          = 'console.preview.open';
  readonly description = 'Returns the live preview URL and availability of the running sandbox.';

  async execute(_input: OpenPreviewInput): Promise<ConsoleToolResult<OpenPreviewOutput>> {
    try {
      const info = await previewService.getInfo();
      return { ok: true, data: info };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const openPreviewTool = new OpenPreviewTool();

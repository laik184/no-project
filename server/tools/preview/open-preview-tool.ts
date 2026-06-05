/**
 * server/tools/preview/open-preview-tool.ts
 *
 * Resolves the live preview URL for the running sandbox via PreviewService.
 *
 * Imports: PreviewService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult } from '../contracts/tool.ts';
import { previewService }        from '../../services/preview/index.ts';
import type { PreviewInfo }      from '../../services/preview/index.ts';

export interface OpenPreviewInput {
  _?: never;
}

export interface OpenPreviewOutput extends PreviewInfo {}

export class OpenPreviewTool implements Tool<OpenPreviewInput, ToolResult<OpenPreviewOutput>> {
  readonly id          = 'preview.open';
  readonly description = 'Returns the live preview URL and availability status of the running sandbox.';

  async execute(_input: OpenPreviewInput): Promise<ToolResult<OpenPreviewOutput>> {
    try {
      const info = await previewService.getInfo();
      return { ok: true, data: info };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const openPreviewTool = new OpenPreviewTool();

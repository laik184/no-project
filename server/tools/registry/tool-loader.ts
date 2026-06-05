/**
 * server/tools/registry/tool-loader.ts
 *
 * Single boot-time owner of ALL tool registrations.
 *
 * Boot flow:
 *   main.ts → loadAllTools() → registerTool() × N → sealRegistry() → system ready
 */

import { registerFilesystemTools } from '../filesystem/index.ts';
import { registerCodingTools }     from '../coding/index.ts';
import { sealRegistry, toolCount, isSealed } from './tool-registry.ts';

export function loadAllTools(): void {
  if (isSealed()) {
    console.warn('[tool-loader] loadAllTools() called after registry already sealed — skipping.');
    return;
  }

  registerFilesystemTools();
  registerCodingTools();

  sealRegistry();

  console.log(`[tool-loader] ${toolCount()} tools registered across 2 categories — registry sealed.`);
}

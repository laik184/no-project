/**
 * server/tools/registry/tool-loader.ts
 *
 * Single boot-time owner of ALL tool registrations.
 *
 * Responsibilities:
 *   - import all tool categories
 *   - register all tools in correct order
 *   - call sealRegistry() after all registrations
 *
 * NOTHING ELSE. No business logic. No execution.
 *
 * Boot flow:
 *   main.ts → loadAllTools() → registerTool() × N → sealRegistry() → system ready
 */

import { registerFilesystemTools } from '../filesystem/index.ts';
import { registerTerminalTools }   from '../terminal/index.ts';
import { registerVerifierTools }   from '../verifier/index.ts';
import { registerBrowserTools }    from '../browser/index.ts';
import { registerCodingTools }     from '../coding/index.ts';
import { registerPlannerTools }    from '../planner/register-planner-tools.ts';
import { sealRegistry, toolCount, isSealed } from './tool-registry.ts';

export function loadAllTools(): void {
  if (isSealed()) {
    console.warn('[tool-loader] loadAllTools() called after registry already sealed — skipping.');
    return;
  }

  registerFilesystemTools();
  registerTerminalTools();
  registerVerifierTools();
  registerBrowserTools();
  registerCodingTools();
  registerPlannerTools();

  sealRegistry();

  console.log(`[tool-loader] ${toolCount()} tools registered across 6 categories — registry sealed.`);
}

/**
 * server/tools/registry/tool-loader.ts
 *
 * Single boot-time owner of ALL tool registrations.
 *
 * Boot flow:
 *   main.ts → loadAllTools() → registerTool() × N → sealRegistry() → system ready
 *
 * Phase A — Platform tools (filesystem + coding) registered into the platform registry.
 * Phase B — Clean-Architecture tools registered into the contracts ToolRegistry.
 */

// ── Phase A: Platform tool registrations ──────────────────────────────────────
import { registerFilesystemTools } from '../filesystem/index.ts';
import { registerCodingTools }     from '../coding/index.ts';
import { sealRegistry, toolCount, isSealed } from './tool-registry.ts';

// ── Phase B: Clean-Architecture tools ─────────────────────────────────────────
import { toolRegistry } from '../contracts/index.ts';

import { terminalTool }                          from '../terminal/index.ts';
import { installPackageTool, uninstallPackageTool } from '../package/index.ts';
import { startRuntimeTool, restartRuntimeTool, stopRuntimeTool } from '../runtime/index.ts';
import { gitStatusTool, gitCommitTool, gitRestoreTool }          from '../git/index.ts';
import { createCheckpointTool, restoreCheckpointTool }           from '../checkpoint/index.ts';
import { openPreviewTool }                                        from '../preview/index.ts';

const CA_TOOLS = [
  terminalTool,
  installPackageTool,
  uninstallPackageTool,
  startRuntimeTool,
  restartRuntimeTool,
  stopRuntimeTool,
  gitStatusTool,
  gitCommitTool,
  gitRestoreTool,
  createCheckpointTool,
  restoreCheckpointTool,
  openPreviewTool,
] as const;

export function loadAllTools(): void {
  if (isSealed()) {
    console.warn('[tool-loader] loadAllTools() called after registry already sealed — skipping.');
    return;
  }

  // Phase A — platform registry
  registerFilesystemTools();
  registerCodingTools();

  sealRegistry();

  // Phase B — clean-arch registry
  for (const tool of CA_TOOLS) {
    toolRegistry.register(tool);
  }

  console.log(
    `[tool-loader] ${toolCount()} platform tools + ${CA_TOOLS.length} CA tools registered — registry sealed.`,
  );
}

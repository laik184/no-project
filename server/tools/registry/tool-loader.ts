/**
 * server/tools/registry/tool-loader.ts
 *
 * Single boot-time owner of ALL tool registrations.
 *
 * Boot flow:
 *   main.ts → loadAllTools() → registerTool() × N → sealRegistry() → system ready
 *
 * Phase A — Platform tools (filesystem + coding + terminal + verifier + git).
 */

// ── Phase A: Platform tool registrations ──────────────────────────────────────
import { registerFilesystemTools } from '../filesystem/index.ts';
import { registerCodingTools }     from '../coding/index.ts';
import { registerTerminalTools }   from '../terminal/index.ts';
import { registerVerifierTools }   from '../verifier/register-verifier-tools.ts';
import { registerGitTools }        from '../git/register-git-tools.ts';
import { sealRegistry, toolCount, isSealed } from './tool-registry.ts';

export function loadAllTools(): void {
  if (isSealed()) {
    console.warn('[tool-loader] loadAllTools() called after registry already sealed — skipping.');
    return;
  }

  // Phase A — platform registry
  registerFilesystemTools();
  registerCodingTools();
  registerTerminalTools();
  registerVerifierTools();
  registerGitTools();

  sealRegistry();

  console.log(
    `[tool-loader] ${toolCount()} tools registered (filesystem + coding + terminal + verifier + git) — registry sealed.`,
  );
}

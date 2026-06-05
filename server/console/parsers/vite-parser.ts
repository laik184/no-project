/**
 * server/console/parsers/vite-parser.ts
 *
 * Detects Vite dev-server log patterns and extracts structured ViteMeta.
 */

import type { ViteMeta } from '../../shared/console/types.ts';

const RE_STARTING     = /vite\s+v[\d.]+\s+ready|vite\s+dev\s+server\s+running/i;
const RE_READY        = /➜\s+Local:|local:\s+http/i;
const RE_HMR          = /\[vite\]\s+(hmr|hot update|page reload)/i;
const RE_COMPILE_ERR  = /\[vite\]\s+error|build\s+failed|plugin\s+error/i;
const RE_BUILD_START  = /building for production|vite\s+build/i;
const RE_BUILD_DONE   = /built in \d+|✓\s+\d+\s+modules/i;
const RE_URL          = /https?:\/\/\S+/;

export function parseVite(line: string): ViteMeta | null {
  if (RE_COMPILE_ERR.test(line)) {
    return { type: 'compile-error' };
  }

  if (RE_BUILD_DONE.test(line)) {
    return { type: 'build-done' };
  }

  if (RE_BUILD_START.test(line)) {
    return { type: 'build-start' };
  }

  if (RE_HMR.test(line)) {
    return { type: 'hmr' };
  }

  if (RE_READY.test(line)) {
    const urlMatch = RE_URL.exec(line);
    return { type: 'ready', url: urlMatch?.[0] };
  }

  if (RE_STARTING.test(line)) {
    const urlMatch = RE_URL.exec(line);
    return { type: 'starting', url: urlMatch?.[0] };
  }

  return null;
}

export function isViteLine(line: string): boolean {
  return /\[vite\]/i.test(line) || /➜\s+(Local|Network):/i.test(line) || /VITE\s+v[\d.]+/i.test(line);
}

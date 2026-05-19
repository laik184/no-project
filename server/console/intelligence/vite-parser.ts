/**
 * IQ 2000 — Console · Intelligence · Vite Parser
 *
 * Parses Vite dev server output into structured metadata.
 * Returns null for non-Vite lines.
 */

import type { ViteMeta } from '../types.ts';

const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
function strip(s: string): string { return s.replace(ANSI_RE, '').trim(); }

// "VITE v5.4.21  ready in 310 ms"
const VITE_READY_RE   = /VITE\s+v[\d.]+.*ready in/i;
// "➜  Local:   http://localhost:5173/"
const LOCAL_URL_RE    = /Local:\s+(https?:\/\/[^\s]+)/i;
// "➜  Network: http://0.0.0.0:5173/"
const NETWORK_URL_RE  = /Network:\s+(https?:\/\/[^\s]+)/i;
// "[vite] hmr update /src/App.tsx"
const HMR_RE          = /\[vite\]\s+hmr\s+update/i;
// "[vite] Internal server error"
const VITE_ERR_RE     = /\[vite\].*(error|failed)/i;
// "vite v5.4.21 building for production..."
const BUILD_START_RE  = /vite v[\d.]+\s+building/i;
// "✓ built in 13.64s"
const BUILD_DONE_RE   = /[✓✔]\s+built in/;

export function parseVite(raw: string): ViteMeta | null {
  const text = strip(raw);

  if (VITE_READY_RE.test(text))  return { type: 'ready' };
  if (BUILD_DONE_RE.test(text))  return { type: 'build-done' };
  if (BUILD_START_RE.test(text)) return { type: 'build-start' };
  if (VITE_ERR_RE.test(text))    return { type: 'compile-error' };
  if (HMR_RE.test(text)) {
    const file = text.match(/hmr update (.+)/i)?.[1]?.trim();
    return { type: 'hmr', file };
  }

  const localMatch = LOCAL_URL_RE.exec(text);
  if (localMatch) return { type: 'ready', url: localMatch[1] };

  const netMatch = NETWORK_URL_RE.exec(text);
  if (netMatch) return { type: 'ready', url: netMatch[1] };

  return null;
}

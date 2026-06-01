/**
 * server/startup/health-diagnostics.ts
 *
 * Boot-time environment validation.
 * Emits clear, actionable warnings when required env vars are missing.
 * Never throws — this is diagnostic-only.
 */

import { existsSync, mkdirSync } from 'fs';

export interface DiagnosticsResult {
  hasLLMKey:      boolean;
  hasSandboxRoot: boolean;
  sandboxPath:    string;
  warnings:       string[];
}

export function runStartupDiagnostics(): DiagnosticsResult {
  const warnings: string[] = [];

  // ── LLM Key ──────────────────────────────────────────────────────────────
  const hasLLMKey = !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
  );

  if (!hasLLMKey) {
    const w = '[health] ⚠️  OPENROUTER_API_KEY not set — AI responses will be disabled.\n' +
              '[health]    → Set OPENROUTER_API_KEY in Replit Secrets to enable LLM features.';
    warnings.push(w);
    console.warn(w);
  } else {
    const src = process.env.OPENROUTER_API_KEY ? 'OPENROUTER_API_KEY' : 'AI_INTEGRATIONS_OPENROUTER_API_KEY';
    console.log(`[health] ✓  LLM key found (${src})`);
  }

  // ── Sandbox Root ──────────────────────────────────────────────────────────
  const sandboxPath     = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';
  const hasSandboxRoot  = sandboxPath !== '.sandbox';

  if (!hasSandboxRoot) {
    const w = '[health] ⚠️  AGENT_PROJECT_ROOT not set — defaulting to ".sandbox"\n' +
              '[health]    → Set AGENT_PROJECT_ROOT=/tmp/nurax-sandbox or any writable path.\n' +
              '[health]    → Verifier and filesystem tools may fail without a valid sandbox.';
    warnings.push(w);
    console.warn(w);

    // Auto-create .sandbox so verifier/executor have a valid base path
    try {
      if (!existsSync('.sandbox')) {
        mkdirSync('.sandbox', { recursive: true });
        console.log('[health] ✓  Created .sandbox directory as fallback sandbox root');
      }
    } catch {
      console.warn('[health] ⚠️  Could not auto-create .sandbox — verifier may skip');
    }
  } else {
    // Ensure the configured path exists
    try {
      if (!existsSync(sandboxPath)) {
        mkdirSync(sandboxPath, { recursive: true });
        console.log(`[health] ✓  Created sandbox directory: ${sandboxPath}`);
      } else {
        console.log(`[health] ✓  AGENT_PROJECT_ROOT=${sandboxPath}`);
      }
    } catch {
      console.warn(`[health] ⚠️  AGENT_PROJECT_ROOT=${sandboxPath} is not writable`);
    }
  }

  // ── Model ─────────────────────────────────────────────────────────────────
  const model = process.env.LLM_MODEL ?? 'meta-llama/llama-3.3-70b-instruct';
  console.log(`[health] ✓  LLM model: ${model}`);

  if (warnings.length === 0) {
    console.log('[health] ✓  All environment checks passed');
  }

  return { hasLLMKey, hasSandboxRoot, sandboxPath, warnings };
}

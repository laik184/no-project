/**
 * eslint.config.mjs — Architecture boundary enforcement
 *
 * Enforces the strict layer dependency graph:
 *
 *   infrastructure ← memory ← tools ← agents ← orchestration ← chat ← main.ts
 *
 * Arrows point toward dependencies. No layer may import a layer above it.
 */

import tsParser from '@typescript-eslint/parser';

export default [
  {
    // Apply TypeScript parser to all TS files
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
  },

  {
    // ── Tools: must not import agents, orchestration, or chat ─────────────────
    files: ['server/tools/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/agents/**'],
            message: '[arch] Tools must not import from the agents layer.',
          },
          {
            group: ['**/orchestration/**'],
            message: '[arch] Tools must not import from the orchestration layer.',
          },
          {
            group: ['**/chat/**'],
            message: '[arch] Tools must not import from the chat layer.',
          },
        ],
      }],
    },
  },

  {
    // ── Agents: must not import chat or orchestration ──────────────────────────
    files: ['server/agents/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/chat/**'],
            message:
              '[arch] Agents must not import from the chat layer. ' +
              'Accept stream/callback dependencies via injection instead.',
          },
          {
            group: ['**/orchestration/**'],
            message:
              '[arch] Agents must not import from the orchestration layer. ' +
              'Use bus.emit() for upward event communication.',
          },
        ],
      }],
    },
  },

  {
    // ── Orchestration: must not import chat ────────────────────────────────────
    files: ['server/orchestration/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/chat/**'],
            message:
              '[arch] Orchestration must never import from the chat layer. ' +
              'All upward communication must go through bus.emit().',
          },
        ],
      }],
    },
  },

  {
    // ── Infrastructure: must not import any domain layer ──────────────────────
    files: ['server/infrastructure/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '**/agents/**',
              '**/tools/**',
              '**/orchestration/**',
              '**/chat/**',
              '**/memory/**',
            ],
            message:
              '[arch] Infrastructure is the foundation layer. ' +
              'It must not import any domain layer above it.',
          },
        ],
      }],
    },
  },

  {
    // ── Memory: must not import domain layers ──────────────────────────────────
    files: ['server/memory/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '**/agents/**',
              '**/tools/**',
              '**/orchestration/**',
              '**/chat/**',
            ],
            message:
              '[arch] Memory must not import agents, tools, orchestration, or chat.',
          },
        ],
      }],
    },
  },
];

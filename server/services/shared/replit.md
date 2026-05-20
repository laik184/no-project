# core/shared/utils

## Purpose
Single canonical location for all shared utility functions used across agent modules.
Replaces 52+ duplicate copies of logger, deep-freeze, and normalization utilities.

## Available Utils

| File | Exports | Usage |
|---|---|---|
| `logger.util.ts` | `pushLog`, `pushError`, `pushWarn` | Append timestamped messages to log arrays |
| `deep-freeze.util.ts` | `deepFreeze<T>` | Recursively freeze objects for immutability |
| `normalization.util.ts` | `clamp`, `normalizeToUnit`, `normalizeConfidence`, `normalizeRisk`, `softmax`, `percentile` | Numeric normalization helpers |

## Migration
All agent modules should import from this shared location instead of maintaining local copies.
Local copies in individual module utils/ folders have been replaced with barrel re-exports.

## Rules
- No agent logic here — only pure, stateless utility functions
- No cross-module imports within this directory
- All functions must be deterministic and side-effect free

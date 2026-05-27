/**
 * server/tools/coding/index.ts
 *
 * Public entry point for the coding tool layer.
 *
 * Architecture:
 *   Executor Agent → Tool Dispatcher → Coding Tools → Generated Code (string)
 *
 * Coding tools ONLY generate code as strings (Record<string, string>).
 * They NEVER write files or run terminal commands.
 * Filesystem tools handle writing; terminal tools handle commands.
 */

// ── Registration ──────────────────────────────────────────────────────────────
export {
  registerCodingTools,
  CODING_TOOL_COUNT,
  CODING_TOOL_NAMES,
} from './registry/register-coding-tools.ts';

// ── Shared types for consumers ────────────────────────────────────────────────
export type { GenerationResult, GenerationStrategy } from './shared/coding-types.ts';
export { CodingToolError }                           from './shared/coding-errors.ts';
export {
  codingOk,
  codingFail,
  codingValidationFail,
  templateResult,
  llmResult,
}                                                    from './shared/coding-result.ts';

// ── Telemetry ─────────────────────────────────────────────────────────────────
export { codingContext }                             from './shared/coding-context.ts';

// ── Validation pipeline (for external use by verifier tools) ──────────────────
export { validateGeneratedCode }                     from './validation/generated-code-validator.ts';
export { validateAllSyntax }                         from './validation/syntax-validator.ts';
export { validateAllImports }                        from './validation/import-validator.ts';
export { validateAllSchemas }                        from './validation/schema-validator.ts';

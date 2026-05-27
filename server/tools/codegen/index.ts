/**
 * server/tools/codegen/index.ts
 *
 * Fix #14 — Coding category semantic rename.
 *
 * The `coding/` category was misnamed — its tools generate code strings in
 * memory, they do not execute side-effectful operations in a sandbox.
 * The correct name is `codegen/` (code generators, not execution tools).
 *
 * This barrel is the NEW canonical import path for all code-generation tools.
 * The old `coding/` path continues to work for backward compatibility.
 *
 * Migration path:
 *   OLD: import { registerCodingTools } from '../tools/coding/index.ts';
 *   NEW: import { registerCodingTools } from '../tools/codegen/index.ts';
 *
 * Note: ToolCategory type still includes 'coding' — that will be renamed in
 * a separate breaking-change migration after all consumers are updated.
 */

export {
  registerCodingTools,
  CODING_TOOL_COUNT,
  CODING_TOOL_NAMES,
} from '../coding/index.ts';

export type { GenerationResult, GenerationStrategy } from '../coding/shared/coding-types.ts';
export { CodingToolError }                           from '../coding/shared/coding-errors.ts';
export {
  codingOk,
  codingFail,
  codingValidationFail,
  templateResult,
  llmResult,
}                                                    from '../coding/shared/coding-result.ts';

export { validateGeneratedCode }   from '../coding/validation/generated-code-validator.ts';
export { validateAllSyntax }       from '../coding/validation/syntax-validator.ts';
export { validateAllImports }      from '../coding/validation/import-validator.ts';
export { validateAllSchemas }      from '../coding/validation/schema-validator.ts';

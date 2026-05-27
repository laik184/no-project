/**
 * server/tools/coding/backend/generate-module.ts
 * Tool: coding_generate_module
 *
 * Generates a TypeScript barrel module with re-exports.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ModuleInput }                          from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

function moduleTemplate(name: string, exports: string[]): string {
  if (exports.length === 0) {
    return `// ${toKebabCase(name)}/index.ts\n// Add exports here\nexport {};\n`;
  }
  return exports
    .map(e => `export { ${e} } from './${toKebabCase(e)}.ts';`)
    .join('\n') + '\n';
}

export const generateModuleTool = {
  name:        'coding_generate_module',
  category:    'coding',
  description: 'Generate a TypeScript barrel module (index.ts) with named re-exports. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Module/directory name',             required: true  },
    exports:  { type: 'array',  description: 'Symbol names to re-export',         required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',     required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ModuleInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);

    const exports  = Array.isArray(input.exports) ? input.exports : [];
    const code     = moduleTemplate(input.name, exports);
    const filename = `${toKebabCase(input.name)}/index.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated module barrel: ${filename} (${exports.length} export(s))`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;

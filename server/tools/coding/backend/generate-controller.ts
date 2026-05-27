/**
 * server/tools/coding/backend/generate-controller.ts
 * Tool: coding_generate_controller
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ControllerInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { expressControllerTemplate }                  from '../templates/express-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateControllerTool = {
  name:        'coding_generate_controller',
  category:    'coding',
  description: 'Generate an Express controller with in-memory CRUD handlers. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. user, post)',            required: true  },
    fields:   { type: 'array',  description: 'String field names for the resource shape',  required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ControllerInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);

    const fields   = Array.isArray(input.fields) ? input.fields : [];
    const code     = expressControllerTemplate(input.resource, fields);
    const filename = `controllers/${toKebabCase(input.resource)}-controller.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated controller: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;

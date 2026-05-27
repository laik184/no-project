/**
 * server/tools/coding/api/generate-rest-api.ts
 * Tool: coding_generate_rest_api
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { RestApiInput }                         from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { restApiRouterTemplate }                      from '../templates/api-template.ts';
import { toKebabCase, toPascalCase }                  from '../../../agents/coderx/utils/code-utils.ts';

export const generateRestApiTool = {
  name:        'coding_generate_rest_api',
  category:    'coding',
  description: 'Generate a full REST CRUD API router for a resource. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. user, post)',              required: true  },
    fields:   { type: 'array',  description: 'Field name strings (e.g. ["title","body"])',   required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: RestApiInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array of strings').message);
    }

    const apiFields  = input.fields.map(f => ({ name: String(f), type: 'string' }));
    const routerCode = restApiRouterTemplate(input.resource, apiFields);
    const routerFile = `routes/${toKebabCase(input.resource)}.ts`;
    const files      = { [routerFile]: routerCode };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated REST API for "${toPascalCase(input.resource)}" (${input.fields.length} fields)`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;

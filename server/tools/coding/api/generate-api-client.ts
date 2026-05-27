/**
 * server/tools/coding/api/generate-api-client.ts
 * Tool: coding_generate_api_client
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ApiClientInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { apiClientTemplate }                          from '../templates/api-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateApiClientTool = {
  name:        'coding_generate_api_client',
  category:    'coding',
  description: 'Generate a type-safe fetch-based API client for a resource. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. user, post)',      required: true  },
    baseUrl:  { type: 'string', description: 'API base URL prefix (default: /api)',  required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',         required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ApiClientInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);

    const baseUrl  = input.baseUrl?.trim() || '/api';
    const code     = apiClientTemplate(input.resource, baseUrl);
    const filename = `lib/api/${toKebabCase(input.resource)}-client.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated API client: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;

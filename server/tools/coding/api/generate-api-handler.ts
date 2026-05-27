/**
 * server/tools/coding/api/generate-api-handler.ts
 * Tool: coding_generate_api_handler
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ApiHandlerInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toCamelCase, toKebabCase }     from '../../../agents/coderx/utils/code-utils.ts';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

function handlerTemplate(resource: string, method: Method, fields: string[]): string {
  const Name      = toPascalCase(resource);
  const fn        = `handle${method.charAt(0) + method.slice(1).toLowerCase()}${Name}`;
  const createBody = fields.map(f => `    ${f}: req.body.${f} as string,`).join('\n');

  const bodies: Record<Method, string> = {
    GET:    `  res.json({ ok: true, data: [] });`,
    POST:   `  try {\n    const item = { id: crypto.randomUUID(),\n${createBody}\n    };\n    res.status(201).json({ ok: true, data: item });\n  } catch (err) { next(err); }`,
    PUT:    `  try {\n    res.json({ ok: true, data: { id: req.params.id, ...req.body } });\n  } catch (err) { next(err); }`,
    DELETE: `  res.json({ ok: true, message: '${Name} deleted' });`,
    PATCH:  `  try {\n    res.json({ ok: true, data: { id: req.params.id, ...req.body } });\n  } catch (err) { next(err); }`,
  };

  return `import { type Request, type Response, type NextFunction } from 'express';

export async function ${fn}(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
${bodies[method]}
}
`;
}

const VALID_METHODS = new Set<Method>(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export const generateApiHandlerTool = {
  name:        'coding_generate_api_handler',
  category:    'coding',
  description: 'Generate a single typed Express route handler function. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name',                           required: true  },
    method:   { type: 'string', description: 'HTTP method: GET|POST|PUT|DELETE|PATCH',  required: true  },
    fields:   { type: 'array',  description: 'Field names (used in POST/PUT body)',      required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',            required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ApiHandlerInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    const method = (String(input.method ?? '').toUpperCase()) as Method;
    if (!VALID_METHODS.has(method)) {
      return codingFail(invalidInputError('method', 'must be GET|POST|PUT|DELETE|PATCH').message);
    }

    const fields   = Array.isArray(input.fields) ? input.fields.map(String) : [];
    const code     = handlerTemplate(input.resource, method, fields);
    const filename = `handlers/${toKebabCase(input.resource)}-${method.toLowerCase()}.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated ${method} handler for "${toPascalCase(input.resource)}"`, report.warnings));
  },
} as unknown as ToolDefinition;

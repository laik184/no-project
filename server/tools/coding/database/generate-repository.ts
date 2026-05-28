/**
 * server/tools/coding/database/generate-repository.ts
 * Tool: coding_generate_repository
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { RepositoryInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toCamelCase, toKebabCase }     from '../../shared/string-utils.ts';

function repositoryTemplate(resource: string, fields: string[]): string {
  const Name    = toPascalCase(resource);
  const varName = toCamelCase(resource);
  const fieldDecl  = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `      ${f}: dto.${f},`).join('\n');
  const updateBody = fields.map(f => `    if (dto.${f} !== undefined) item.${f} = dto.${f};`).join('\n');
  return `interface ${Name} {
  id: string;
${fieldDecl}
}

interface Create${Name}Dto {
${fieldDecl}
}

interface Update${Name}Dto {
${fields.map(f => `  ${f}?: string;`).join('\n')}
}

const store = new Map<string, ${Name}>();

export const ${varName}Repository = {
  findAll(): ${Name}[] {
    return [...store.values()];
  },
  findById(id: string): ${Name} | undefined {
    return store.get(id);
  },
  findBy(predicate: (item: ${Name}) => boolean): ${Name}[] {
    return [...store.values()].filter(predicate);
  },
  create(dto: Create${Name}Dto): ${Name} {
    const item: ${Name} = { id: crypto.randomUUID(),
${createBody}
    };
    store.set(item.id, item);
    return item;
  },
  update(id: string, dto: Update${Name}Dto): ${Name} | undefined {
    const item = store.get(id);
    if (!item) return undefined;
${updateBody}
    return item;
  },
  delete(id: string): boolean {
    return store.delete(id);
  },
  count(): number {
    return store.size;
  },
};
`;
}

export const generateRepositoryTool = defineCodingTool({
  name:        'coding_generate_repository',
  category:    'coding',
  description: 'Generate a typed in-memory repository with CRUD operations. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. user)',           required: true  },
    fields:   { type: 'array',  description: 'Field name strings',                  required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',        required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: RepositoryInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);

    const fields   = Array.isArray(input.fields) ? input.fields.map(String) : ['name'];
    const code     = repositoryTemplate(input.resource, fields);
    const filename = `repositories/${toKebabCase(input.resource)}-repository.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated repository: ${filename}`, report.warnings));
  },
});

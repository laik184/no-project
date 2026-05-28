/**
 * server/tools/coding/frontend/generate-component-tree.ts
 * Tool: coding_generate_component_tree
 *
 * Generates a barrel re-export file for a component tree,
 * plus a stub for any missing child components.
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { ComponentTreeInput }                   from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toKebabCase, toPascalCase }                  from '../../shared/string-utils.ts';

function componentStub(name: string): string {
  const Name = toPascalCase(name);
  return `import type { FC, ReactNode } from 'react';

interface ${Name}Props {
  children?: ReactNode;
}

export const ${Name}: FC<${Name}Props> = ({ children }) => (
  <div className="${toKebabCase(name)}">{children}</div>
);

export default ${Name};
`;
}

function barrelTemplate(root: string, children: string[]): string {
  const rootLine = `export { default as ${toPascalCase(root)} } from './${toKebabCase(root)}.tsx';`;
  const childLines = children.map(
    c => `export { default as ${toPascalCase(c)} } from './${toKebabCase(c)}.tsx';`,
  );
  return [rootLine, ...childLines].join('\n') + '\n';
}

export const generateComponentTreeTool = defineCodingTool({
  name:        'coding_generate_component_tree',
  category:    'coding',
  description: 'Generate a component tree: root component + child stubs + barrel index. Returns file map — does not write to disk.',
  inputSchema: {
    root:     { type: 'string', description: 'Root component name',              required: true  },
    children: { type: 'array',  description: 'Child component names',            required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',    required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ComponentTreeInput, ctx: ToolExecutionContext) => {
    if (!input.root?.trim()) {
      return codingFail(invalidInputError('root', 'must be a non-empty string').message);
    }

    const children = Array.isArray(input.children) ? input.children : [];
    const files: Record<string, string> = {};
    const dir = `src/components/${toKebabCase(input.root)}`;

    files[`${dir}/${toKebabCase(input.root)}.tsx`] = componentStub(input.root);
    for (const child of children) {
      files[`${dir}/${toKebabCase(child)}.tsx`] = componentStub(child);
    }
    files[`${dir}/index.ts`] = barrelTemplate(input.root, children);

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated component tree for "${input.root}" with ${children.length} child(ren)`,
      report.warnings,
    ));
  },
});

/**
 * server/tools/coding/components/generate-form.ts
 * Tool: coding_generate_form
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { FormInput }                            from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toKebabCase }                  from '../../../agents/coderx/utils.ts';

function formTemplate(
  name:   string,
  fields: Array<{ name: string; type: string; label?: string; required?: boolean }>,
): string {
  const Name = toPascalCase(name);
  const stateDecl = fields.map(f => `  ${f.name}: string;`).join('\n');
  const stateInit = fields.map(f => `    ${f.name}: '',`).join('\n');
  const inputEls  = fields.map(f => {
    const inputType = f.type === 'email' ? 'email' : f.type === 'password' ? 'password' : 'text';
    const label     = f.label ?? toPascalCase(f.name);
    const required  = f.required !== false ? ' required' : '';
    return `        <div>\n          <label className="block text-sm font-medium mb-1">${label}</label>\n          <input\n            type="${inputType}"\n            name="${f.name}"\n            value={values.${f.name}}\n            onChange={e => setValues(v => ({ ...v, ${f.name}: e.target.value }))}\n            className="input w-full"${required}\n          />\n        </div>`;
  }).join('\n');

  return `import { useState, type FC, type FormEvent } from 'react';

interface ${Name}FormValues {
${stateDecl}
}

interface ${Name}FormProps {
  onSubmit: (values: ${Name}FormValues) => void | Promise<void>;
  loading?: boolean;
}

export const ${Name}Form: FC<${Name}FormProps> = ({ onSubmit, loading = false }) => {
  const [values, setValues] = useState<${Name}FormValues>({
${stateInit}
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
${inputEls}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
};

export default ${Name}Form;
`;
}

export const generateFormTool = {
  name:        'coding_generate_form',
  category:    'coding',
  description: 'Generate a controlled React form component. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Form component name (e.g. CreateUser)',             required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type, label?, required? } specs', required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                     required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: FormInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const fields   = input.fields.map(f => ({
      name:     String(f.name),
      type:     String(f.type ?? 'text'),
      label:    f.label ? String(f.label) : undefined,
      required: f.required !== false,
    }));
    const code     = formTemplate(input.name, fields);
    const filename = `src/components/${toKebabCase(input.name)}-form.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated form component: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;

/**
 * server/tools/coding/components/generate-modal.ts
 * Tool: coding_generate_modal
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ModalInput }                           from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toKebabCase }                  from '../../../agents/coderx/utils.ts';

function modalTemplate(name: string, content?: string): string {
  const Name = toPascalCase(name);
  const body = content ?? `        <p className="text-gray-600 dark:text-gray-300">Modal content goes here.</p>`;
  return `import { useEffect, type FC, type ReactNode } from 'react';

interface ${Name}ModalProps {
  open:      boolean;
  onClose:   () => void;
  title?:    string;
  children?: ReactNode;
}

export const ${Name}Modal: FC<${Name}ModalProps> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
          {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {children ?? (
${body}
          )}
        </div>
      </div>
    </div>
  );
};

export default ${Name}Modal;
`;
}

export const generateModalTool = {
  name:        'coding_generate_modal',
  category:    'coding',
  description: 'Generate an accessible React modal component. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Modal component name',                   required: true  },
    content:  { type: 'string', description: 'Default modal body JSX content string',  required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',          required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ModalInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);

    const code     = modalTemplate(input.name, input.content);
    const filename = `src/components/${toKebabCase(input.name)}-modal.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated modal component: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;

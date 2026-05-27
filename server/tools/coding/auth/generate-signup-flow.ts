/**
 * server/tools/coding/auth/generate-signup-flow.ts
 * Tool: coding_generate_signup_flow
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { SignupFlowInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase }                               from '../../../agents/coderx/utils/code-utils.ts';

function signupFlowTemplate(fields: string[]): string {
  const allFields  = Array.from(new Set(['email', 'password', ...fields]));
  const stateDecl  = allFields.map(f => `  ${f}: string;`).join('\n');
  const stateInit  = allFields.map(f => `    ${f}: '',`).join('\n');
  const inputEls   = allFields.map(f => {
    const type = f === 'password' ? 'password' : f === 'email' ? 'email' : 'text';
    const label = toPascalCase(f);
    return `        <input\n          type="${type}"\n          placeholder="${label}"\n          value={state.${f}}\n          onChange={e => setState(s => ({ ...s, ${f}: e.target.value }))}\n          required\n          className="input w-full"\n        />`;
  }).join('\n');
  const bodyFields = allFields.map(f => `${f}: state.${f}`).join(', ');

  return `import { useState, type FC, type FormEvent } from 'react';

interface SignupState {
${stateDecl}
  error:   string | null;
  loading: boolean;
}

const SignupPage: FC = () => {
  const [state, setState] = useState<SignupState>({
${stateInit}
    error: null, loading: false,
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ${bodyFields} }),
      });
      const body = await res.json() as { ok: boolean; token?: string; error?: string };
      if (!body.ok) { setState(s => ({ ...s, error: body.error ?? 'Registration failed', loading: false })); return; }
      if (body.token) localStorage.setItem('token', body.token);
      window.location.href = '/dashboard';
    } catch {
      setState(s => ({ ...s, error: 'Network error', loading: false }));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-8 shadow dark:bg-gray-800"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
${inputEls}
        <button type="submit" disabled={state.loading} className="btn-primary w-full">
          {state.loading ? 'Creating…' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

export default SignupPage;
`;
}

export const generateSignupFlowTool = {
  name:        'coding_generate_signup_flow',
  category:    'coding',
  description: 'Generate a React signup page with form state and API call. Returns file map — does not write to disk.',
  inputSchema: {
    userFields: { type: 'array',  description: 'Extra user field names beyond email/password', required: false },
    strategy:   { type: 'string', description: '"template" (default) | "llm"',                 required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: SignupFlowInput, ctx: ToolExecutionContext) => {
    const fields = Array.isArray(input.userFields) ? input.userFields.map(String) : [];
    const files  = { 'src/pages/signup.tsx': signupFlowTemplate(fields) };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, 'Generated signup page: src/pages/signup.tsx', report.warnings));
  },
} as unknown as ToolDefinition;

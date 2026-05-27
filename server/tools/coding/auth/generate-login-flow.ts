/**
 * server/tools/coding/auth/generate-login-flow.ts
 * Tool: coding_generate_login_flow
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { LoginFlowInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

function loginFlowTemplate(fields: string[]): string {
  const extraFields = fields.filter(f => f !== 'email' && f !== 'password');
  return `import { useState, type FC, type FormEvent } from 'react';

interface LoginFormState {
  email:    string;
  password: string;
  error:    string | null;
  loading:  boolean;
}

const LoginPage: FC = () => {
  const [state, setState] = useState<LoginFormState>({
    email: '', password: '', error: null, loading: false,
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: state.email, password: state.password }),
      });
      const body = await res.json() as { ok: boolean; token?: string; error?: string };
      if (!body.ok) { setState(s => ({ ...s, error: body.error ?? 'Login failed', loading: false })); return; }
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign In</h1>
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <input
          type="email"
          placeholder="Email"
          value={state.email}
          onChange={e => setState(s => ({ ...s, email: e.target.value }))}
          required
          className="input w-full"
        />
        <input
          type="password"
          placeholder="Password"
          value={state.password}
          onChange={e => setState(s => ({ ...s, password: e.target.value }))}
          required
          className="input w-full"
        />
        <button type="submit" disabled={state.loading} className="btn-primary w-full">
          {state.loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
`;
}

export const generateLoginFlowTool = {
  name:        'coding_generate_login_flow',
  category:    'coding',
  description: 'Generate a React login page with form state and API call. Returns file map — does not write to disk.',
  inputSchema: {
    userFields: { type: 'array',  description: 'User field names (not used in UI, reserved)',  required: false },
    strategy:   { type: 'string', description: '"template" (default) | "llm"',                 required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: LoginFlowInput, ctx: ToolExecutionContext) => {
    const fields = Array.isArray(input.userFields) ? input.userFields.map(String) : ['email', 'password'];
    const files  = { 'src/pages/login.tsx': loginFlowTemplate(fields) };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, 'Generated login page: src/pages/login.tsx', report.warnings));
  },
} as unknown as ToolDefinition;

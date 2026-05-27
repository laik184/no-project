import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import type { VerificationInput } from './verifier-types.ts';

export interface VerifierToolContext extends ToolExecutionContext {
  readonly phase?:    string;
  readonly port?:     number;
  readonly timeoutMs: number;
}

export function buildVerifierContext(
  runId:     string,
  projectId: string,
  overrides: Partial<VerifierToolContext> = {},
): VerifierToolContext {
  return {
    runId,
    projectId,
    sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
    meta:        {},
    timeoutMs:   30_000,
    ...overrides,
  };
}

export function inputToContext(input: VerificationInput): VerifierToolContext {
  return buildVerifierContext(input.runId, String(input.projectId), {
    port:     input.port,
    timeoutMs: input.timeoutMs ?? 30_000,
  });
}

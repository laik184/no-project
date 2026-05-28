/**
 * server/agents/filesystem/operations/read-operation.ts
 *
 * Orchestrates read workflows.
 * ONLY coordinates — all execution goes through dispatcher-client → central dispatcher.
 */

import type {
  ReadOperationRequest,
  ReadOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { execute }          from '../coordination/dispatcher-client.ts';
import { coordinateRead }   from '../coordination/tool-coordinator.ts';
import { assertPath }       from '../validation/path-validator.ts';
import { toToolContext }    from '../core/filesystem-context.ts';
import { toErrorMessage }   from '../utils/filesystem-utils.ts';

// ── Internal: parse dispatcher output ────────────────────────────────────────

interface RawReadOutput {
  content?:    string;
  lineCount?:  number;
  sizeBytes?:  number;
}

function parseReadOutput(data: unknown, path: string): ReadOperationResult {
  const raw = (data ?? {}) as RawReadOutput;
  return {
    kind:      'read',
    path,
    content:   typeof raw.content === 'string' ? raw.content : '',
    lineCount: typeof raw.lineCount === 'number' ? raw.lineCount : undefined,
    sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : undefined,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Orchestrate a read operation.
 * Validates the path, coordinates the correct tool, dispatches through the
 * central gateway, and shapes the result — no direct filesystem access.
 */
export async function orchestrateRead(
  request: ReadOperationRequest,
  context: FilesystemExecutionContext,
): Promise<ReadOperationResult> {
  assertPath(request.path, context.sandboxRoot);

  const { toolName, toolInput } = coordinateRead(request, context.sandboxRoot);
  const toolCtx                 = toToolContext(context);

  const result = await execute<RawReadOutput>(toolName, toolInput, toolCtx);

  if (!result.ok) {
    throw new Error(
      `[read-operation] Tool "${toolName}" failed for path "${request.path}": ${result.error}`,
    );
  }

  return parseReadOutput(result.data, request.path);
}

/**
 * Safe variant — returns a result envelope instead of throwing.
 */
export async function safeOrchestrateRead(
  request: ReadOperationRequest,
  context: FilesystemExecutionContext,
): Promise<{ ok: true; result: ReadOperationResult } | { ok: false; error: string }> {
  try {
    const result = await orchestrateRead(request, context);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

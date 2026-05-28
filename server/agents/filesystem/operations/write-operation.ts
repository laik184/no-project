/**
 * server/agents/filesystem/operations/write-operation.ts
 *
 * Orchestrates write workflows.
 * ONLY coordinates — all execution goes through dispatcher-client → central dispatcher.
 */

import type {
  WriteOperationRequest,
  WriteOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { execute }          from '../coordination/dispatcher-client.ts';
import { coordinateWrite }  from '../coordination/tool-coordinator.ts';
import { assertPath }       from '../validation/path-validator.ts';
import { toToolContext }    from '../core/filesystem-context.ts';
import { toErrorMessage }   from '../utils/filesystem-utils.ts';

// ── Internal: parse dispatcher output ────────────────────────────────────────

interface RawWriteOutput {
  written?: boolean;
  path?:    string;
}

function parseWriteOutput(data: unknown, path: string): WriteOperationResult {
  const raw = (data ?? {}) as RawWriteOutput;
  return {
    kind:    'write',
    path,
    written: typeof raw.written === 'boolean' ? raw.written : true,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Orchestrate a write operation (create, overwrite, append, or write-if-absent).
 * Validates the path, selects the correct tool, dispatches through the gateway.
 */
export async function orchestrateWrite(
  request: WriteOperationRequest,
  context: FilesystemExecutionContext,
): Promise<WriteOperationResult> {
  assertPath(request.path, context.sandboxRoot);

  const { toolName, toolInput } = coordinateWrite(request, context.sandboxRoot);
  const toolCtx                 = toToolContext(context);

  const result = await execute<RawWriteOutput>(toolName, toolInput, toolCtx);

  if (!result.ok) {
    throw new Error(
      `[write-operation] Tool "${toolName}" failed for path "${request.path}": ${result.error}`,
    );
  }

  return parseWriteOutput(result.data, request.path);
}

/**
 * Safe variant — returns a result envelope instead of throwing.
 */
export async function safeOrchestrateWrite(
  request: WriteOperationRequest,
  context: FilesystemExecutionContext,
): Promise<{ ok: true; result: WriteOperationResult } | { ok: false; error: string }> {
  try {
    const result = await orchestrateWrite(request, context);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

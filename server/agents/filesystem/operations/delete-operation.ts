/**
 * server/agents/filesystem/operations/delete-operation.ts
 *
 * Orchestrates delete workflows.
 * ONLY coordinates — all execution goes through dispatcher-client → central dispatcher.
 */

import type {
  DeleteOperationRequest,
  DeleteOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { execute }           from '../coordination/dispatcher-client.ts';
import { coordinateDelete }  from '../coordination/tool-coordinator.ts';
import { assertPath, validatePaths } from '../validation/path-validator.ts';
import { toToolContext }     from '../core/filesystem-context.ts';
import { toErrorMessage }    from '../utils/filesystem-utils.ts';

// ── Internal: parse dispatcher output ────────────────────────────────────────

interface RawDeleteOutput {
  deleted?: boolean;
}

function parseDeleteOutput(data: unknown, path: string): DeleteOperationResult {
  const raw = (data ?? {}) as RawDeleteOutput;
  return {
    kind:    'delete',
    path,
    deleted: typeof raw.deleted === 'boolean' ? raw.deleted : true,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Orchestrate a delete operation (single file, folder, or multiple paths).
 * Validates all paths before dispatch — rejects if any path is unsafe.
 */
export async function orchestrateDelete(
  request: DeleteOperationRequest,
  context: FilesystemExecutionContext,
): Promise<DeleteOperationResult> {
  // Validate all target paths before any dispatch
  if (request.multiple && request.multiple.length > 0) {
    const results = validatePaths(request.multiple, context.sandboxRoot);
    const invalid = results.filter((r) => !r.ok);
    if (invalid.length > 0) {
      throw new Error(
        `[delete-operation] Invalid paths: ${invalid.map((r) => `${r.path} (${r.reason})`).join(', ')}`,
      );
    }
  } else {
    assertPath(request.path, context.sandboxRoot);
  }

  const { toolName, toolInput } = coordinateDelete(request, context.sandboxRoot);
  const toolCtx                 = toToolContext(context);

  const result = await execute<RawDeleteOutput>(toolName, toolInput, toolCtx);

  if (!result.ok) {
    throw new Error(
      `[delete-operation] Tool "${toolName}" failed for path "${request.path}": ${result.error}`,
    );
  }

  return parseDeleteOutput(result.data, request.path);
}

/**
 * Safe variant — returns a result envelope instead of throwing.
 */
export async function safeOrchestrateDelete(
  request: DeleteOperationRequest,
  context: FilesystemExecutionContext,
): Promise<{ ok: true; result: DeleteOperationResult } | { ok: false; error: string }> {
  try {
    const result = await orchestrateDelete(request, context);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

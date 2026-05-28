/**
 * server/agents/filesystem/operations/patch-operation.ts
 *
 * Orchestrates patch/edit workflows.
 * ONLY coordinates — all execution goes through dispatcher-client → central dispatcher.
 */

import type {
  PatchOperationRequest,
  PatchOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { execute }          from '../coordination/dispatcher-client.ts';
import { coordinatePatch }  from '../coordination/tool-coordinator.ts';
import { assertPath }       from '../validation/path-validator.ts';
import { toToolContext }    from '../core/filesystem-context.ts';
import { toErrorMessage }   from '../utils/filesystem-utils.ts';

// ── Internal: parse dispatcher output ────────────────────────────────────────

interface RawPatchOutput {
  hunksApplied?: number;
  applied?:      number;
}

function parsePatchOutput(data: unknown, path: string, hunkCount: number): PatchOperationResult {
  const raw = (data ?? {}) as RawPatchOutput;
  const hunksApplied =
    typeof raw.hunksApplied === 'number' ? raw.hunksApplied :
    typeof raw.applied      === 'number' ? raw.applied      :
    hunkCount;

  return { kind: 'patch', path, hunksApplied };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Orchestrate a patch/edit operation.
 * Validates the path, selects patch_file or patch_all based on request flags,
 * dispatches through the central gateway.
 */
export async function orchestratePatch(
  request: PatchOperationRequest,
  context: FilesystemExecutionContext,
): Promise<PatchOperationResult> {
  assertPath(request.path, context.sandboxRoot);

  const { toolName, toolInput } = coordinatePatch(request, context.sandboxRoot);
  const toolCtx                 = toToolContext(context);

  const result = await execute<RawPatchOutput>(toolName, toolInput, toolCtx);

  if (!result.ok) {
    throw new Error(
      `[patch-operation] Tool "${toolName}" failed for path "${request.path}": ${result.error}`,
    );
  }

  return parsePatchOutput(result.data, request.path, request.hunks.length);
}

/**
 * Safe variant — returns a result envelope instead of throwing.
 */
export async function safeOrchestratePatch(
  request: PatchOperationRequest,
  context: FilesystemExecutionContext,
): Promise<{ ok: true; result: PatchOperationResult } | { ok: false; error: string }> {
  try {
    const result = await orchestratePatch(request, context);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

/**
 * server/agents/filesystem/coordination/filesystem-routing.ts
 *
 * Routes operation requests to the correct operation handler.
 * Pure control-flow routing — no execution logic.
 */

import type {
  FilesystemOperationRequest,
  FilesystemOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';

import { orchestrateRead }   from '../operations/read-operation.ts';
import { orchestrateWrite }  from '../operations/write-operation.ts';
import { orchestratePatch }  from '../operations/patch-operation.ts';
import { orchestrateDelete } from '../operations/delete-operation.ts';
import { orchestrateSearch } from '../operations/search-operation.ts';

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Route a FilesystemOperationRequest to the correct operation orchestrator.
 * The orchestrators handle all coordination with the tool layer via dispatcher-client.
 */
export async function routeOperation(
  request: FilesystemOperationRequest,
  context: FilesystemExecutionContext,
): Promise<FilesystemOperationResult> {
  switch (request.kind) {
    case 'read':
      return orchestrateRead(request, context);

    case 'write':
      return orchestrateWrite(request, context);

    case 'patch':
      return orchestratePatch(request, context);

    case 'delete':
      return orchestrateDelete(request, context);

    case 'search':
      return orchestrateSearch(request, context);

    default: {
      const _exhaustive: never = request;
      throw new Error(
        `[filesystem-routing] Unknown operation kind: ${(_exhaustive as FilesystemOperationRequest).kind}`,
      );
    }
  }
}

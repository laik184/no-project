/**
 * server/agents/filesystem/operations/search-operation.ts
 *
 * Orchestrates search workflows.
 * ONLY coordinates — all execution goes through dispatcher-client → central dispatcher.
 */

import type {
  SearchOperationRequest,
  SearchOperationResult,
  SearchMatch,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { execute }           from '../coordination/dispatcher-client.ts';
import { coordinateSearch }  from '../coordination/tool-coordinator.ts';
import { toToolContext }     from '../core/filesystem-context.ts';
import { toErrorMessage }    from '../utils/filesystem-utils.ts';

// ── Internal: parse dispatcher output ────────────────────────────────────────

interface RawMatch {
  path?:    string;
  file?:    string;
  line?:    number;
  snippet?: string;
  text?:    string;
}

interface RawSearchOutput {
  matches?: RawMatch[];
  results?: RawMatch[];
  files?:   string[];
  total?:   number;
  count?:   number;
}

function parseSearchOutput(data: unknown, query: string): SearchOperationResult {
  const raw = (data ?? {}) as RawSearchOutput;

  let matches: SearchMatch[] = [];

  if (Array.isArray(raw.matches)) {
    matches = raw.matches.map((m) => ({
      path:    m.path ?? m.file ?? '',
      line:    m.line,
      snippet: m.snippet ?? m.text,
    }));
  } else if (Array.isArray(raw.results)) {
    matches = raw.results.map((m) => ({
      path:    m.path ?? m.file ?? '',
      line:    m.line,
      snippet: m.snippet ?? m.text,
    }));
  } else if (Array.isArray(raw.files)) {
    matches = raw.files.map((f) => ({ path: f }));
  }

  const total =
    typeof raw.total === 'number' ? raw.total :
    typeof raw.count === 'number' ? raw.count  :
    matches.length;

  return { kind: 'search', query, matches, total };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Orchestrate a search operation.
 * Selects the correct search tool (by_name, by_extension, text, regex, etc.),
 * dispatches through the central gateway, and normalises the result shape.
 */
export async function orchestrateSearch(
  request: SearchOperationRequest,
  context: FilesystemExecutionContext,
): Promise<SearchOperationResult> {
  const { toolName, toolInput } = coordinateSearch(request, context.sandboxRoot);
  const toolCtx                 = toToolContext(context);

  const result = await execute<RawSearchOutput>(toolName, toolInput, toolCtx);

  if (!result.ok) {
    throw new Error(
      `[search-operation] Tool "${toolName}" failed for query "${request.query}": ${result.error}`,
    );
  }

  return parseSearchOutput(result.data, request.query);
}

/**
 * Safe variant — returns a result envelope instead of throwing.
 */
export async function safeOrchestrateSearch(
  request: SearchOperationRequest,
  context: FilesystemExecutionContext,
): Promise<{ ok: true; result: SearchOperationResult } | { ok: false; error: string }> {
  try {
    const result = await orchestrateSearch(request, context);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

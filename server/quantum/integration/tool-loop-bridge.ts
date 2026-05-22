/**
 * server/quantum/integration/tool-loop-bridge.ts
 *
 * Routes parallel tool calls from the tool-loop agent through the
 * centralWorkerPool, enforcing:
 *   • Read-only tools → parallel (executionMode: "parallel")
 *   • Write/mutating tools → serialised (executionMode: "serial")
 *   • Memory writes → exclusive (executionMode: "exclusive")
 *
 * Integration flow
 * ────────────────
 *   tool-loop agent
 *   → ToolLoopBridge.executeToolBatch(tools, ctx)
 *   → CentralWorkerPool.submit() per tool (with correct mode)
 *   → BatchResult
 *
 * Usage
 * ─────
 *   import { toolLoopBridge } from "./integration/tool-loop-bridge.ts";
 *   const result = await toolLoopBridge.executeToolBatch(toolCalls, ctx);
 */

import { centralWorkerPool }  from "../scheduler/worker-pool.ts";
import { ExecutionBatch }     from "../execution/execution-batch.ts";
import { TaskPriority }       from "../scheduler/worker-types.ts";
import type { PoolTask, TaskExecutionMode } from "../scheduler/worker-types.ts";
import type { BatchResult }   from "../execution/execution-batch.ts";
import { bus }                from "../../infrastructure/events/bus.ts";

// ── Tool descriptor ───────────────────────────────────────────────────────────

export interface ToolCallDescriptor<T = unknown> {
  id:          string;
  toolName:    string;
  isMutating:  boolean;    // true → serialize this call
  isMemoryOp:  boolean;    // true → serialize AND exclusive
  priority?:   TaskPriority;
  timeoutMs?:  number;
  fn:          () => Promise<T>;
  signal?:     AbortSignal;
}

export interface ToolBatchContext {
  runId:    string;
  agentId?: string;
}

// ── Read-only tool names (extend as needed) ───────────────────────────────────

const READ_ONLY_TOOLS = new Set([
  "read_file", "list_files", "search_files", "grep_search",
  "get_file_info", "list_dir", "view_file", "get_diagnostics",
  "web_search", "fetch_url",
]);

function inferMutating(toolName: string): boolean {
  return !READ_ONLY_TOOLS.has(toolName);
}

function resolveMode(tool: ToolCallDescriptor): TaskExecutionMode {
  if (tool.isMemoryOp) return "exclusive";
  if (tool.isMutating) return "serial";
  return "parallel";
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class ToolLoopBridge {
  /**
   * Execute a batch of tool calls through the centralWorkerPool.
   * Serial/exclusive tools are submitted individually and awaited in order.
   * Parallel (read-only) tools are submitted concurrently.
   */
  async executeToolBatch<T>(
    tools: ToolCallDescriptor<T>[],
    ctx:   ToolBatchContext,
  ): Promise<BatchResult<T>> {
    const batchId = `tools-${ctx.runId}-${Date.now()}`;
    const t0      = Date.now();

    bus.emit("agent.event", {
      runId:     ctx.runId,
      eventType: "tool.bridge.batch.started" as any,
      phase:     "tool-loop-bridge",
      ts:        t0,
      payload:   { batchId, toolCount: tools.length },
    });

    const batch = new ExecutionBatch<T>(batchId);

    // Split into read-only (parallel) and mutating (serial) groups
    const parallel  = tools.filter(t => resolveMode(t) === "parallel");
    const serial    = tools.filter(t => resolveMode(t) !== "parallel");

    // Submit all read-only tools concurrently
    for (const tool of parallel) {
      const task = this._buildTask<T>(tool, ctx.runId, "parallel");
      batch.add({ taskId: tool.id, runId: ctx.runId, promise: centralWorkerPool.submit<T>(task) });
    }

    // Submit mutating tools one at a time (await each before next)
    for (const tool of serial) {
      const task   = this._buildTask<T>(tool, ctx.runId, resolveMode(tool));
      const result = centralWorkerPool.submit<T>(task);
      batch.add({ taskId: tool.id, runId: ctx.runId, promise: result });
      await result;  // serialize mutations
    }

    const result = await batch.collect();

    bus.emit("agent.event", {
      runId:     ctx.runId,
      eventType: "tool.bridge.batch.completed" as any,
      phase:     "tool-loop-bridge",
      ts:        Date.now(),
      payload:   { batchId, succeeded: result.succeeded.length, failed: result.failed.length, durationMs: Date.now() - t0 },
    });

    return result;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _buildTask<T>(
    tool:  ToolCallDescriptor<T>,
    runId: string,
    mode:  TaskExecutionMode,
  ): PoolTask<T> {
    return {
      id:            tool.id,
      runId,
      priority:      tool.priority   ?? TaskPriority.NORMAL,
      timeoutMs:     tool.timeoutMs  ?? 30_000,
      maxRetries:    0,
      taskType:      "tool-call",
      executionMode: mode,
      fn:            tool.fn,
      signal:        tool.signal,
      metadata:      { toolName: tool.toolName, isMutating: tool.isMutating },
    };
  }
}

export const toolLoopBridge = new ToolLoopBridge();

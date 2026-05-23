/**
 * node-executor.ts  (memory-safe — ≤250 lines)
 *
 * Dispatches DAG nodes to tool / agent / verify / checkpoint / decision subsystems.
 *
 * MEMORY SAFETY UPGRADE:
 *   File writes produced by tool nodes are routed through nodeWriteDispatcher
 *   → transactionalMemoryWriter → deterministicWriteCoordinator.
 *   No direct fs writes are permitted from this module.
 *
 * PREVIOUS FIX (retained):
 *   dispatchAgent() no longer fire-and-forgets. Agent nodes register a promise
 *   via agentPromiseRegistry and await actual completion before returning.
 */

import { bus }                   from "../../infrastructure/events/bus.ts";
import { dagCheckpointStore }    from "../checkpoints/dag-checkpoint-store.ts";
import { createCheckpoint }      from "../graph/graph-state.ts";
import { agentPromiseRegistry }  from "./agent-promise-registry.ts";
import { nodeWriteDispatcher }   from "./node-write-dispatcher.ts";
import {
  emitNodeStarted,
  emitNodeCompleted,
  emitNodeFailed,
  emitNodeRetry,
} from "../dag/dag-telemetry.ts";
import type { ExecutionGraph, ExecutionNode } from "../graph/graph-types.ts";
import type { NodeExecutor }                  from "../graph/parallel-runner.ts";

export interface NodeExecutorContext {
  runId:     string;
  projectId: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a NodeExecutor closure bound to a runId + projectId.
 * Called by runGraph() for each ready node.
 */
export function createNodeExecutor(ctx: NodeExecutorContext): NodeExecutor {
  const telCtx = { runId: ctx.runId, projectId: ctx.projectId, graphId: ctx.runId };

  return async (node: ExecutionNode, graph: ExecutionGraph): Promise<unknown> => {
    const t0 = Date.now();
    emitNodeStarted(telCtx, node);

    try {
      const result     = await dispatchNode(node, ctx);
      const durationMs = Date.now() - t0;
      emitNodeCompleted(telCtx, node, durationMs);

      if (node.isCheckpoint) {
        const cp = createCheckpoint(graph, node.id);
        dagCheckpointStore.save(ctx.runId, ctx.projectId, cp);
      }

      return result;

    } catch (err) {
      const durationMs = Date.now() - t0;
      const error      = err instanceof Error ? err.message : String(err);

      if (node.retryCount < node.maxRetries) {
        emitNodeRetry(telCtx, node, node.retryCount + 1);
      } else {
        emitNodeFailed(telCtx, node, error);
      }

      throw err;
    }
  };
}

// ── Per-type dispatch ─────────────────────────────────────────────────────────

async function dispatchNode(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  switch (node.type) {
    case "tool":       return dispatchTool(node, ctx);
    case "agent":      return dispatchAgent(node, ctx);
    case "verify":     return dispatchVerify(node, ctx);
    case "checkpoint": return dispatchCheckpointNode(node, ctx);
    case "decision":   return dispatchDecision(node, ctx);
    default:           return dispatchAgent(node, ctx);
  }
}

// ── Tool dispatch — memory-safe ───────────────────────────────────────────────

async function dispatchTool(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const toolName = node.toolName;
  if (!toolName) throw new Error(`Node "${node.id}" type=tool missing toolName`);

  const { unifiedRegistry } = await import("../../tools/registry/tool-registry.ts");
  const entry = unifiedRegistry.getEntry(toolName);
  if (!entry) throw new Error(`Tool "${toolName}" not found in registry`);

  const { executeTool }  = await import("../../tools/core/execute-tool.ts");
  const { createContext } = await import("../../tools/core/tool-context.ts");

  // createContext(projectId, runId, signal?)
  const toolCtx = createContext(ctx.projectId, ctx.runId);

  // executeTool(entry: RegisteredTool, args, ctx, opts?)
  const result = await executeTool(entry, node.args as Record<string, unknown>, toolCtx);

  if (!result.ok) throw new Error(result.error ?? `Tool "${toolName}" failed`);

  // Route any file writes declared in result metadata through the safe write queue.
  // Tool handlers that produce file writes should attach them as result.result.fileWrites[].
  const fileWrites = (result.result as any)?.fileWrites;
  if (Array.isArray(fileWrites) && fileWrites.length > 0) {
    await nodeWriteDispatcher.dispatchBatch(
      fileWrites,
      { runId: ctx.runId, projectId: ctx.projectId, nodeId: node.id, toolName },
    );
  }

  return result.result;
}

// ── Agent dispatch ────────────────────────────────────────────────────────────

/** Build the canonical registry key — mirrors AgentPromiseRegistry.key() static. */
function registryKey(runId: string, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

async function dispatchAgent(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key            = registryKey(ctx.runId, node.id);
  const agentTimeoutMs = (node.args as any)?.agentTimeoutMs as number | undefined;
  const resultPromise  = agentPromiseRegistry.register(key, agentTimeoutMs);

  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.agent",
    agentName: node.agentRole ?? "builder",
    eventType: "dag.agent.execute",
    payload:   {
      nodeId:     node.id,
      label:      node.label,
      goal:       (node.args as any)?.goal ?? node.label,
      tools:      (node.args as any)?.tools,
      promiseKey: key,
    },
    ts: Date.now(),
  });

  return resultPromise;
}

// ── Verify dispatch ───────────────────────────────────────────────────────────

async function dispatchVerify(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key           = registryKey(ctx.runId, node.id);
  const resultPromise = agentPromiseRegistry.register(key);

  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.verify",
    agentName: "verification",
    eventType: "dag.verify.execute",
    payload:   { nodeId: node.id, args: node.args, promiseKey: key },
    ts:        Date.now(),
  });

  return resultPromise;
}

// ── Checkpoint node dispatch ──────────────────────────────────────────────────

async function dispatchCheckpointNode(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.checkpoint",
    agentName: "dag-executor",
    eventType: "dag.checkpoint.saved",
    payload:   { nodeId: node.id, label: node.label },
    ts:        Date.now(),
  });
  return { checkpointed: true, nodeId: node.id };
}

// ── Decision node dispatch ────────────────────────────────────────────────────

async function dispatchDecision(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag.decision",
    agentName: "dag-executor",
    eventType: "dag.decision.reached",
    payload:   { nodeId: node.id, label: node.label, args: node.args },
    ts:        Date.now(),
  });
  return { decision: node.label, nodeId: node.id };
}

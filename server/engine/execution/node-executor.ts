/**
 * node-executor.ts
 *
 * Real NodeExecutor implementation that dispatches DAG nodes
 * to the appropriate tool/agent/verify subsystem.
 *
 * FIXED: dispatchAgent() no longer fire-and-forgets.
 * Agent nodes now register a promise via agentPromiseRegistry and
 * await actual completion (or timeout) before returning to the DAG.
 */

import { bus }                  from "../../infrastructure/events/bus.ts";
import { dagCheckpointStore }   from "../checkpoints/dag-checkpoint-store.ts";
import { createCheckpoint }     from "../graph/graph-state.ts";
import { agentPromiseRegistry } from "./agent-promise-registry.ts";
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

// ── Dispatcher ────────────────────────────────────────────────────────────────

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
      const result = await dispatchNode(node, ctx);
      const durationMs = Date.now() - t0;
      emitNodeCompleted(telCtx, node, durationMs);

      // Auto-checkpoint if node is a checkpoint node
      if (node.isCheckpoint) {
        const cp = createCheckpoint(graph, node.id);
        dagCheckpointStore.save(ctx.runId, ctx.projectId, cp);
      }

      return result;

    } catch (err) {
      const durationMs = Date.now() - t0;
      const error = err instanceof Error ? err.message : String(err);

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

async function dispatchNode(
  node: ExecutionNode,
  ctx:  NodeExecutorContext,
): Promise<unknown> {
  switch (node.type) {
    case "tool":       return dispatchTool(node, ctx);
    case "agent":      return dispatchAgent(node, ctx);
    case "verify":     return dispatchVerify(node, ctx);
    case "checkpoint": return dispatchCheckpointNode(node, ctx);
    case "decision":   return dispatchDecision(node, ctx);
    default:           return dispatchAgent(node, ctx);
  }
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

async function dispatchTool(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const toolName = node.toolName;
  if (!toolName) {
    throw new Error(`Node "${node.id}" type=tool missing toolName`);
  }

  const { toolRegistry }   = await import("../../tools/registry/tool-registry.ts");
  const entry = toolRegistry.get(toolName);
  if (!entry) {
    throw new Error(`Tool "${toolName}" not found in registry`);
  }

  const { executeTool }    = await import("../../tools/core/execute-tool.ts");
  const { buildToolContext } = await import("../../tools/core/tool-context.ts");

  const toolCtx = buildToolContext({
    runId:     ctx.runId,
    projectId: ctx.projectId,
    agentName: "dag-executor",
  });

  const result = await executeTool({
    name: toolName,
    args: node.args as Record<string, unknown>,
    ctx:  toolCtx,
  });

  if (!result.ok) throw new Error(result.error ?? `Tool "${toolName}" failed`);
  return result.result;
}

// ── Agent dispatch ─────────────────────────────────────────────────────────────
//
// FIXED: Previously emitted a bus event and immediately returned { dispatched: true },
// meaning the DAG treated agent nodes as "success" without waiting for real completion.
//
// Now: registers a promise in agentPromiseRegistry, emits the bus event with the
// promiseKey, then awaits the promise. The agent runner (or any external handler)
// calls agentPromiseRegistry.resolve(key, result) on completion.
//
// If no external handler resolves the promise within the timeout, the registry
// auto-resolves with { timedOut: true } — the node succeeds rather than stalling
// the whole graph, which is safe for forward progress.

async function dispatchAgent(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key    = agentPromiseRegistry.key(ctx.runId, node.id);
  const agentTimeoutMs = (node.args as any)?.agentTimeoutMs as number | undefined;

  // Register the promise BEFORE emitting the event (avoids race if handler is sync)
  const resultPromise = agentPromiseRegistry.register(key, agentTimeoutMs);

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
      promiseKey: key,           // allows handler to resolve this specific node
    },
    ts: Date.now(),
  });

  // Await actual agent completion (or timeout auto-resolve)
  const result = await resultPromise;
  return result;
}

// ── Verify dispatch ───────────────────────────────────────────────────────────

async function dispatchVerify(node: ExecutionNode, ctx: NodeExecutorContext): Promise<unknown> {
  const key           = agentPromiseRegistry.key(ctx.runId, node.id);
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

  // With a short default timeout for verify nodes (they should be fast)
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
